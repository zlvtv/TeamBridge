import { UserProfile } from './auth.types';

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user: UserProfile;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  hasUnreadMessages?: boolean;
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
