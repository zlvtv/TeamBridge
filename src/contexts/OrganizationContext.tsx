import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  organizationService,
  type OrganizationWithMembers,
  type CreateOrganizationData,
  type UpdateOrganizationData,
} from '../services/organizationService';
import { messageService } from '../services/messageService';
import { useAuth } from './AuthContext';

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

  const refreshOrganizations = useCallback(async (): Promise<OrganizationWithMembers[]> => {
    if (!user) return [];

    try {
      const orgs = await organizationService.getUserOrganizations();
      
      const orgsWithUnread = await Promise.all(
        orgs.map(async (org) => {
          const hasUnread = await messageService.hasUnreadMessages(org.id, user.id);
          return { ...org, hasUnreadMessages: hasUnread };
        })
      );

      setOrganizations(orgsWithUnread);
      return orgsWithUnread;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      return [];
    }
  }, [user?.id]);

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
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
};
