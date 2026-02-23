import React from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Button from '../../ui/button/button';
import styles from './confirm-modal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className={styles['confirm-modal__content']}>
        {children}
        <div className={styles['confirm-modal__actions']}>
          <Button variant="secondary" size="medium" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant="danger"
            size="medium"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
