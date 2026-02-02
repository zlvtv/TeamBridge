import React, { useState, useEffect } from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';
import { createTask } from '../../../lib/firestore'; 
import styles from './create-task-modal.module.css';
import Button from '../../ui/button/button';
import Input from '../../ui/input/input';
import Select, { SelectOption } from '../../ui/select/select';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceMessageId?: string;
  initialContent?: string;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  sourceMessageId,
  initialContent,
}) => {
  const { currentProject, refreshProjects, canManageTasks } = useProject();
  const { user: currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isAssignAll, setIsAssignAll] = useState(false);
  const [priority, setPriority] = useState<string>('medium');
  const [status, setStatus] = useState<string>('todo');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableUsers, setAvailableUsers] = useState<SelectOption[]>([]);

  useEffect(() => {
    if (initialContent && initialContent.length > 0) {
      setTitle(initialContent.length > 50 ? initialContent.slice(0, 47) + '...' : initialContent);
    }
  }, [initialContent]);

  useEffect(() => {
    if (!currentProject || !currentProject.members) return;

    const users = currentProject.members.map((m) => {
      const displayName = m.profile?.full_name || (m.profile?.username ? `@${m.profile?.username}` : m.user?.full_name || m.user?.email?.split('@')[0] || `Пользователь ${m.user_id.slice(-5)}`);
      const displayLabel = m.user_id === currentUser?.id ? `${displayName} (вы)` : displayName;
      return {
        value: m.user_id,
        label: displayLabel,
        avatar_url: m.profile?.avatar_url || null,
      };
    });

    const sortedUsers = users.sort((a, b) => {
      if (a.value === currentUser?.id) return -1;
      if (b.value === currentUser?.id) return 1;
      return a.label.localeCompare(b.label, 'ru');
    });

    setAvailableUsers(sortedUsers);
    if (currentUser) setAssignees([currentUser.id]); 
  }, [currentProject, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentProject || !currentUser) return;
    
    if (!canManageTasks) {
      setError('У вас нет прав для создания задач. Только модераторы и создатели проекта могут создавать задачи.');
      return;
    }
    
    if (!title.trim()) return setError('Пожалуйста, введите название задачи');
    if (!dueDate) return setError('Пожалуйста, выберите срок выполнения');
    if (!isAssignAll && assignees.length === 0) return setError('Пожалуйста, выберите хотя бы одного ответственного');
    if (title.length > 500) return setError('Название слишком длинное');
    if (description.length > 2000) return setError('Описание слишком длинное');

    setIsLoading(true);
    setError(null);

    try {
      const assigneeList = isAssignAll
        ? availableUsers.map((u) => u.value)
        : assignees.length > 0 || isAssignAll
        ? assignees
        : [currentUser.id];

      if (!currentProject) throw new Error('Project not found');
      if (!currentUser) throw new Error('User not authenticated');

      if (dueDate && new Date(dueDate) < new Date()) {
        setError('Срок выполнения не может быть в прошлом');
        return;
      }

      await createTask({
        project_id: currentProject.id,
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        source_message_id: sourceMessageId ? sourceMessageId : null,
        assignee_ids: assigneeList,
        tags: tags,
        priority,
        status,
      });

      await refreshProjects?.();

      onClose();
    } catch (err: any) {
      console.error('Ошибка создания задачи:', err);
      setError(`Не удалось создать задачу: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Создать задачу</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.requiredLabel}>Название</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 500))}
              placeholder="Введите название задачи"
              required
              maxLength={500}
              autoFocus
              className={title.trim() ? '' : styles.requiredField}
            />
          </div>

          <div className={styles.field}>
            <label>Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="Дополнительные детали (необязательно)"
              className={styles.textarea}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.requiredLabel}>Срок выполнения</label>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); setError(null); }}
              className={dueDate ? '' : styles.requiredField}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.requiredLabel}>Ответственные</label>
            <div className={styles.assigneesToggle}>
              <label>
                <input
                  type="checkbox"
                  checked={isAssignAll}
                  onChange={(e) => {
                    setIsAssignAll(e.target.checked);
                    if (e.target.checked) setAssignees([]);
                    else setAssignees([currentUser.id]);
                  }}
                />
                Назначить всех
              </label>
            </div>

            {!isAssignAll ? (
              <Select
                value={assignees}
                onChange={setAssignees}
                options={availableUsers}
                placeholder="Выберите ответственного"
                isMulti={true}
                showAvatar={true}
                className={styles.selectAssignees}
              />
            ) : null}
          </div>

            <div className={styles.field}>
            <label>Теги</label>
            <div className={styles.tagInputContainer}>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Введите теги через #"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const tag = tagInput.trim().replace(/^#/, '');
                    if (tag && !tags.includes(tag)) {
                      setTags([...tags, tag]);
                    }
                    setTagInput('');
                  }
                }}
              />
              <div className={styles.tagList}>
                {tags.map((tag, index) => (
                  <span key={index} className={styles.tag}>
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                      className={styles.removeTag}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label>Приоритет</label>
            <Select
              value={priority}
              onChange={value => setPriority(value as string)}
              options={[
                { value: 'low', label: 'Низкий' },
                { value: 'medium', label: 'Средний' },
                { value: 'high', label: 'Высокий' },
              ]}
              placeholder="Выберите приоритет"
              hasSearch={false}
            />
          </div>

          <div className={`${styles.field} ${styles.statusField}`}>
            <label>Статус</label>
            <Select
              value={status}
              onChange={value => setStatus(value as string)}
              options={[
                { value: 'todo', label: 'Не начата' },
                { value: 'in_progress', label: 'В процессе' },
                { value: 'done', label: 'Готово' },
              ]}
              placeholder="Выберите статус"
              hasSearch={false}
            />
          </div>


          {error && <div className={styles['error-message']}>{error}</div>}
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading || !title.trim() || !dueDate || (!isAssignAll && assignees.length === 0)}>
              {isLoading ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
