import React from 'react';
import Modal from '@/components/ui/modal/modal';
import Button from '../../ui/button/button';
import Tag from '../../ui/tag/Tag';
import styles from './task-info-modal.module.css';

interface TaskInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  task: {
    id: string;
    title: string;
    description?: string | null;
    due_date?: string | null;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    tags?: string[];
    project_name?: string;
  };
  assignees: Array<{ full_name?: string | null; username?: string | null }>;
}

const statusLabels = {
  todo: 'Не начата',
  in_progress: 'В процессе',
  done: 'Готово',
};

const priorityLabels = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

const priorityVariant = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
} as const;

const formatDueDate = (value: string) =>
  new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const TaskInfoModal: React.FC<TaskInfoModalProps> = ({ isOpen, onClose, onEdit, task, assignees }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Информация о задаче">
      <div className={styles['task-info-modal']}>
        <h3 className={styles['task-info-modal__title']}>{task.title}</h3>

        <div className={styles['task-info-modal__meta']}>
          <Tag variant={priorityVariant[task.priority]} size="small">
            {priorityLabels[task.priority]}
          </Tag>
          <Tag variant="default" size="small">
            {statusLabels[task.status]}
          </Tag>
          {task.due_date && (
            <span className={styles['task-info-modal__due-date']}>
              Срок: {formatDueDate(task.due_date)}
            </span>
          )}
        </div>

        {task.project_name && (
          <div className={styles['task-info-modal__project']}>Проект: {task.project_name}</div>
        )}

        {task.description ? (
          <p className={styles['task-info-modal__description']}>{task.description}</p>
        ) : (
          <p className={styles['task-info-modal__description-empty']}>Описание не добавлено</p>
        )}

        <div className={styles['task-info-modal__section']}>
          <strong>Исполнители</strong>
          <p>
            {assignees.length
              ? assignees.map(a => a.full_name || a.username || 'Пользователь').join(', ')
              : 'Не назначены'}
          </p>
        </div>

        <div className={styles['task-info-modal__section']}>
          <strong>Теги</strong>
          <div className={styles['task-info-modal__tags']}>
            {task.tags?.length
              ? task.tags.map((tag, index) => (
                  <Tag key={index} variant="primary" size="small">
                    {tag}
                  </Tag>
                ))
              : <span>Без тегов</span>}
          </div>
        </div>

        <div className={styles['task-info-modal__actions']}>
          <Button variant="secondary" onClick={onClose}>Закрыть</Button>
          {onEdit && <Button variant="primary" onClick={onEdit}>Редактировать</Button>}
        </div>
      </div>
    </Modal>
  );
};

export default TaskInfoModal;
