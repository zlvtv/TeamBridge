import { 
  getCollection, 
  createDoc, 
  updateDocById, 
  deleteDocById,
  subscribeToCollection 
} from './firestore/firestoreService';
import { Task } from '../types/task.types';

/**
 * Интерфейс для создания задачи
 */
export interface CreateTaskData {
  title: string;
  description?: string | null;
  project_id: string;
  organization_id?: string;
  assignees?: string[];
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'in_progress' | 'done';
  tags?: string[];
}

/**
 * Интерфейс для обновления задачи
 */
export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  assignees?: string[];
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'in_progress' | 'done';
  tags?: string[];
}

/**
 * Сервис для работы с задачами
 */
export const taskService = {
  /**
   * Получение всех задач проекта
   */
  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await getCollection<Task>('tasks', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }],
      order: { field: 'created_at', direction: 'desc' }
    });
  },

  /**
   * Получение задач пользователя (все проекты)
   */
  async getUserTasks(userId: string, orgIds: string[]): Promise<Task[]> {
    try {
      const projects = await getCollection('projects', {
        whereClauses: [{ field: 'organization_id', operator: 'in', value: orgIds }]
      });

      const projectIds = projects.map(p => p.id);
      if (projectIds.length === 0) return [];

      const tasks = await getCollection<Task>('tasks', {
        whereClauses: [
          { field: 'project_id', operator: 'in', value: projectIds },
          { field: 'assignees', operator: 'array-contains', value: userId }
        ],
        order: { field: 'due_date', direction: 'asc' }
      });

      return tasks;
    } catch (error) {
      console.error('Error fetching user tasks:', error);
      return [];
    }
  },

  /**
   * Создание новой задачи
   */
  async createTask(data: CreateTaskData): Promise<string> {
    if (!data.title?.trim()) {
      throw new Error('Название задачи обязательно');
    }

    const taskData = {
      title: data.title.trim(),
      description: data.description || null,
      project_id: data.project_id,
      organization_id: data.organization_id,
      assignees: data.assignees || [],
      due_date: data.due_date || null,
      priority: data.priority || 'medium',
      status: data.status || 'todo',
      tags: data.tags || [],
      created_by: '', 
    };

    return await createDoc<Task>('tasks', taskData);
  },

  /**
   * Обновление задачи
   */
  async updateTask(taskId: string, data: UpdateTaskData): Promise<void> {
    if (data.title && !data.title.trim()) {
      throw new Error('Название задачи не может быть пустым');
    }

    const updateData = {
      ...data,
      title: data.title?.trim(),
    };

    await updateDocById('tasks', taskId, updateData);
  },

  /**
   * Удаление задачи
   */
  async deleteTask(taskId: string): Promise<void> {
    await deleteDocById('tasks', taskId);
  },

  /**
   * Изменение статуса задачи
   */
  async updateTaskStatus(taskId: string, status: 'todo' | 'in_progress' | 'done'): Promise<void> {
    await updateDocById('tasks', taskId, { status });
  },

  /**
   * Назначение исполнителей
   */
  async assignTask(taskId: string, userIds: string[]): Promise<void> {
    await updateDocById('tasks', taskId, { assignees: userIds });
  },

  /**
   * Подписка на задачи проекта в реальном времени
   */
  subscribeToProjectTasks(
    projectId: string,
    onNext: (tasks: Task[]) => void,
    onError?: (error: Error) => void
  ) {
    return subscribeToCollection(
      'tasks',
      onNext,
      {
        whereClauses: [{ field: 'project_id', operator: '==', value: projectId }],
        order: { field: 'created_at', direction: 'desc' }
      },
      onError
    );
  },

  /**
   * Поиск задач по названию или тегам
   */
  async searchTasks(projectId: string, query: string): Promise<Task[]> {
    const allTasks = await this.getTasksByProject(projectId);
    const q = query.toLowerCase();

    return allTasks.filter(task => {
      const matchesTitle = task.title.toLowerCase().includes(q);
      const matchesTags = task.tags?.some(tag => tag.toLowerCase().includes(q));
      return matchesTitle || matchesTags;
    });
  },

  /**
   * Фильтрация задач
   */
  filterTasks(tasks: Task[], filters: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
  }): Task[] {
    return tasks.filter(task => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assigneeId && task.assignees?.includes(filters.assigneeId)) return false;
      if (filters.dueDateFrom && task.due_date) {
        if (new Date(task.due_date) < new Date(filters.dueDateFrom)) return false;
      }
      if (filters.dueDateTo && task.due_date) {
        if (new Date(task.due_date) > new Date(filters.dueDateTo)) return false;
      }
      return true;
    });
  },

  /**
   * Сортировка задач
   */
  sortTasks(tasks: Task[], sortBy: 'date' | 'title' | 'priority', order: 'asc' | 'desc' = 'desc'): Task[] {
    const sorted = [...tasks];
    
    sorted.sort((a, b) => {
      if (sortBy === 'title') {
        return order === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      } else if (sortBy === 'date') {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
        const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
        return order === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        const priorityOrder = { low: 1, medium: 2, high: 3 };
        const prioA = priorityOrder[a.priority] || 0;
        const prioB = priorityOrder[b.priority] || 0;
        return order === 'asc' ? prioA - prioB : prioB - prioA;
      }
    });

    return sorted;
  }
};
