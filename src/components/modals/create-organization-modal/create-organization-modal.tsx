import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Input from '../../ui/input/input';
import Button from '../../ui/button/button';
import styles from './create-organization-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';

interface Role {
  name: string;
  color: string;
}

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({ isOpen, onClose }) => {
  const { createOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
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
      setRoles([]);
      setError(null);
      setIsCreating(false);
      setTimeout(setFocus, 0);
    } else {
      setIsCreating(false);
      setError(null);
    }
  }, [isOpen, setFocus]);

  const addRole = () => {
    setRoles([...roles, { name: '', color: '#6366f1' }]);
  };

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index));
  };

  const updateRole = (index: number, field: keyof Role, value: string) => {
    const newRoles = [...roles];
    newRoles[index][field] = value;
    setRoles(newRoles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const validRoles = roles.filter(r => r.name.trim());
    const roleNames = validRoles.map(r => r.name.trim());

    if (!trimmedName) {
      setError('Введите название организации');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Название организации должно быть не менее 2 символов');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Название организации не должно превышать 50 символов');
      return;
    }

    if (new Set(roleNames).size !== roleNames.length) {
      setError('Названия ролей должны быть уникальными');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createOrganization({
        name: name.trim(),
        description: description.trim(),
        roles: roles.filter(r => r.name.trim())
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать организацию');
      setIsCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreating ? "Создание организации..." : "Создать организацию"}
      disableOutsideClick={true} 
      disableEscape={false}       
      showCloseButton={true}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="org-name" className={styles.label}>Название организации</label>
          <Input
            id="org-name"
            placeholder="Введите название"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 50))}
            maxLength={50}
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
            onChange={(e) => setDescription(e.target.value.slice(0, 200))}
            maxLength={200}
            textarea
            disabled={isCreating}
          />
        </div>

        <div className={styles.roleFields}>
          <label className={styles.label}>Роли организации</label>
          {roles.map((role, index) => (
            <div key={index} className={styles.roleField}>
              <Input
                className={styles.roleName}
                placeholder="Название роли"
                value={role.name}
                onChange={(e) => updateRole(index, 'name', e.target.value.slice(0, 30))}
                maxLength={30}
                disabled={isCreating}
              />
              <div className={styles.colorPicker}>
                <span style={{ backgroundColor: role.color }}></span>
                <input
                  type="color"
                  value={role.color}
                  onChange={(e) => updateRole(index, 'color', e.target.value)}
                  disabled={isCreating}
                />
              </div>
              {roles.length > 1 && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => removeRole(index)}
                  disabled={isCreating}
                  type="button"
                >
                  Удалить
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="secondary"
            className={styles.addRoleButton}
            onClick={addRole}
            disabled={isCreating}
            type="button"
          >
            + Добавить роль
          </Button>
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
