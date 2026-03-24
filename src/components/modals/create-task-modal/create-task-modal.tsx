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
import { isDeletedUserProfile } from '../../../utils/user.utils';
import { useOrganization } from '../../../contexts/OrganizationContext';
import TaskTagsField from '../../task-tags-field/task-tags-field';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  refreshProjects?: () => Promise<void>;
  sourceMessageId?: string;
  initialContent?: string;
}

const TASK_REMINDER_OPTIONS = [
  { value: '15', label: 'За 15 минут' },
  { value: '60', label: 'За 1 час' },
  { value: '1440', label: 'За 1 день' },
];

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  sourceMessageId,
  initialContent = '',
}) => {
  const { currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentProject || !user) return null;

  const projectMembers = (currentProject.members || []).filter((member) => !isDeletedUserProfile(member.profile));
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
        created_by: user.id,
        assignees: values.assignees || [],
        due_date: values.due_date || null,
        reminder_offsets_minutes: Array.isArray(values.reminder_offsets_minutes)
          ? values.reminder_offsets_minutes.map((value: string) => Number(value)).filter(Number.isFinite)
          : [],
        priority: values.priority || 'medium',
        status: values.status || 'todo',
        tags: Array.isArray(values.tags) ? values.tags : [],
        source_message_id: sourceMessageId || null,
      });

      await messageService.sendSystemMessage(
        currentProject.id,
        `Создана новая задача: ${values.title}`
      );

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
          title: initialContent
            ? initialContent.trim().split('\n').find(Boolean)?.slice(0, 80) || ''
            : '',
          description: '',
          due_date: '',
          assignees: [],
          tags: [],
          reminder_offsets_minutes: [],
          priority: 'medium',
          status: 'todo'
        }}
        
        onSubmit={handleSubmit}
      >
        <div className={styles['create-task-modal__field']}>
          <Field
            name="title"
            label="Название задачи"
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
              type="datetime-local"
              placeholder="Выберите дату и время"
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
              hasSearch={false}
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
            hasSearch={false}
          />
        </div>

        <div className={styles['create-task-modal__field']}>
          <TaskTagsField
            name="tags"
            suggestions={currentOrganization?.task_tags || []}
            disabled={isSubmitting}
          />
        </div>

        <div className={styles['create-task-modal__field']}>
          <Field
            name="reminder_offsets_minutes"
            label="Напоминания"
            type="select"
            multiple
            options={TASK_REMINDER_OPTIONS}
            hasSearch={false}
            disabled={isSubmitting}
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
            hasSearch={false} 
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
