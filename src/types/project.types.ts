import { Task } from './task.types';

export interface ProjectRole {
  name: string;
  color: string;
}

export interface ProjectMemberProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  description?: string | null;
  last_seen_at?: string | null;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  status: 'member' | 'admin' | 'owner';
  roles?: string[];
  joined_at: string;
  profile: ProjectMemberProfile;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
  lead_user_id?: string | null;
  roles?: ProjectRole[];
  auto_add_org_roles?: string[];
  members: ProjectMember[];
  tasks: Task[];
  hasUnreadMessages?: boolean;
}
