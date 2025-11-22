// src/types/organization.types.ts
export interface Organization {
  id: string;
  name: string;
  description?: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles?: {
    username: string;
    email: string;
    full_name?: string;
  };
}

export interface OrganizationWithMembers extends Organization {
  organization_members: OrganizationMember[];
}

export interface CreateOrganizationData {
  name: string;
  description?: string;
}