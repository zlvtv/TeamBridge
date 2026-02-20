import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../../ui/modal/modal';
import Input from '../../ui/input/input';
import Button from '../../ui/button/button';
import styles from './create-organization-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({ isOpen, onClose }) => {
  const { createOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setFocus = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setError(null);
      setIsCreating(false); 
      setTimeout(setFocus, 0);
    } else {
      setIsCreating(false);
      setError(null);
    }
  }, [isOpen, setFocus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название организации');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createOrganization({
        name: name.trim(),
        description: description.trim(),
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать организацию');
      setIsCreating(false); 
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCreating ? "Создание организации..." : "Создать организацию"}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="org-name" className={styles.label}>Название организации</label>
          <Input
            id="org-name"
            placeholder="Введите название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            error={error}
            disabled={isCreating}
            ref={inputRef}
          />
          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>

        <div className={styles.field}>
          <label htmlFor="org-description" className={styles.label}>Описание (опционально)</label>
          <Input
            id="org-description"
            placeholder="Расскажите, чем занимается организация"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            textarea
            disabled={isCreating}
          />
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} type="button" disabled={isCreating}>
            Закрыть
          </Button>
          <Button type="submit" variant="primary" disabled={isCreating}>
            {isCreating ? 'Создание...' : 'Создать'}
          </Button>
        </div>

        {isCreating && (
          <div className={styles.creatingFeedback}>
            <small>Создаём организацию…</small>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default CreateOrganizationModal;
