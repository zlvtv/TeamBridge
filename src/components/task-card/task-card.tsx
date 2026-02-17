import React, { useState } from 'react';
import styles from './task-card.module.css';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import DOMPurify from 'dompurify';

interface TaskCardProps {
  task: any;
  assignees: any[];
  onStatusChange: (status: 'todo' | 'in_progress' | 'done') => void;
  onEdit: () => void;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, assignees, onStatusChange, onEdit, priority, dueDate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Без срока';
    try {
      return format(parseISO(dateString), 'dd MMMM yyyy в HH:mm', { locale: ru });
    } catch {
      return 'Неверная дата';
    }
  };

  const renderDescription = (desc: string | null) => {
    if (!desc) return null;
    return {
      __html: DOMPurify.sanitize(desc, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
      }),
    };
  };

  const getStatusLabel = (status: string) => {
    return {
      todo: 'Не начата',
      in_progress: 'В процессе',
      done: 'Готово',
    }[status];
  };

  const getPriorityColor = (priority: string) => {
    return {
      low: '#38a169',
      medium: '#d69e2e',
      high: '#e53e3e',
    }[priority] || '#888';
  };

  const toggleStatus = () => {
    const nextStatus: Record<string, 'in_progress' | 'done' | 'todo'> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
    };    onStatusChange(nextStatus[task.status]);
  };

  const renderTags = () => {
    if (!tags || tags.length === 0) return null;
    return (
      <div className={styles.tags}>
        {tags.map((tag, index) => (
          <span key={index} className={styles.tag}>
            #{tag}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className={`${styles.card} ${task.status === 'done' ? styles.done : ''}`}>
      <div className={styles.header}>
        <h4
          className={styles.title}
          onClick={onEdit}
          title="Нажмите, чтобы редактировать задачу"
        >
          {task.title}
        </h4>

        <div
          className={styles.statusBadge}
          style={{ backgroundColor: getPriorityColor(priority || task.priority), cursor: 'pointer' }}
          onClick={toggleStatus}
          title="Нажмите, чтобы изменить статус"
        >
          {getStatusLabel(task.status)}
        </div>
      </div>

      {isExpanded && task.description && (
        <div
          className={styles.description}
          dangerouslySetInnerHTML={renderDescription(task.description)}
        />
      )}

      {isExpanded && renderTags()}

      <div className={styles.footer}>
        <div className={styles.dueDate}>
          📅 {formatDate(dueDate || task.due_date)}
        </div>

        <div className={styles.assignees}>
          {assignees.length === 0 ? (
            <span>Без ответственных</span>
          ) : (
            assignees.map((user) => (
              <div
                key={user.id}
                className={styles.avatar}
                title={user.full_name || user.username}
                style={{ backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : 'none' }}
              >
                {!user.avatar_url && (
                  <span>{(user.full_name || user.username)?.charAt(0).toUpperCase()}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
