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
} from '../services/organizationService';
import { supabase } from '../lib/supabase';

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
  regenerateInviteCode: (organizationId: string) => Promise<void>;
  deactivateInviteCode: (organizationId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<OrganizationWithMembers[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationWithMembers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const orgs = await organizationService.getUserOrganizations();
        setOrganizations(orgs);

        const savedOrgId = localStorage.getItem('currentOrgId');
        const savedOrg = orgs.find(o => o.id === savedOrgId) || orgs[0] || null;
        setCurrentOrganization(savedOrg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка инициализации организаций');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const refreshOrganizations = useCallback(async (): Promise<OrganizationWithMembers[]> => {
    try {
      const orgs = await organizationService.getUserOrganizations();
      setOrganizations(orgs);

      if (currentOrganization) {
        const updated = orgs.find(o => o.id === currentOrganization.id);
        if (updated) {
          setCurrentOrganization(updated);
        }
      }

      return orgs;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      return [];
    }
  }, [currentOrganization]);

  const refreshCurrentOrganization = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      const orgs = await organizationService.getUserOrganizations();
      const updated = orgs.find(o => o.id === currentOrganization.id);
      if (updated) setCurrentOrganization(updated);
    } catch (err) {
      console.error('Ошибка обновления текущей организации:', err);
    }
  }, [currentOrganization?.id]);

  const createOrganization = async (data: CreateOrganizationData): Promise<OrganizationWithMembers> => {
  setError(null);
  try {
    await organizationService.createOrganization(data);
    const orgs = await refreshOrganizations();

    // Получаем user_id до вызова find
    const { data: { user } } = await supabase.auth.getUser();
    const newOrg = orgs.find(org => org.created_by === user?.id) ?? orgs[0];

    if (newOrg) {
      setCurrentOrganization(newOrg);
    }

    return newOrg;
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Ошибка создания');
    throw err;
  }
};

  const joinOrganization = async (inviteCode: string): Promise<string> => {
    setError(null);
    try {
      const orgId = await organizationService.joinOrganization(inviteCode);
      await refreshOrganizations();
      return orgId;
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
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Ошибка выхода из организации');
    throw err;
  }
};


  const deleteOrganization = async (organizationId: string) => {
    setError(null);
    try {
      await organizationService.deleteOrganization(organizationId);
      await refreshOrganizations();
      if (currentOrganization?.id === organizationId) {
        setCurrentOrganization(organizations[0] || null);
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

  const regenerateInviteCode = async (organizationId: string) => {
    setError(null);
    try {
      await organizationService.regenerateInviteCode(organizationId);
      await refreshCurrentOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      throw err;
    }
  };

  const deactivateInviteCode = async (organizationId: string) => {
    setError(null);
    try {
      await organizationService.deactivateInviteCode(organizationId);
      await refreshCurrentOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      throw err;
    }
  };

  useEffect(() => {
    if (currentOrganization) {
      localStorage.setItem('currentOrgId', currentOrganization.id);
    }
  }, [currentOrganization]);

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
    regenerateInviteCode,
    deactivateInviteCode,
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
