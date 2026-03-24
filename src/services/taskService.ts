import { 
  getCollection, 
  createDoc, 
  updateDocById, 
  deleteDocById,
  subscribeToCollection,
  getDocById,
} from './firestore/firestoreService';
import { Task, TaskMessage } from '../types/task.types';
import { touchOrganizationActivityByProject } from './activityService';
import { encryptMessage, decryptMessage } from '../lib/crypto';
import { buildUserFromSnapshot, isDeletedUserProfile } from '../utils/user.utils';
import { db } from '../lib/firebase';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';

const normalizeTaskTagKey = (tag: string) => tag.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
const normalizeTaskTags = (tags: string[] | undefined): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  (Array.isArray(tags) ? tags : []).forEach((tag) => {
    const normalized = String(tag || '').trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    const key = normalizeTaskTagKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result;
};

const resolveAssignableUserIds = async (projectId: string, assigneeIds: string[] | undefined): Promise<string[]> => {
  const normalizedIds = Array.isArray(assigneeIds)
    ? assigneeIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];

  if (normalizedIds.length === 0) {
    return [];
  }

  const projectMembers = await getCollection<any>('project_members', {
    whereClauses: [{ field: 'project_id', operator: '==', value: projectId }]
  });

  const availableMemberIds = new Set(projectMembers.map((member) => member.user_id));
  const uniqueTargetIds = [...new Set(normalizedIds)].filter((userId) => availableMemberIds.has(userId));

  const profiles = await Promise.all(
    uniqueTargetIds.map(async (userId) => {
      const userSnap = await getDocById('users', userId);
      return {
        userId,
        profile: buildUserFromSnapshot(userSnap, userId),
      };
    })
  );

  return profiles
    .filter(({ profile }) => !isDeletedUserProfile(profile))
    .map(({ userId }) => userId);
};

const syncOrganizationTaskTags = async (organizationId: string | undefined, tags: string[] | undefined) => {
  if (!organizationId) return;
  const normalizedTags = normalizeTaskTags(tags);
  if (normalizedTags.length === 0) return;

  await updateDoc(doc(db, 'organizations', organizationId), {
    task_tags: arrayUnion(...normalizedTags),
  });
};

const normalizeReminderOffsets = (offsets: number[] | undefined): number[] => {
  const values = Array.isArray(offsets)
    ? offsets
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  return [...new Set(values)].sort((left, right) => left - right);
};

const emitTaskEvent = (
  detail:
    | { type: 'created' | 'updated'; task: Task }
    | { type: 'deleted'; taskId: string; projectId: string }
) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('teambridge:task-changed', { detail }));
};

export interface CreateTaskData {
  title: string;
  description?: string | null;
  project_id: string;
  organization_id?: string;
  created_by?: string;
  source_message_id?: string | null;
  assignees?: string[];
  due_date?: string | null;
  reminder_offsets_minutes?: number[];
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'in_progress' | 'done';
  tags?: string[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  assignees?: string[];
  due_date?: string | null;
  reminder_offsets_minutes?: number[];
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'in_progress' | 'done';
  tags?: string[];
  report_text?: string | null;
  report_updated_by?: string | null;
  report_updated_at?: string | null;
  actor_user_id?: string | null;
  actor_name?: string | null;
}

const TASK_STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'Не начата',
  in_progress: 'В процессе',
  done: 'Готово',
};

const TASK_PRIORITY_LABELS: Record<Task['priority'], string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

const formatTaskDate = (value: string | null | undefined) => {
  if (!value) return 'не задан';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'не задан';
  return date.toLocaleString('ru-RU');
};

const formatActorName = (name?: string | null) => {
  const normalized = String(name || '').trim();
  return normalized || 'Участник проекта';
};

const resolveUserDisplayNames = async (userIds: string[]): Promise<Map<string, string>> => {
  const uniqueIds = [...new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean))];
  const snapshots = await Promise.all(
    uniqueIds.map(async (userId) => {
      const userSnap = await getDocById('users', userId);
      const profile = buildUserFromSnapshot(userSnap, userId);
      return [userId, profile.full_name || profile.username || profile.email || 'Участник'] as const;
    })
  );

  return new Map(snapshots);
};

const formatUserNameList = (userIds: string[], nameMap: Map<string, string>) => {
  return userIds.map((userId) => nameMap.get(userId) || 'Участник').join(', ');
};

const createTaskSystemMessage = async (taskId: string, projectId: string, text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return;

  await createDoc<any>('messages', {
    task_id: taskId,
    project_id: projectId,
    sender_id: 'system',
    text: encryptMessage(trimmed, projectId),
    created_at_client: new Date().toISOString(),
    type: 'system',
    sender_profile: null,
  });
};

export const taskService = {
  async getTaskById(taskId: string): Promise<Task | null> {
    return getDocById<Task>('tasks', taskId);
  },

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await getCollection<Task>('tasks', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }],
      order: { field: 'created_at', direction: 'desc' }
    });
  },

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

  async createTask(data: CreateTaskData): Promise<string> {
    if (!data.title?.trim()) {
      throw new Error('Название задачи обязательно');
    }

    const assignees = await resolveAssignableUserIds(data.project_id, data.assignees);
    const tags = normalizeTaskTags(data.tags);
    const reminderOffsets = normalizeReminderOffsets(data.reminder_offsets_minutes);

    const taskData = {
      title: data.title.trim(),
      description: data.description || null,
      project_id: data.project_id,
      organization_id: data.organization_id,
      assignees,
      due_date: data.due_date || null,
      reminder_offsets_minutes: reminderOffsets,
      priority: data.priority || 'medium',
      status: data.status || 'todo',
      tags,
      source_message_id: data.source_message_id || null,
      created_by: data.created_by || '',
    };

    const created = await createDoc<Task>('tasks', taskData);
    await syncOrganizationTaskTags(data.organization_id, tags);
    await touchOrganizationActivityByProject(data.project_id);
    emitTaskEvent({
      type: 'created',
      task: {
        id: created.id,
        ...taskData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Task,
    });
    return created.id;
  },

  async updateTask(taskId: string, data: UpdateTaskData): Promise<void> {
    if (data.title && !data.title.trim()) {
      throw new Error('Название задачи не может быть пустым');
    }

    const currentTask = await this.getTaskById(taskId);
    const assignees =
      data.assignees !== undefined && currentTask?.project_id
        ? await resolveAssignableUserIds(currentTask.project_id, data.assignees)
        : data.assignees;
    const tags = data.tags !== undefined ? normalizeTaskTags(data.tags) : data.tags;
    const reminderOffsets =
      data.reminder_offsets_minutes !== undefined
        ? normalizeReminderOffsets(data.reminder_offsets_minutes)
        : data.reminder_offsets_minutes;

    const { actor_name: _actorName, actor_user_id: _actorUserId, ...persistedData } = data;

    const rawUpdateData = {
      ...persistedData,
      assignees,
      tags,
      reminder_offsets_minutes: reminderOffsets,
      title: data.title?.trim(),
    };

    const updateData = Object.fromEntries(
      Object.entries(rawUpdateData).filter(([, value]) => value !== undefined)
    );

    await updateDocById('tasks', taskId, updateData);
    await syncOrganizationTaskTags(currentTask?.organization_id, tags as string[] | undefined);
    const task = (await this.getTaskById(taskId)) || currentTask;
    const actorName = formatActorName(data.actor_name);

    if (task && currentTask && currentTask.project_id) {
      const changeLog: string[] = [];

      if (data.title !== undefined && currentTask.title !== task.title) {
        changeLog.push(`${actorName} изменил(а) название задачи: ${currentTask.title} → ${task.title}`);
      }

      if (data.description !== undefined && (currentTask.description || '') !== (task.description || '')) {
        changeLog.push(
          task.description?.trim()
            ? `${actorName} обновил(а) описание задачи`
            : `${actorName} очистил(а) описание задачи`
        );
      }

      if (data.status !== undefined && currentTask.status !== task.status) {
        changeLog.push(
          `${actorName} изменил(а) статус: ${TASK_STATUS_LABELS[currentTask.status]} → ${TASK_STATUS_LABELS[task.status]}`
        );
      }

      if (data.priority !== undefined && currentTask.priority !== task.priority) {
        changeLog.push(
          `${actorName} изменил(а) приоритет: ${TASK_PRIORITY_LABELS[currentTask.priority]} → ${TASK_PRIORITY_LABELS[task.priority]}`
        );
      }

      if (data.due_date !== undefined && (currentTask.due_date || null) !== (task.due_date || null)) {
        changeLog.push(
          `${actorName} изменил(а) срок: ${formatTaskDate(currentTask.due_date)} → ${formatTaskDate(task.due_date)}`
        );
      }

      if (data.tags !== undefined) {
        const previousTags = normalizeTaskTags(currentTask.tags);
        const nextTags = normalizeTaskTags(task.tags);
        if (previousTags.join('|') !== nextTags.join('|')) {
          changeLog.push(
            nextTags.length > 0
              ? `${actorName} обновил(а) теги: ${nextTags.join(', ')}`
              : `${actorName} очистил(а) теги задачи`
          );
        }
      }

      if (data.assignees !== undefined) {
        const previousIds = [...new Set(currentTask.assignees || [])];
        const nextIds = [...new Set(task.assignees || [])];
        const previousSet = new Set(previousIds);
        const nextSet = new Set(nextIds);
        const added = nextIds.filter((id) => !previousSet.has(id));
        const removed = previousIds.filter((id) => !nextSet.has(id));

        if (added.length > 0 || removed.length > 0) {
          const names = await resolveUserDisplayNames([...added, ...removed]);
          if (added.length > 0) {
            changeLog.push(`${actorName} добавил(а) исполнителей: ${formatUserNameList(added, names)}`);
          }
          if (removed.length > 0) {
            changeLog.push(`${actorName} убрал(а) исполнителей: ${formatUserNameList(removed, names)}`);
          }
        }
      }

      if (data.report_text !== undefined && (currentTask.report_text || '') !== (task.report_text || '')) {
        changeLog.push(
          task.report_text?.trim()
            ? `${actorName} обновил(а) отчет по задаче`
            : `${actorName} очистил(а) отчет по задаче`
        );
      }

      await Promise.all(changeLog.map((text) => createTaskSystemMessage(task.id, currentTask.project_id, text)));
    }

    if (task) {
      emitTaskEvent({
        type: 'updated',
        task,
      });
    }
    if (task?.project_id) await touchOrganizationActivityByProject(task.project_id);
  },

  async deleteTask(taskId: string): Promise<void> {
    const task = await this.getTaskById(taskId);
    await deleteDocById('tasks', taskId);
    const discussionMessages = await getCollection<any>('messages', {
      whereClauses: [{ field: 'task_id', operator: '==', value: taskId }]
    });
    await Promise.all(discussionMessages.map((message) => deleteDocById('messages', message.id)));
    if (task?.project_id) {
      emitTaskEvent({
        type: 'deleted',
        taskId,
        projectId: task.project_id,
      });
    }
    if (task?.project_id) await touchOrganizationActivityByProject(task.project_id);
  },

  async archiveTask(taskId: string, actor?: { id?: string | null; name?: string | null }): Promise<void> {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('Задача не найдена');
    }

    await updateDocById('tasks', taskId, {
      archived_at: new Date().toISOString(),
      archived_by: actor?.id || null,
    });

    await createTaskSystemMessage(
      taskId,
      task.project_id,
      `${formatActorName(actor?.name)} архивировал(а) задачу`
    );

    const updatedTask = await this.getTaskById(taskId);
    if (updatedTask) {
      emitTaskEvent({
        type: 'updated',
        task: updatedTask,
      });
    }

    await touchOrganizationActivityByProject(task.project_id);
  },

  async updateTaskStatus(
    taskId: string,
    status: 'todo' | 'in_progress' | 'done',
    actor?: { id?: string | null; name?: string | null }
  ): Promise<void> {
    const previousTask = await this.getTaskById(taskId);
    await updateDocById('tasks', taskId, { status });
    const task = await this.getTaskById(taskId);
    if (task && previousTask && previousTask.status !== status) {
      await createTaskSystemMessage(
        task.id,
        task.project_id,
        `${formatActorName(actor?.name)} изменил(а) статус: ${TASK_STATUS_LABELS[previousTask.status]} → ${TASK_STATUS_LABELS[status]}`
      );
    }
    if (task) {
      emitTaskEvent({
        type: 'updated',
        task,
      });
    }
    if (task?.project_id) await touchOrganizationActivityByProject(task.project_id);
  },

  async assignTask(taskId: string, userIds: string[]): Promise<void> {
    const task = await this.getTaskById(taskId);
    const assignees = task?.project_id
      ? await resolveAssignableUserIds(task.project_id, userIds)
      : [];
    await updateDocById('tasks', taskId, { assignees });
    const updatedTask = await this.getTaskById(taskId);
    if (updatedTask) {
      emitTaskEvent({
        type: 'updated',
        task: updatedTask,
      });
    }
    if (task?.project_id) await touchOrganizationActivityByProject(task.project_id);
  },

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

  async searchTasks(projectId: string, query: string): Promise<Task[]> {
    const allTasks = await this.getTasksByProject(projectId);
    const q = query.toLowerCase();

    return allTasks.filter(task => {
      const matchesTitle = task.title.toLowerCase().includes(q);
      const matchesTags = task.tags?.some(tag => tag.toLowerCase().includes(q));
      return matchesTitle || matchesTags;
    });
  },

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
  },

  async sendTaskMessage(taskId: string, projectId: string, senderId: string, text: string, senderProfile?: TaskMessage['sender_profile']) {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Сообщение не может быть пустым');
    }

    await createDoc<any>('messages', {
      task_id: taskId,
      project_id: projectId,
      sender_id: senderId,
      text: encryptMessage(trimmed, projectId),
      created_at_client: new Date().toISOString(),
      type: 'text',
      sender_profile: senderProfile || null,
    });

    await touchOrganizationActivityByProject(projectId);
  },

  subscribeToTaskMessages(taskId: string, onNext: (messages: TaskMessage[]) => void, onError?: (error: Error) => void) {
    return subscribeToCollection(
      'messages',
      (messages) => {
        const normalized = (messages as any[]).map((message) => ({
          ...message,
          text: message.text ? decryptMessage(message.text, message.project_id) : '',
        })) as TaskMessage[];
        const sorted = [...normalized].sort((left, right) => {
          const leftTime = new Date(String(left.created_at_client || left.created_at || 0)).getTime();
          const rightTime = new Date(String(right.created_at_client || right.created_at || 0)).getTime();
          return leftTime - rightTime;
        });
        onNext(sorted);
      },
      {
        whereClauses: [{ field: 'task_id', operator: '==', value: taskId }],
      },
      onError
    );
  },

  async deleteTaskMessage(messageId: string, projectId?: string | null): Promise<void> {
    await deleteDocById('messages', messageId);
    if (projectId) {
      await touchOrganizationActivityByProject(projectId);
    }
  }
};
