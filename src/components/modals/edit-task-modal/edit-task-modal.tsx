import React, { useState } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Button from '../../ui/button/button';
import { FormProvider } from '../../ui/form/FormProvider';
import Field from '../../ui/form/Field';
import styles from './edit-task-modal.module.css';
import { useProject } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';
import ConfirmModal from '../confirm-modal/confirm-modal';
import { taskService } from '../../../services/taskService';
import { messageService } from '../../../services/messageService';

interface EditTaskData {
  title: string;
  description: string | null;
  due_date: string | null;
  assignee_ids: string[];
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
}

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    assignees: string[];
    tags: string[];
    priority: 'low' | 'medium' | 'high';
    status: 'todo' | 'in_progress' | 'done';
  };
  refreshProjects: () => Promise<void>;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  task, 
  refreshProjects 
}) => {
  const { currentProject } = useProject();
  const { user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const projectMembers = currentProject?.members || [];
  const assigneeOptions = projectMembers.map(m => ({
    value: m.user_id,
    label: m.profile.full_name || m.profile.username || 'Пользователь'
  }));

  const handleSubmit = async (values: Record<string, any>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: EditTaskData = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date || null,
        assignee_ids: values.assignees || [],
        tags: values.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
        priority: values.priority || 'medium',
        status: values.status || 'todo'
      };

      await taskService.updateTask(task.id, updateData);

      if (task.title !== values.title) {
        await messageService.sendSystemMessage(
          currentProject!.id,
          `Задача переименована: **${task.title}** → **${values.title}**`
        );
      }

      await refreshProjects();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить задачу');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await taskService.deleteTask(task.id);
      await messageService.sendSystemMessage(
        currentProject!.id,
        `Задача удалена: **${task.title}**`
      );
      await refreshProjects();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить задачу');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать задачу">
      <FormProvider
        initialValues={{
          title: task.title,
          description: task.description || '',
          due_date: task.due_date || '',
          assignees: task.assignees || [],
          tags: (task.tags || []).join(', '),
          priority: task.priority,
          status: task.status
        }}
        onSubmit={handleSubmit}
      >
        <div className={styles['edit-task-modal__field']}>
          <Field
            name="title"
            label="Название задачи *"
            placeholder="Введите название"
            required
            validators={[
              (value) => !value?.trim() ? 'Обязательно' : null,
              (value) => value.trim().length < 2 ? 'Минимум 2 символа' : null
            ]}
          />
        </div>

        <div className={styles['edit-task-modal__field']}>
          <Field
            name="description"
            label="Описание"
            placeholder="Введите описание"
            type="textarea"
            multiline
            rows={3}
          />
        </div>

        <div className={styles['edit-task-modal__row']}>
          <div className={styles['edit-task-modal__field']}>
            <Field
              name="due_date"
              label="Срок выполнения"
              type="date"
              placeholder="Выберите дату"
            />
          </div>

          <div className={styles['edit-task-modal__field']}>
            <Field
              name="priority"
              label="Приоритет"
              type="select"
              options={[
                { value: 'low', label: 'Низкий' },
                { value: 'medium', label: 'Средний' },
                { value: 'high', label: 'Высокий' }
              ]}
            />
          </div>
        </div>

        <div className={styles['edit-task-modal__field']}>
          <Field
            name="assignees"
            label="Исполнители"
            type="select"
            multiple
            options={assigneeOptions}
            hasSearch
          />
        </div>

        <div className={styles['edit-task-modal__field']}>
          <Field
            name="tags"
            label="Теги"
            placeholder="Введите теги через запятую"
            description="Например: баг, фича, дизайн"
          />
        </div>

        <div className={styles['edit-task-modal__field']}>
          <Field
            name="status"
            label="Статус"
            type="select"
            options={[
              { value: 'todo', label: 'Не начата' },
              { value: 'in_progress', label: 'В процессе' },
              { value: 'done', label: 'Готово' }
            ]}
          />
        </div>

        {error && (
          <div className={styles['edit-task-modal__error-message']}>
            {error}
          </div>
        )}

        <div className={styles['edit-task-modal__actions']}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Сохранить
          </Button>
        </div>
      </FormProvider>

      <div className={styles['edit-task-modal__danger-zone']}>
        <h3>Удалить задачу</h3>
        <p>Это действие нельзя отменить.</p>
        <Button variant="danger" onClick={() => setIsDeleteConfirmOpen(true)} disabled={isSubmitting}>
          Удалить задачу
        </Button>
      </div>

      {isDeleteConfirmOpen && (
        <ConfirmModal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onConfirm={handleDelete}
          title="Подтвердите удаление"
          confirmText="Удалить"
          cancelText="Отмена"
        >
          <p>Вы действительно хотите удалить задачу <strong>{task.title}</strong>?</p>
          <p>Данные будут безвозвратно удалены.</p>
        </ConfirmModal>
      )}
    </Modal>
  );
};

export default EditTaskModal;
