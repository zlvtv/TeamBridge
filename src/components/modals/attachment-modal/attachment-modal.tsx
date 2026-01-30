import React from 'react';

import styles from './attachment-modal.module.css';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOptionSelect: (type: 'photo' | 'poll' | 'task') => void;
  position: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

const AttachmentModal: React.FC<AttachmentModalProps> = ({
  isOpen,
  onClose,
  onOptionSelect,
  position
}) => {
  const handleOptionClick = (type: 'photo' | 'poll' | 'task') => {
    onOptionSelect(type);
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles['attachment-overlay']}
      onClick={onClose}
    >
      <div className={styles['attachment-modal-options']} style={{ position: 'fixed', bottom: position.bottom, left: position.left, transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>
        <div
          className={styles['attachment-option']}
          onClick={() => handleOptionClick('photo')}
        >
          <span>Фото</span>
        </div>
        <div
          className={styles['attachment-option']}
          onClick={() => handleOptionClick('poll')}
        >
          <span>Опрос</span>
        </div>
        <div
          className={styles['attachment-option']}
          onClick={() => {
            console.log('Task option clicked');
            handleOptionClick('task');
          }}
        >
          <span>Задача</span>
        </div>
      </div>
    </div>
  );
};

export default AttachmentModal;