import React, { useState, useEffect } from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';
import { createTask } from '../../../lib/firestore'; 
import styles from './create-task-modal.module.css';
import Button from '../../ui/button/button';
import Input from '../../ui/input/input';
import Select from '../../ui/select/select';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceMessageId?: string;
  initialContent?: string;
}

interface UserOption {
  id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  sourceMessageId,
  initialContent,
}) => {
  const { currentProject, refreshProjects } = useProject();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isAssignAll, setIsAssignAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (initialContent && initialContent.length > 0) {
      setTitle(initialContent.length > 50 ? initialContent.slice(0, 47) + '...' : initialContent);
    }
  }, [initialContent]);

  useEffect(() => {
    if (!currentProject || !currentProject.members) return;

    const users = currentProject.members.map((m) => ({
      id: m.user_id,
      full_name: m.profile?.full_name || 'Пользователь',
      username: m.profile?.username || 'unknown',
      avatar_url: m.profile?.avatar_url || null,
    }));

    setAvailableUsers(users);
    if (user) setAssignees([user.id]); 
  }, [currentProject, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentProject || !user) return;
    if (title.length > 500) return setError('Название слишком длинное');
    if (description.length > 2000) return setError('Описание слишком длинное');

    setIsLoading(true);
    setError(null);

    try {
      const assigneeList = isAssignAll
        ? availableUsers.map((u) => u.id)
        : assignees.length > 0
        ? assignees
        : [user.id];

      await createTask({
        project_id: currentProject.id,
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || undefined,
        source_message_id: sourceMessageId,
        assignee_ids: assigneeList,
        tags: tags,
      });

      await refreshProjects?.();

      onClose();
    } catch (err: any) {
      setError('Не удалось создать задачу. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Создать задачу</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>Название</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 500))}
              placeholder="Введите название задачи"
              required
              maxLength={500}
              autoFocus
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
            <label>Срок выполнения</label>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Ответственные</label>
            <div className={styles.assigneesToggle}>
              <label>
                <input
                  type="checkbox"
                  checked={isAssignAll}
                  onChange={(e) => {
                    setIsAssignAll(e.target.checked);
                    if (e.target.checked) setAssignees([]);
                  }}
                />
                Назначить всех
              </label>
            </div>

            {!isAssignAll && (
              <div className={styles.userList}>
                {availableUsers.map((u) => (
                  <div
                    key={u.id}
                    className={`${styles.userItem} ${assignees.includes(u.id) ? styles.selected : ''}`}
                    onClick={() => toggleAssignee(u.id)}
                  >
                    <div
                      className={styles.avatar}
                      style={{ backgroundImage: u.avatar_url ? `url(${u.avatar_url})` : 'none' }}
                    >
                      {!u.avatar_url && (
                        <span>{(u.full_name || u.username)?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span>{u.full_name || `@${u.username}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

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

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
