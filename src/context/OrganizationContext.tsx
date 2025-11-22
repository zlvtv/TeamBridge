// src/contexts/OrganizationContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { organizationService } from '../services/organizationService';
import { Organization, OrganizationWithMembers, CreateOrganizationData } from '../types/organization.types';

interface OrganizationContextType {
  organizations: OrganizationWithMembers[];
  currentOrganization: OrganizationWithMembers | null;
  isLoading: boolean;
  error: string | null;
  createOrganization: (data: CreateOrganizationData) => Promise<void>;
  joinOrganization: (inviteCode: string) => Promise<void>;
  setCurrentOrganization: (org: OrganizationWithMembers | null) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<OrganizationWithMembers[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationWithMembers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userOrganizations = await organizationService.getUserOrganizations();
      setOrganizations(userOrganizations);
      
      // Автоматически выбираем первую организацию, если нет текущей
      if (userOrganizations.length > 0 && !currentOrganization) {
        setCurrentOrganization(userOrganizations[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const createOrganization = async (data: CreateOrganizationData) => {
    try {
      setError(null);
      await organizationService.createOrganization(data);
      await loadOrganizations(); // Перезагружаем список организаций
    } catch (err) {
      throw err;
    }
  };

  const joinOrganization = async (inviteCode: string) => {
    try {
      setError(null);
      await organizationService.joinOrganization(inviteCode);
      await loadOrganizations(); // Перезагружаем список организаций
    } catch (err) {
      throw err;
    }
  };

  const refreshOrganizations = async () => {
    await loadOrganizations();
  };

  const value = {
    organizations,
    currentOrganization,
    isLoading,
    error,
    createOrganization,
    joinOrganization,
    setCurrentOrganization,
    refreshOrganizations,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};