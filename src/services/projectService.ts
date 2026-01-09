import { supabase } from '../lib/supabase';
import { Project, TaskStatus, CreateProjectData } from '../types/project.types';

export const projectService = {
  async createProject(data: CreateProjectData): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: project, error } = await supabase
      .from('projects')
      .insert([
        {
          ...data,
          created_by: user.id,
        }
      ])
      .select()
      .single<Project>(); 
    if (error) throw error;

    await this.createDefaultStatuses(project.id);

    return project;
  },

  async createDefaultStatuses(projectId: string): Promise<void> {
    console.log('Создание стандартных статусов для проекта:', projectId);

    const defaultStatuses = [
      { name: 'Backlog', color: '#6B7280', position: 0, is_default: false },
      { name: 'To Do', color: '#3B82F6', position: 1, is_default: true },
      { name: 'In Progress', color: '#F59E0B', position: 2, is_default: false },
      { name: 'Review', color: '#8B5CF6', position: 3, is_default: false },
      { name: 'Done', color: '#10B981', position: 4, is_default: false },
    ];

    const { error } = await supabase
      .from('task_statuses')
      .insert(
        defaultStatuses.map(status => ({
          ...status,
          project_id: projectId,
        }))
      );

    if (error) {
      console.error('Ошибка при массовом создании статусов:', error);
    } else {
      console.log('Все стандартные статусы успешно созданы');
    }
  },

  async getOrganizationProjects(organizationId: string): Promise<Project[]> {

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .is('is_archived', false) 
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка Supabase при загрузке проектов:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      if (error.code === '42P01') {
        throw new Error('Таблица проектов не существует. Проверьте миграции базы данных.');
      }

      throw error;
    }

    return data;
  },

  async getProjectStatuses(projectId: string): Promise<TaskStatus[]> {
    const { data, error } = await supabase
      .from('task_statuses')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  },

  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);

    if (error) {
      throw error;
    }
  },

  async archiveProject(projectId: string): Promise<void> {
    await this.updateProject(projectId, { is_archived: true });
  },
};