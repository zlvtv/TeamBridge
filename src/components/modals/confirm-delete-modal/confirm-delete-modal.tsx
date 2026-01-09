import React, { useRef, useState } from 'react';
import Modal from '../../ui/modal/modal';
import Button from '../../ui/button/button';
import styles from './confirm-delete-modal.module.css';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Подтвердите действие',
  message = 'Вы уверены?',
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger = true,
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error('Ошибка при подтверждении:', err);
      alert('Ошибка: ' + (err as Error).message);
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} disableOutsideClick={false}>
      <div className={styles.content}>
        <p>{message}</p>
      </div>
      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isConfirming}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? 'danger' : 'primary'}
          onClick={handleConfirm}
          ref={confirmButtonRef}
          disabled={isConfirming}
        >
          {isConfirming ? 'Удаление...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteModal;