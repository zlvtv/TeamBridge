// src/components/modals/create-project-modal/create-project-modal.tsx
import React, { useState } from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import { useOrganization } from '../../../contexts/OrganizationContext';
import Modal from '../../ui/modal/modal';
import Input from '../../ui/input/input';
import Button from '../../ui/button/button';
import styles from './create-project-modal.module.css';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { createProject } = useProject();
  const { currentOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (!currentOrganization) {
      setError('Нет активной организации');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createProject({
        name: name.trim(),
        description: description.trim(),
        organization_id: currentOrganization.id,
        color: '#3B82F6', // синий по умолчанию
      });
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать проект');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Создать проект">
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}

        <label htmlFor="project-name" className={styles.label}>
          Название
        </label>
        <Input
          id="project-name"
          type="text"
          placeholder="Введите название проекта"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          disabled={isCreating}
        />

        <label htmlFor="project-description" className={styles.label}>
          Описание (опционально)
        </label>
        <Input
          id="project-description"
          type="text"
          placeholder="Кратко о задачах и целях"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isCreating}
          textarea
        />

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isCreating}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateProjectModal;
