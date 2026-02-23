import React, { useState } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Button from '../../ui/button/button';
import { FormProvider } from '../../ui/form/FormProvider';
import Field from '../../ui/form/Field';
import styles from './create-task-modal.module.css';
import { useProject } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';
import { taskService } from '../../../services/taskService';
import { messageService } from '../../../services/messageService';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  refreshProjects: () => Promise<void>;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  refreshProjects 
}) => {
  const { currentProject } = useProject();
  const { user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentProject || !user) return null;

  const projectMembers = currentProject.members || [];
  const assigneeOptions = projectMembers.map(m => ({
    value: m.user_id,
    label: m.profile.full_name || m.profile.username || 'Пользователь'
  }));

  const handleSubmit = async (values: Record<string, any>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await taskService.createTask({
        title: values.title,
        description: values.description || null,
        project_id: currentProject.id,
        organization_id: currentProject.organization_id,
        assignees: values.assignees || [],
        due_date: values.due_date || null,
        priority: values.priority || 'medium',
        status: values.status || 'todo',
        tags: values.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || []
      });

      await messageService.sendSystemMessage(
        currentProject.id,
        `Создана новая задача: **${values.title}**`
      );

      await refreshProjects();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать задачу');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Создать задачу">
      <FormProvider
        initialValues={{
          title: '',
          description: '',
          due_date: '',
          assignees: [],
          tags: '',
          priority: 'medium',
          status: 'todo'
        }}
        onSubmit={handleSubmit}
      >
        <div className={styles['create-task-modal__field']}>
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

        <div className={styles['create-task-modal__field']}>
          <Field
            name="description"
            label="Описание"
            placeholder="Введите описание"
            type="textarea"
            multiline
            rows={3}
          />
        </div>

        <div className={styles['create-task-modal__row']}>
          <div className={styles['create-task-modal__field']}>
            <Field
              name="due_date"
              label="Срок выполнения"
              type="date"
              placeholder="Выберите дату"
            />
          </div>

          <div className={styles['create-task-modal__field']}>
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

        <div className={styles['create-task-modal__field']}>
          <Field
            name="assignees"
            label="Исполнители"
            type="select"
            multiple
            options={assigneeOptions}
            hasSearch
          />
        </div>

        <div className={styles['create-task-modal__field']}>
          <Field
            name="tags"
            label="Теги"
            placeholder="Введите теги через запятую"
            description="Например: баг, фича, дизайн"
          />
        </div>

        <div className={styles['create-task-modal__field']}>
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
          <div className={styles['create-task-modal__error-message']}>
            {error}
          </div>
        )}

        <div className={styles['create-task-modal__actions']}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Создать
          </Button>
        </div>

        {isSubmitting && (
          <div className={styles['create-task-modal__creating-feedback']}>
            <small>Создаём задачу…</small>
          </div>
        )}
      </FormProvider>
    </Modal>
  );
};

export default CreateTaskModal;
