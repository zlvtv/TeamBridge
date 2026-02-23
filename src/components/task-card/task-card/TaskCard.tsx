import React, { useState } from 'react';
import styles from './TaskCard.module.css';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import Tag from '../../ui/tag/Tag';

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    due_date: string | null;
    priority: 'low' | 'medium' | 'high';
    status: 'todo' | 'in_progress' | 'done';
    tags?: string[];
  };
  assignees: any[];
  onStatusChange: (status: 'todo' | 'in_progress' | 'done') => void;
  onEdit: () => void;
  hideActions?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

const priorityColors = {
  low: 'default',
  medium: 'warning',
  high: 'danger'
};

const statusLabels = {
  todo: 'Не начата',
  in_progress: 'В процессе',
  done: 'Готово'
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  assignees,
  onStatusChange,
  onEdit,
  hideActions = false,
  draggable = false,
  onDragStart
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) onDragStart(e);
  };

  return (
    <div 
      className={styles['task-card']}
      draggable={draggable}
      onDragStart={handleDragStart}
      onClick={onEdit}
    >
      <div className={styles['task-card__header']}>
        <h4 className={styles['task-card__title']}>{task.title}</h4>
        {!hideActions && (
          <button 
            className={styles['task-card__edit-button']}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Редактировать"
          >
            ✏️
          </button>
        )}
      </div>

      <div className={styles['task-card__tags']}>
        {task.tags && task.tags.length > 0 ? (
          task.tags.map((tag, index) => (
            <Tag key={index} variant="primary" size="small" className={styles['task-card__tag']}>
              {tag}
            </Tag>
          ))
        ) : (
          <span className={styles['task-card__no-tags']}>Без тегов</span>
        )}
      </div>

      <div className={styles['task-card__meta']}>
        {task.due_date && (
          <span className={styles['task-card__due-date']}>
            🔔 {new Date(task.due_date).toLocaleDateString('ru-RU')}
          </span>
        )}

        <Tag variant={priorityColors[task.priority]} size="small">
          {task.priority === 'low' ? 'Низкий' : task.priority === 'medium' ? 'Средний' : 'Высокий'}
        </Tag>
      </div>

      {assignees.length > 0 && (
        <div className={styles['task-card__assignees']}>
          Исполнители: {assignees.map(a => a.full_name || a.username).join(', ')}
        </div>
      )}

      {!hideActions && (
        <div className={styles['task-card__actions']}>
          <select
            value={task.status}
            onChange={(e) => onStatusChange(e.target.value as any)}
            className={styles['task-card__status-select']}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="todo">{statusLabels.todo}</option>
            <option value="in_progress">{statusLabels.in_progress}</option>
            <option value="done">{statusLabels.done}</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default TaskCard;