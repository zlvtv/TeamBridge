import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  organizationService,
  type OrganizationWithMembers,
  type CreateOrganizationData,
  type UpdateOrganizationData,
} from '../services/organizationService';
import { messageService } from '../services/messageService';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';

interface OrganizationContextType {
  organizations: OrganizationWithMembers[];
  currentOrganization: OrganizationWithMembers | null;
  isLoading: boolean;
  error: string | null;
  createOrganization: (data: CreateOrganizationData) => Promise<OrganizationWithMembers>;
  joinOrganization: (inviteCode: string) => Promise<string>;
  setCurrentOrganization: (org: OrganizationWithMembers | null) => void;
  refreshOrganizations: () => Promise<OrganizationWithMembers[]>;
  refreshCurrentOrganization: () => Promise<void>;
  leaveOrganization: (organizationId: string) => Promise<void>;
  deleteOrganization: (organizationId: string) => Promise<void>;
  createOrganizationInvite: (organizationId: string) => Promise<any>;
  markOrganizationAsRead: (organizationId: string) => void;
  updateOrganization: (id: string, data: UpdateOrganizationData) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<OrganizationWithMembers[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationWithMembers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const initializedOrgSnapshotsRef = useRef<Set<string>>(new Set());
  const currentOrganizationIdRef = useRef<string | null>(null);

  useEffect(() => {
    initializedOrgSnapshotsRef.current.clear();
  }, [user?.id]);

  useEffect(() => {
    currentOrganizationIdRef.current = currentOrganization?.id || null;
  }, [currentOrganization?.id]);

  const sortByActivity = useCallback((orgs: OrganizationWithMembers[]) => {
    return [...orgs].sort((a, b) => {
      const dateA = new Date(a.lastActivityAt || a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.lastActivityAt || b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, []);

  const refreshOrganizations = useCallback(async (): Promise<OrganizationWithMembers[]> => {
    if (!user) return [];

    try {
      const orgs = await organizationService.getUserOrganizations();

      setOrganizations((prev) => {
        const unreadMap = new Map(prev.map(o => [o.id, !!o.hasUnreadMessages]));
        const merged = orgs.map(org => ({
          ...org,
          hasUnreadMessages: unreadMap.get(org.id) || false,
        }));
        return sortByActivity(merged);
      });

      Promise.all(
        orgs.map(async (org) => ({
          id: org.id,
          hasUnreadMessages: await messageService.hasUnreadMessages(org.id, user.id),
        }))
      )
        .then((unreadByOrg) => {
          setOrganizations(prev => {
            const unreadMap = new Map(unreadByOrg.map(item => [item.id, item.hasUnreadMessages]));
            return prev.map(org => ({
              ...org,
              hasUnreadMessages: unreadMap.get(org.id) ?? org.hasUnreadMessages,
            }));
          });
        })
        .catch(() => undefined);

      return orgs;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      return [];
    }
  }, [user?.id, sortByActivity]);

  const refreshCurrentOrganization = useCallback(async () => {
    if (!currentOrganization || !user) return;

    try {
      const orgs = await refreshOrganizations();
      const updatedOrg = orgs.find(o => o.id === currentOrganization.id);
      
      if (updatedOrg) {
        setCurrentOrganization(updatedOrg);
      } else {
        setCurrentOrganization(null);
      }
    } catch (err) {
      console.error('Ошибка при обновлении текущей организации:', err);
    }
  }, [currentOrganization?.id, user?.id, refreshOrganizations]);

  useEffect(() => {
    const initialize = async () => {
      if (!user) {
        setOrganizations([]);
        setCurrentOrganization(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const orgs = await refreshOrganizations();
        
        let targetOrg: OrganizationWithMembers | null = null;
        const savedOrgId = localStorage.getItem('currentOrgId');

        if (savedOrgId) {
          targetOrg = orgs.find(o => o.id === savedOrgId) || null;
        }

        if (!targetOrg && orgs.length > 0) {
          targetOrg = orgs[0];
          localStorage.setItem('currentOrgId', targetOrg.id);
        }

        setCurrentOrganization(targetOrg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка');
        setCurrentOrganization(null);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [user?.id, refreshOrganizations]);

  useEffect(() => {
    if (!user) return;

    let orgUnsubs: Array<() => void> = [];
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(async () => {
        refreshTimer = null;
        await refreshOrganizations();
      }, 20);
    };

    const syncOrganizationSubscriptions = (organizationIds: string[]) => {
      orgUnsubs.forEach(unsub => unsub());
      orgUnsubs = organizationIds.map(orgId =>
        onSnapshot(doc(db, 'organizations', orgId), (orgSnap) => {
          if (!orgSnap.exists()) {
            setOrganizations(prev => prev.filter(org => org.id !== orgId));
            setCurrentOrganization(prev => {
              if (!prev || prev.id !== orgId) return prev;
              localStorage.removeItem('currentOrgId');
              return null;
            });
            scheduleRefresh();
            return;
          }
          const raw = orgSnap.data() as any;
          const activityIso = raw?.updated_at?.toDate
            ? raw.updated_at.toDate().toISOString()
            : new Date().toISOString();
          const hasInitialSnapshot = initializedOrgSnapshotsRef.current.has(orgId);
          initializedOrgSnapshotsRef.current.add(orgId);

          setOrganizations(prev => {
            const next = prev.map(org =>
              org.id === orgId
                ? {
                    ...org,
                    updated_at: activityIso,
                    lastActivityAt: activityIso,
                    hasUnreadMessages:
                      hasInitialSnapshot && orgId !== currentOrganizationIdRef.current
                        ? true
                        : org.hasUnreadMessages,
                  }
                : org
            );
            return sortByActivity(next);
          });

          setCurrentOrganization(prev => {
            if (!prev || prev.id !== orgId) return prev;
            return {
              ...prev,
              updated_at: activityIso,
              lastActivityAt: activityIso,
            };
          });

          if (hasInitialSnapshot) {
            scheduleRefresh();
          }
        })
      );
    };

    const membersQuery = query(
      collection(db, 'organization_members'),
      where('user_id', '==', user.id)
    );

    const unsubscribeMembers = onSnapshot(membersQuery, snapshot => {
      const organizationIds = Array.from(
        new Set(snapshot.docs.map(d => d.data()?.organization_id).filter(Boolean))
      ) as string[];

      setOrganizations(prev => sortByActivity(prev.filter(org => organizationIds.includes(org.id))));
      setCurrentOrganization(prev => {
        if (!prev) return prev;
        if (organizationIds.includes(prev.id)) return prev;
        localStorage.removeItem('currentOrgId');
        return null;
      });

      syncOrganizationSubscriptions(organizationIds);
      scheduleRefresh();
    });

    scheduleRefresh();

    return () => {
      unsubscribeMembers();
      orgUnsubs.forEach(unsub => unsub());
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [user?.id, refreshOrganizations, sortByActivity]);

  const createOrganization = async (data: CreateOrganizationData): Promise<OrganizationWithMembers> => {
    setError(null);
    try {
      const newOrg = await organizationService.createOrganization(data);
      await refreshOrganizations();
      setCurrentOrganization(newOrg);
      localStorage.setItem('currentOrgId', newOrg.id);
      return newOrg;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
      throw err;
    }
  };

  const joinOrganization = async (inviteCode: string): Promise<string> => {
    setError(null);
    try {
      const result = await organizationService.joinOrganization(inviteCode);
      await refreshOrganizations();
      localStorage.setItem('currentOrgId', result.organizationId);
      return result.organizationId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      throw err;
    }
  };

  const leaveOrganization = async (organizationId: string) => {
    setError(null);
    try {
      await organizationService.leaveOrganization(organizationId);
      await refreshOrganizations();
      if (currentOrganization?.id === organizationId) {
        setCurrentOrganization(null);
        localStorage.removeItem('currentOrgId');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      throw err;
    }
  };

  const deleteOrganization = async (organizationId: string) => {
  setError(null);
  try {
    await organizationService.deleteOrganization(organizationId);
    await refreshOrganizations();
    if (currentOrganization?.id === organizationId) {
      setCurrentOrganization(null);
      localStorage.removeItem('currentOrgId');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Ошибка');
    throw err;
  }
};

  const createOrganizationInvite = async (organizationId: string) => {
    try {
      return await organizationService.createOrganizationInvite(organizationId);
    } catch (error) {
      setError((error as Error).message);
      throw error;
    }
  };

  const updateOrganization = async (id: string, data: UpdateOrganizationData) => {
    setError(null);
    try {
      await organizationService.updateOrganization(id, data);
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === id
            ? {
                ...org,
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.roles !== undefined ? { roles: data.roles } : {}),
                ...(data.autoRemoveMembers !== undefined ? { autoRemoveMembers: data.autoRemoveMembers } : {}),
                ...(data.autoAddRoleMembersToChats !== undefined
                  ? { autoAddRoleMembersToChats: data.autoAddRoleMembersToChats }
                  : {}),
              }
            : org
        )
      );
      setCurrentOrganization((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              ...(data.name !== undefined ? { name: data.name } : {}),
              ...(data.description !== undefined ? { description: data.description } : {}),
              ...(data.roles !== undefined ? { roles: data.roles } : {}),
              ...(data.autoRemoveMembers !== undefined ? { autoRemoveMembers: data.autoRemoveMembers } : {}),
              ...(data.autoAddRoleMembersToChats !== undefined
                ? { autoAddRoleMembersToChats: data.autoAddRoleMembersToChats }
                : {}),
            }
          : prev
      );
      await refreshCurrentOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить организацию');
      throw err;
    }
  };

  const markOrganizationAsRead = useCallback((organizationId: string) => {
    messageService.markAsRead(organizationId);
    setOrganizations(prev =>
      prev.map(org =>
        org.id === organizationId 
          ? { ...org, hasUnreadMessages: false } 
          : org
      )
    );
  }, []);

  const value = {
    organizations,
    currentOrganization,
    isLoading,
    error,
    createOrganization,
    joinOrganization,
    setCurrentOrganization,
    refreshOrganizations,
    refreshCurrentOrganization,
    leaveOrganization,
    deleteOrganization,
    createOrganizationInvite,
    markOrganizationAsRead,
    updateOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    console.error('useOrganization called outside OrganizationProvider. Using safe fallback.');
    return {
      organizations: [],
      currentOrganization: null,
      isLoading: false,
      error: null,
      createOrganization: async () => {
        throw new Error('Organization context is unavailable');
      },
      joinOrganization: async () => {
        throw new Error('Organization context is unavailable');
      },
      setCurrentOrganization: () => undefined,
      refreshOrganizations: async () => [],
      refreshCurrentOrganization: async () => undefined,
      leaveOrganization: async () => undefined,
      deleteOrganization: async () => undefined,
      createOrganizationInvite: async () => {
        throw new Error('Organization context is unavailable');
      },
      markOrganizationAsRead: () => undefined,
      updateOrganization: async () => undefined,
    } as OrganizationContextType;
  }
  return context;
};
