import React, { useState } from 'react';
import Modal from '@/components/ui/modal/modal';
import Button from '../../ui/button/button';
import { useAuth } from '../../../contexts/AuthContext';
import styles from './delete-account-modal.module.css';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
  const { deleteCurrentUserAccount, signOut } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    const result = await deleteCurrentUserAccount();
    setIsDeleting(false);

    if (!result.success) {
      setError(result.message || 'Не удалось удалить аккаунт');
      return;
    }

    onClose();
    await signOut();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Удалить аккаунт"
      maxWidth={520}
      overlayClassName={styles['delete-account-modal__overlay']}
      disableOutsideClick={isDeleting}
      disableEscape={isDeleting}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p>Вы действительно хотите удалить свой аккаунт?</p>
        <p>Это действие нельзя отменить. Профиль и связанные пользовательские данные будут удалены.</p>
        <p>Во всех организациях и проектах сохраненная история может остаться, но ваш профиль станет недоступен.</p>
        {error ? (
          <div style={{ color: 'var(--color-danger)', fontSize: '0.92rem' }}>{error}</div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Отмена
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={isDeleting}>
            Удалить
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteAccountModal;
