export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
}

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
