// src/types/organization.types.ts
export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user: {
    full_name: string;
    username: string;
  };
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithMembers extends Organization {
  organization_members: OrganizationMember[];
}

export interface OrganizationInvite {
  token: string;
  expires_at: string;
  invite_link: string;
}

export interface CreateOrganizationData {
  name: string;
  description?: string;
}
