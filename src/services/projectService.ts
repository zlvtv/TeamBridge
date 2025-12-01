// src/services/projectService.ts
import { supabase } from '../lib/supabase';
import { Project, TaskStatus, CreateProjectData } from '../types/project.types';

export const projectService = {
  // Создание проекта
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
      .single();

    if (error) throw error;

    // Создаем стандартные статусы для проекта
    await this.createDefaultStatuses(project.id);

    return project;
  },

  // Создание стандартных статусов
  async createDefaultStatuses(projectId: string): Promise<void> {
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

    if (error) throw error;
  },

  // Получение проектов организации
  async getOrganizationProjects(organizationId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Получение статусов проекта
  async getProjectStatuses(projectId: string): Promise<TaskStatus[]> {
    const { data, error } = await supabase
      .from('task_statuses')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Обновление проекта
  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);

    if (error) throw error;
  },

  // Архивирование проекта
  async archiveProject(projectId: string): Promise<void> {
    await this.updateProject(projectId, { is_archived: true });
  },
};