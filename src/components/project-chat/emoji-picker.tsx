import React from 'react';
import Button from '../ui/button/button';
import styles from './emoji-picker.module.css';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  position: { bottom: number; left: number };
}

const emojis = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
  '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗',
  '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥',
  '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜',
  '😝', '🤑', '🤗', '🤭', '🤫', '🤥', '😶‍🌫️', '😐', '😑', '🙄',
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose, position }) => {
  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles['emoji-picker-overlay']} onClick={handleOutsideClick}>
      <div 
        className={styles['emoji-picker']} 
        style={{ 
          bottom: position.bottom, 
          left: position.left,
          transform: 'translateX(-50%)'
        }}
      >
        <div className={styles['emoji-grid']}>
          {emojis.map((emoji, index) => (
            <Button
              key={index}
              variant="ghost"
              className={styles['emoji-button']}
              onClick={() => handleEmojiClick(emoji)}
              aria-label="Выбрать эмоджи"
            >
              {emoji}
            </Button>
          ))}
        </div>
        <Button variant="secondary" className={styles['close-button']} onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </div>
  );
};

export default EmojiPicker;
