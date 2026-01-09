export interface Project {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_by: string;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  project_id: string;
  is_default: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status_id: string;
  project_id: string;
  created_by: string;
  assigned_to?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  position?: number;
  created_at: string;
  updated_at: string;
  
  status?: TaskStatus;
  project?: Project;
  author_profile?: {
    username: string;
    full_name?: string;
  };
  assignee_profile?: {
    username: string;
    full_name?: string;
  };
}

export interface Message {
  id: string;
  content: string;
  project_id: string;
  author_id: string;
  task_id?: string;
  parent_message_id?: string;
  message_type: 'message' | 'system' | 'status_change';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  author_profile?: {
    username: string;
    full_name?: string;
    avatar_url?: string;
  };
  task?: Task;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  color?: string;
  organization_id: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  project_id: string;
  status_id: string;
  assigned_to?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
}

export interface CreateMessageData {
  content: string;
  project_id: string;
  task_id?: string;
  parent_message_id?: string;
  message_type?: 'message' | 'system' | 'status_change';
  metadata?: Record<string, any>;
}