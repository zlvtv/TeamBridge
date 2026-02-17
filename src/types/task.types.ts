export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees: string[];
  tags?: string[];
  source_message_id?: string | null;
}

export interface CreateTaskData {
  project_id: string;
  title: string;
  description?: string;
  due_date?: string;
  source_message_id?: string;
  assignee_ids: string[];
  tags?: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
}

export type TaskTab = 'project' | 'organization' | 'user';
