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
  archived_at?: string | null;
  archived_by?: string | null;
  assignees: string[];
  tags?: string[];
  reminder_offsets_minutes?: number[];
  source_message_id?: string | null;
  report_text?: string | null;
  report_updated_by?: string | null;
  report_updated_at?: string | null;
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

export interface TaskMessage {
  id: string;
  task_id: string;
  project_id: string;
  sender_id: string;
  text: string;
  type?: 'text' | 'system';
  created_at: string | Date;
  created_at_client?: string;
  sender_profile?: {
    id?: string;
    username?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
}
