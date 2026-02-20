import React from 'react';
import './emoji-picker.css';

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
    <div className="emoji-picker-overlay" onClick={handleOutsideClick}>
      <div 
        className="emoji-picker" 
        style={{ 
          bottom: position.bottom, 
          left: position.left,
          transform: 'translateX(-50%)'
        }}
      >
        <div className="emoji-grid">
          {emojis.map((emoji, index) => (
            <button 
              key={index} 
              className="emoji-button" 
              onClick={() => handleEmojiClick(emoji)}
              aria-label="Выбрать эмоджи"
            >
              {emoji}
            </button>
          ))}
        </div>
        <button className="close-button" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
};

export default EmojiPicker;