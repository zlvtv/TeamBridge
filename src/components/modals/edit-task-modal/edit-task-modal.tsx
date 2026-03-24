import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import type { TaskMessage } from '../../../types/task.types';
import { isDeletedUserProfile } from '../../../utils/user.utils';
import { useOrganization } from '../../../contexts/OrganizationContext';
import TaskTagsField from '../../task-tags-field/task-tags-field';
import {
  canEditTaskReport as canEditTaskReportByPolicy,
  canManageProject,
} from '../../../utils/permissions';

interface EditTaskData {
  title: string;
  description: string | null;
  due_date: string | null;
  assignee_ids: string[];
  tags: string[];
  reminder_offsets_minutes: number[];
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
}

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  task: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    created_by?: string;
    assignees: string[];
    tags: string[];
    reminder_offsets_minutes?: number[];
    priority: 'low' | 'medium' | 'high';
    status: 'todo' | 'in_progress' | 'done';
    report_text?: string | null;
    report_updated_by?: string | null;
    report_updated_at?: string | null;
  };
  refreshProjects: () => Promise<void>;
}

const TASK_REMINDER_OPTIONS = [
  { value: '15', label: 'За 15 минут' },
  { value: '60', label: 'За 1 час' },
  { value: '1440', label: 'За 1 день' },
];

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const EditTaskModal: React.FC<EditTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  readOnly = false,
  task, 
  refreshProjects 
}) => {
  const { currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [taskMessages, setTaskMessages] = useState<TaskMessage[]>([]);
  const [taskMessageDraft, setTaskMessageDraft] = useState('');
  const [isSendingTaskMessage, setIsSendingTaskMessage] = useState(false);
  const [taskChatError, setTaskChatError] = useState<string | null>(null);
  const [taskReportDraft, setTaskReportDraft] = useState(task.report_text || '');
  const [taskReportError, setTaskReportError] = useState<string | null>(null);
  const [isSavingTaskReport, setIsSavingTaskReport] = useState(false);
  const taskMessagesRef = useRef<HTMLDivElement>(null);
  const hasLoadedTaskMessagesRef = useRef(false);

  const projectMembers = (currentProject?.members || []).filter((member) => !isDeletedUserProfile(member.profile));
  const currentProjectMembership = currentProject?.members?.find((member) => member.user_id === user?.id);
  const assigneeOptions = projectMembers.map(m => ({
    value: m.user_id,
    label: m.profile.full_name || m.profile.username || 'Пользователь'
  }));
  const canUseTaskChat = !!user && !!currentProjectMembership;
  const canModerateTaskChat = canManageProject(currentProject, currentOrganization, user?.id);
  const canEditTaskReport =
    !!user &&
    !!currentProjectMembership &&
    canEditTaskReportByPolicy(task, currentProject, currentOrganization, user.id);

  useEffect(() => {
    setTaskReportDraft(task.report_text || '');
    setTaskReportError(null);
  }, [task.id, task.report_text]);

  useEffect(() => {
    if (!isOpen || !task.id) return;
    hasLoadedTaskMessagesRef.current = false;
    setTaskChatError(null);

    const unsubscribe = taskService.subscribeToTaskMessages(
      task.id,
      (messages) => {
        hasLoadedTaskMessagesRef.current = true;
        setTaskMessages(messages);
        setTaskChatError(null);
      },
      () => {
        if (hasLoadedTaskMessagesRef.current) {
          return;
        }
        setTaskChatError('Не удалось загрузить обсуждение задачи');
      }
    );

    return () => unsubscribe?.();
  }, [isOpen, task.id]);

  useEffect(() => {
    if (!taskMessagesRef.current) return;
    taskMessagesRef.current.scrollTop = taskMessagesRef.current.scrollHeight;
  }, [taskMessages]);

  const sendTaskMessage = async () => {
    if (!canUseTaskChat || !user || !currentProject || isSendingTaskMessage) return;
    const trimmed = taskMessageDraft.trim();
    if (!trimmed) return;

    setIsSendingTaskMessage(true);
    setTaskChatError(null);

    try {
      await taskService.sendTaskMessage(task.id, currentProject.id, user.id, trimmed, {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      });
      setTaskMessageDraft('');
    } catch (err: any) {
      setTaskChatError(err?.message || 'Не удалось отправить сообщение в обсуждение задачи');
    } finally {
      setIsSendingTaskMessage(false);
    }
  };

  const deleteTaskMessage = async (messageId: string, senderId: string) => {
    if (!user) return;
    const canDelete = senderId === user.id || canModerateTaskChat;
    if (!canDelete) return;

    try {
      await taskService.deleteTaskMessage(messageId, currentProject?.id || null);
    } catch (err: any) {
      setTaskChatError(err?.message || 'Не удалось удалить сообщение');
    }
  };

  const taskChatPlaceholder = useMemo(() => {
    if (!canUseTaskChat) return 'Обсуждение доступно только участникам проекта';
    return 'Напишите сообщение по задаче...';
  }, [canUseTaskChat]);

  const reportUpdatedByName = useMemo(() => {
    if (!task.report_updated_by) return null;

    if (task.report_updated_by === user?.id) {
      return user.full_name || user.username || 'Вы';
    }

    const author = currentProject?.members?.find((member) => member.user_id === task.report_updated_by)?.profile;
    return author?.full_name || author?.username || 'Участник проекта';
  }, [currentProject?.members, task.report_updated_by, user]);

  const saveTaskReport = async () => {
    if (!user || !canEditTaskReport || isSavingTaskReport) return;

    setIsSavingTaskReport(true);
    setTaskReportError(null);

    try {
      await taskService.updateTask(task.id, {
        report_text: taskReportDraft.trim() || null,
        report_updated_by: taskReportDraft.trim() ? user.id : null,
        report_updated_at: taskReportDraft.trim() ? new Date().toISOString() : null,
        actor_user_id: user.id,
        actor_name: user.full_name || user.username || null,
      });
      await refreshProjects();
    } catch (err: any) {
      setTaskReportError(err?.message || 'Не удалось сохранить отчет по задаче');
    } finally {
      setIsSavingTaskReport(false);
    }
  };

  const handleSubmit = async (values: Record<string, any>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (readOnly) return;

      const updateData: EditTaskData = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date || null,
        assignee_ids: values.assignees || [],
        tags: Array.isArray(values.tags) ? values.tags : [],
        reminder_offsets_minutes: Array.isArray(values.reminder_offsets_minutes)
          ? values.reminder_offsets_minutes.map((value: string) => Number(value)).filter(Number.isFinite)
          : [],
        priority: values.priority || 'medium',
        status: values.status || 'todo'
      };

      await taskService.updateTask(task.id, {
        title: updateData.title,
        description: updateData.description,
        due_date: updateData.due_date,
        assignees: updateData.assignee_ids,
        tags: updateData.tags,
        reminder_offsets_minutes: updateData.reminder_offsets_minutes,
        priority: updateData.priority,
        status: updateData.status,
        actor_user_id: user?.id || null,
        actor_name: user?.full_name || user?.username || null,
      });

      if (task.title !== values.title) {
        await messageService.sendSystemMessage(
          currentProject!.id,
          `Задача переименована: ${task.title} → ${values.title}`
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
      if (readOnly) return;
      setIsSubmitting(true);
      setError(null);
      await taskService.deleteTask(task.id);
      await messageService.sendSystemMessage(
        currentProject!.id,
        `Задача удалена: ${task.title}`
      );
      await refreshProjects();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить задачу');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    try {
      if (readOnly) return;
      setIsSubmitting(true);
      setError(null);
      await taskService.archiveTask(task.id, {
        id: user?.id || null,
        name: user?.full_name || user?.username || null,
      });
      await messageService.sendSystemMessage(
        currentProject!.id,
        `Задача архивирована: ${task.title}`
      );
      await refreshProjects();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось архивировать задачу');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать задачу">
      <FormProvider
        key={task.id}
        initialValues={{
          title: task.title,
          description: task.description || '',
          due_date: toDateTimeLocalValue(task.due_date),
          assignees: task.assignees || [],
          tags: task.tags || [],
          reminder_offsets_minutes: (task.reminder_offsets_minutes || []).map(String),
          priority: task.priority,
          status: task.status
        }}
        onSubmit={handleSubmit}
      >
        <div className={styles['edit-task-modal__field']}>
          <Field
            name="title"
            label="Название задачи"
            placeholder="Введите название"
            required
            disabled={readOnly || isSubmitting}
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
            resize="none"
            disabled={readOnly || isSubmitting}
          />
        </div>

        <div className={styles['edit-task-modal__row']}>
          <div className={styles['edit-task-modal__field']}>
            <Field
              name="due_date"
              label="Срок выполнения"
              type="datetime-local"
              placeholder="Выберите дату и время"
              disabled={readOnly || isSubmitting}
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
              hasSearch={false}
              disabled={readOnly || isSubmitting}
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
            hasSearch={false}
            disabled={readOnly || isSubmitting}
          />
        </div>

        <div className={styles['edit-task-modal__field']}>
          <TaskTagsField
            name="tags"
            suggestions={currentOrganization?.task_tags || []}
            disabled={readOnly || isSubmitting}
          />
        </div>

        <div className={styles['edit-task-modal__field']}>
          <Field
            name="reminder_offsets_minutes"
            label="Напоминания"
            type="select"
            multiple
            options={TASK_REMINDER_OPTIONS}
            hasSearch={false}
            disabled={readOnly || isSubmitting}
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
              hasSearch={false}
              disabled={readOnly || isSubmitting}
            />
        </div>

        {error && (
          <div className={styles['edit-task-modal__error-message']}>
            {error}
          </div>
        )}

        <div className={styles['edit-task-modal__actions']}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {readOnly ? 'Закрыть' : 'Отмена'}
          </Button>
          {!readOnly ? (
            <Button type="submit" variant="primary" loading={isSubmitting}>
              Сохранить
            </Button>
          ) : null}
        </div>
      </FormProvider>

      <div className={styles['edit-task-modal__report']}>
        <div className={styles['edit-task-modal__report-header']}>
          <div>
            <h3>Отчет по задаче</h3>
            {task.report_updated_at ? (
              <span className={styles['edit-task-modal__report-meta']}>
                Обновил(а): {reportUpdatedByName || 'Участник'} · {new Date(task.report_updated_at).toLocaleString('ru-RU')}
              </span>
            ) : (
              <span className={styles['edit-task-modal__report-meta']}>
                Отчет пока не заполнен
              </span>
            )}
          </div>
        </div>

        {canEditTaskReport ? (
          <>
            <textarea
              value={taskReportDraft}
              onChange={(e) => setTaskReportDraft(e.target.value.slice(0, 3000))}
              className={styles['edit-task-modal__report-textarea']}
              placeholder="Коротко зафиксируйте статус выполнения, результат, блокеры или следующий шаг..."
              rows={5}
              disabled={isSavingTaskReport}
            />
            <div className={styles['edit-task-modal__report-actions']}>
              <span>{taskReportDraft.length}/3000</span>
              <Button
                type="button"
                variant="secondary"
                onClick={saveTaskReport}
                loading={isSavingTaskReport}
                disabled={taskReportDraft.trim() === (task.report_text || '').trim()}
              >
                Сохранить отчет
              </Button>
            </div>
          </>
        ) : (
          <div className={styles['edit-task-modal__report-readonly']}>
            {task.report_text?.trim() || 'Исполнители или куратор проекта еще не добавили отчет по этой задаче.'}
          </div>
        )}

        {taskReportError ? <div className={styles['edit-task-modal__error-message']}>{taskReportError}</div> : null}
      </div>

      <div className={styles['edit-task-modal__discussion']}>
        <div className={styles['edit-task-modal__discussion-header']}>
          <div>
            <h3>Обсуждение задачи</h3>
          </div>
          <span className={styles['edit-task-modal__discussion-count']}>{taskMessages.length}</span>
        </div>

        <div className={styles['edit-task-modal__discussion-list']} ref={taskMessagesRef}>
          {taskMessages.length === 0 ? (
            <div className={styles['edit-task-modal__discussion-empty']}>
              Пока нет сообщений. Можно начать обсуждение прямо здесь.
            </div>
          ) : (
            taskMessages.map((message) => {
              if (message.type === 'system') {
                return (
                  <div key={message.id} className={styles['edit-task-modal__discussion-system']}>
                    {message.text}
                  </div>
                );
              }

              const senderName =
                message.sender_profile?.full_name ||
                message.sender_profile?.username ||
                'Участник';
              const canDelete = message.sender_id === user?.id || canModerateTaskChat;

              return (
                <div key={message.id} className={styles['edit-task-modal__discussion-message']}>
                  <div className={styles['edit-task-modal__discussion-avatar']}>
                    {message.sender_profile?.avatar_url ? (
                      <img src={message.sender_profile.avatar_url} alt="" />
                    ) : (
                      <span>{senderName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles['edit-task-modal__discussion-body']}>
                    <div className={styles['edit-task-modal__discussion-meta']}>
                      <strong>{senderName}</strong>
                      <span>
                        {new Date(String(message.created_at_client || message.created_at || new Date().toISOString())).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div className={styles['edit-task-modal__discussion-text']}>{message.text}</div>
                  </div>
                  {canDelete ? (
                    <button
                      type="button"
                      className={styles['edit-task-modal__discussion-delete']}
                      onClick={() => deleteTaskMessage(message.id, message.sender_id)}
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className={styles['edit-task-modal__discussion-compose']}>
          <textarea
            value={taskMessageDraft}
            onChange={(e) => setTaskMessageDraft(e.target.value.slice(0, 1000))}
            className={styles['edit-task-modal__discussion-textarea']}
            placeholder={taskChatPlaceholder}
            rows={3}
            disabled={!canUseTaskChat || isSendingTaskMessage}
          />
          <div className={styles['edit-task-modal__discussion-actions']}>
            <span>{taskMessageDraft.length}/1000</span>
            <Button
              variant="primary"
              type="button"
              onClick={sendTaskMessage}
              loading={isSendingTaskMessage}
              disabled={!canUseTaskChat || !taskMessageDraft.trim()}
            >
              Отправить
            </Button>
          </div>
          {taskChatError ? <div className={styles['edit-task-modal__error-message']}>{taskChatError}</div> : null}
        </div>
      </div>

      {!readOnly ? (
        <div className={styles['edit-task-modal__danger-zone']}>
          <h3>Архивирование и удаление</h3>
          <p>Архив скроет задачу из board, но сохранит ее историю и обсуждение.</p>
          <div className={styles['edit-task-modal__danger-actions']}>
            <Button variant="secondary" onClick={() => setIsArchiveConfirmOpen(true)} disabled={isSubmitting}>
              Архивировать задачу
            </Button>
          </div>

          <h3>Удалить задачу</h3>
          <p>Это действие нельзя отменить.</p>
          <Button variant="danger" onClick={() => setIsDeleteConfirmOpen(true)} disabled={isSubmitting}>
            Удалить задачу
          </Button>
        </div>
      ) : null}

      {isDeleteConfirmOpen && !readOnly && (
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

      {isArchiveConfirmOpen && !readOnly && (
        <ConfirmModal
          isOpen={isArchiveConfirmOpen}
          onClose={() => setIsArchiveConfirmOpen(false)}
          onConfirm={handleArchive}
          title="Архивировать задачу"
          confirmText="Архивировать"
          cancelText="Отмена"
        >
          <p>Задача <strong>{task.title}</strong> будет скрыта из task-board, но останется в истории.</p>
        </ConfirmModal>
      )}
    </Modal>
  );
};

export default EditTaskModal;
