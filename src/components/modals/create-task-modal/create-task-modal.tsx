import React, { useState, useEffect } from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
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
  const { currentProject, canManageTasks } = useProject();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [assignees, setAssignees] = useState<string[]>([]);
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
    const loadUsers = async () => {
      if (!currentProject) return;

      const { data, error } = await supabase
        .from('project_members')
        .select(`
          user_id,
          profiles (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('project_id', currentProject.id);

      if (error) {
        console.error('Failed to load users:', error);
        return;
      }

      const users = (data || []).map((m: any) => ({
        id: m.user_id,
        full_name: m.profiles.full_name,
        username: m.profiles.username,
        avatar_url: m.profiles.avatar_url,
      }));

      setAvailableUsers(users);
      setAssignees([user?.id]); // По умолчанию — создатель
    };

    loadUsers();
  }, [currentProject?.id, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentProject || !user) return;
    if (title.length > 500) return setError('Название слишком длинное');
    if (description.length > 2000) return setError('Описание слишком длинное');

    setIsLoading(true);
    setError(null);

    try {
      // Определяем, кто ответственный
      const assigneeList = isAssignAll
        ? availableUsers.map(u => u.id)
        : assignees.length > 0
        ? assignees
        : [user.id];

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          project_id: currentProject.id,
          title: title.trim(),
          description: description.trim() || null,
          created_by: user.id,
          due_date: dueDate || null,
          source_message_id: sourceMessageId || null,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Добавляем ответственных
      const assigneesData = assigneeList.map(user_id => ({
        task_id: task.id,
        user_id,
        assigned_by: user.id,
      }));

      const { error: assignError } = await supabase
        .from('task_assignees')
        .insert(assigneesData);

      if (assignError) throw assignError;

      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка создания задачи');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setAssignees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
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
