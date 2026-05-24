import type { Task } from '../types/task.types';

const TASK_STATUSES = new Set(['todo', 'in_progress', 'done']);
const TASK_PRIORITIES = new Set(['low', 'medium', 'high']);

const toIsoString = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return String(value);
};

const toStringArray = (value: any): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
};

export const normalizeTaskRecord = <T extends Record<string, any>>(record: T): T & Task => {
  const {
    assignee_ids: legacyAssignees,
    createdAt,
    updatedAt,
    ...rest
  } = record;

  const assignees = toStringArray(record.assignees).length > 0
    ? toStringArray(record.assignees)
    : toStringArray(legacyAssignees);

  const status = TASK_STATUSES.has(String(record.status))
    ? record.status
    : 'todo';

  const priority = TASK_PRIORITIES.has(String(record.priority))
    ? record.priority
    : 'medium';

  return {
    ...rest,
    id: String(record.id || ''),
    project_id: String(record.project_id || ''),
    title: String(record.title || ''),
    description: record.description ?? null,
    status,
    priority,
    due_date: record.due_date || null,
    created_by: String(record.created_by || ''),
    created_at: toIsoString(record.created_at || createdAt),
    updated_at: toIsoString(record.updated_at || updatedAt),
    archived_at: record.archived_at || null,
    archived_by: record.archived_by || null,
    assignees,
    tags: toStringArray(record.tags),
    reminder_offsets_minutes: Array.isArray(record.reminder_offsets_minutes)
      ? record.reminder_offsets_minutes.map(Number).filter(Number.isFinite)
      : [],
    source_message_id: record.source_message_id || null,
    report_text: record.report_text || null,
    report_updated_by: record.report_updated_by || null,
    report_updated_at: record.report_updated_at || null,
  } as T & Task;
};

export const normalizeTaskRecords = <T extends Record<string, any>>(records: T[]): Array<T & Task> =>
  records.map(normalizeTaskRecord);
