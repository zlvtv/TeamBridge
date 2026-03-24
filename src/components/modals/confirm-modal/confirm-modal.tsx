import React, { useState } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Button from '../../ui/button/button';
import styles from './confirm-modal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Подтверждение',
  children,
  confirmText = 'Удалить',
  cancelText = 'Отмена',
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (isConfirming) return;

    try {
      setIsConfirming(true);
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className={styles['confirm-modal__content']}>
        {children}
        <div className={styles['confirm-modal__actions']}>
          <Button variant="secondary" size="medium" onClick={onClose} disabled={isConfirming}>
            {cancelText}
          </Button>
          <Button
            variant="danger"
            size="medium"
            onClick={handleConfirm}
            loading={isConfirming}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
