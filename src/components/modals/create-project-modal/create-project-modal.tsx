import React, { useState } from 'react';
import styles from './create-project-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useProject } from '../../../contexts/ProjectContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { currentOrganization } = useOrganization();
  const { createProject } = useProject();
  const { closeCreateProject } = useUI();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderId, setLeaderId] = useState<string>(user?.id || '');
  const [includeAllMembers, setIncludeAllMembers] = useState(false);
  const [includeMe, setIncludeMe] = useState(true);
  const [autoAddByTags, setAutoAddByTags] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const members = currentOrganization?.organization_members || [];
  const tags = currentOrganization?.tags || [];

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const filteredMembers = members.filter(member => {
    const fullName = member.user?.full_name?.toLowerCase() || '';
    const username = member.user?.username?.toLowerCase() || '';
    const email = member.user?.email?.toLowerCase() || '';
    const searchTermLower = searchTerm.toLowerCase();
    return fullName.includes(searchTermLower) || 
           username.includes(searchTermLower) || 
           email.includes(searchTermLower);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !currentOrganization) return;
    
    await createProject(
      name,
      description
    );
    
    setName('');
    setDescription('');
    setLeaderId(user?.id || '');
    setIncludeAllMembers(false);
    setIncludeMe(true);
    setAutoAddByTags(true);
    setSelectedTags([]);
    setSearchTerm('');
    
    onClose();
    closeCreateProject();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>Создать проект</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Название проекта *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Введите название проекта"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Введите описание проекта"
              rows={3}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Руководитель проекта</label>
            <div className={styles.searchContainer}>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Поиск участников..."
                className={styles.searchInput}
              />
            </div>
            <select
              value={leaderId}
              onChange={e => setLeaderId(e.target.value)}
              className={styles.leaderSelect}
            >
              {filteredMembers.map(member => (
                <option key={member.user_id} value={member.user_id}>
                  {member.user?.full_name || member.user?.username || 'Пользователь'}
                </option>
              ))}
            </select>
          </div>
          
          <div className={styles.checkboxGroup}>
            <label>
              <input
                type="checkbox"
                checked={includeAllMembers}
                onChange={e => setIncludeAllMembers(e.target.checked)}
              />
              Добавить всех участников организации
            </label>
          </div>
          
          {!includeAllMembers && (
            <div className={styles.checkboxGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={includeMe}
                  onChange={e => setIncludeMe(e.target.checked)}
                />
                Добавить меня в проект
              </label>
            </div>
          )}
          
          <div className={styles.checkboxGroup}>
            <label>
              <input
                type="checkbox"
                checked={autoAddByTags}
                onChange={e => setAutoAddByTags(e.target.checked)}
              />
              Автоматически добавлять участников по тегам
            </label>
          </div>
          
          {autoAddByTags && (
            <div className={styles.formGroup}>
              <label>Теги проекта</label>
              <div className={styles.tagsContainer}>
                {tags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`${styles.tag} ${selectedTags.includes(tag) ? styles.selected : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Отмена
            </button>
            <button type="submit" className={styles.createButton}>
              Создать проект
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;