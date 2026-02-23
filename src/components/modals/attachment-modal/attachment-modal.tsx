import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useProject } from '../../../contexts/ProjectContext';
import Button from '../../ui/button/button';
import styles from './attachment-modal.module.css';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOptionSelect: (type: 'photo' | 'poll' | 'task') => void;
  position: {
    bottom?: number;
    left?: number;
  };
}

const AttachmentModal: React.FC<AttachmentModalProps> = ({
  isOpen,
  onClose,
  onOptionSelect,
  position
}) => {
  const { user } = useAuth();
  const { currentProject } = useProject();

  const canManageTasks = () => {
    if (!user || !currentProject) return false;
    const member = currentProject.members.find(m => m.user_id === user.id);
    return member?.status === 'owner' || member?.status === 'admin';
  };

  const handleOptionClick = (type: 'photo' | 'poll' | 'task') => {
    onOptionSelect(type);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles['attachment-modal__overlay']}
      onClick={onClose}
    >
      <div
        className={styles['attachment-modal__options']}
        style={{
          bottom: position.bottom,
          left: position.left,
          transform: 'translateX(-50%)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          className={styles['attachment-modal__option']}
          onClick={() => handleOptionClick('photo')}
        >
          Фото
        </Button>
        <Button
          variant="ghost"
          className={styles['attachment-modal__option']}
          onClick={() => handleOptionClick('poll')}
        >
          Опрос
        </Button>
        {canManageTasks() && (
          <Button
            variant="ghost"
            className={styles['attachment-modal__option']}
            onClick={() => handleOptionClick('task')}
          >
            Задача
          </Button>
        )}
      </div>
    </div>
  );
};

export default AttachmentModal;
