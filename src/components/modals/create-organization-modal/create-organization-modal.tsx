import React, { useState, useEffect } from 'react';
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
  const { createOrganization, setCurrentOrganization, organizations } = useOrganization();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название организации');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createOrganization({ name: name.trim(), description: description.trim() });

      setTimeout(() => {
        const newOrg = organizations.find((org) => org.name === name.trim());
        if (newOrg) {
          setCurrentOrganization(newOrg);
        }
      }, 100);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать организацию');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Создать организацию">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="org-name" className={styles.label}>Название организации</label>
          <Input
            id="org-name"
            placeholder="Введите название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            error={error}
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
          />
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} type="button">
            Закрыть
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateOrganizationModal;
