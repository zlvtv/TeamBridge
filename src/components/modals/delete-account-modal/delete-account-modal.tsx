import React from 'react';
import ConfirmModal from '../confirm-modal/confirm-modal';
import { useAuth } from '../../../contexts/AuthContext';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const handleDelete = async () => {
    onClose();
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Удалить аккаунт"
      confirmText="Удалить"
      cancelText="Отмена"
    >
      <p>Вы действительно хотите удалить свой аккаунт?</p>
      <p>Это действие нельзя отменить. Все ваши данные будут удалены.</p>
      <p>Во всех организациях и проектах ваше имя будет заменено на «Удалённый пользователь».</p>
    </ConfirmModal>
  );
};

export default DeleteAccountModal;
