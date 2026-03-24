import React, { useMemo, useState } from 'react';
import styles from './emoji-picker.module.css';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  position: { bottom: number; left: number };
}

const emojiGroups: Record<string, string[]> = {
  'Смайлы': ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😉', '😊', '🙂', '🙃', '😉', '😍', '😘', '🥰', '😎', '🤩', '🤔'],
  'Жесты': ['👍', '👎', '👌', '👏', '🙌', '🤝', '🙏', '💪', '👀', '🔥', '✅', '❌', '⚡', '💯', '🎉', '❤️', '💙', '💚'],
  'Работа': ['📌', '📎', '📝', '📣', '📅', '📈', '📉', '💼', '🧠', '🔒', '🔔', '⚙️', '🛠️', '🧩', '🚀', '⏱️', '🏁', '📢'],
};

const emojiAliases: Record<string, string[]> = {
  '😀': ['улыбка', 'радость', 'smile', 'happy'],
  '😁': ['улыбка', 'счастье', 'grin'],
  '😂': ['смех', 'лол', 'laugh'],
  '🤣': ['смех', 'lol', 'rofl'],
  '😅': ['неловко', 'sweat', 'smile'],
  '😉': ['подмигивание', 'wink'],
  '😊': ['милый', 'улыбка', 'blush'],
  '😍': ['любовь', 'love', 'сердце'],
  '😘': ['поцелуй', 'kiss'],
  '😎': ['круто', 'cool', 'sunglasses'],
  '🤔': ['думать', 'think', 'hmm'],
  '👍': ['ок', 'да', 'like', 'up'],
  '👎': ['нет', 'dislike', 'down'],
  '👌': ['окей', 'ok', 'good'],
  '👏': ['аплодисменты', 'clap'],
  '🙌': ['ура', 'hooray', 'hands'],
  '🤝': ['договор', 'сделка', 'deal', 'handshake'],
  '🙏': ['спасибо', 'please', 'pray'],
  '💪': ['сила', 'strong', 'muscle'],
  '👀': ['смотрю', 'look', 'eyes'],
  '🔥': ['огонь', 'fire', 'hot'],
  '✅': ['готово', 'done', 'check'],
  '❌': ['ошибка', 'cancel', 'cross'],
  '⚡': ['быстро', 'быстрее', 'fast', 'lightning'],
  '💯': ['сто', 'perfect', '100'],
  '🎉': ['праздник', 'celebrate', 'party'],
  '📌': ['важно', 'pin'],
  '📎': ['скрепка', 'attachment', 'file'],
  '📝': ['заметка', 'note', 'write'],
  '📣': ['объявление', 'announcement'],
  '📅': ['календарь', 'date', 'schedule'],
  '📈': ['рост', 'growth', 'chart'],
  '📉': ['падение', 'drop', 'chart'],
  '💼': ['работа', 'work', 'briefcase'],
  '🧠': ['идея', 'brain', 'think'],
  '🔒': ['приватно', 'lock', 'secure'],
  '🔔': ['уведомление', 'notification', 'bell'],
  '⚙️': ['настройки', 'settings', 'gear'],
  '🛠️': ['инструменты', 'tools', 'fix'],
  '🚀': ['релиз', 'launch', 'rocket'],
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose, position }) => {
  const [activeGroup, setActiveGroup] = useState<string>('Смайлы');
  const [query, setQuery] = useState('');
  const isCompactViewport = typeof window !== 'undefined' ? window.innerWidth <= 1024 : false;
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('chat_recent_emojis');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 16) : [];
    } catch {
      return [];
    }
  });

  const visibleEmojis = useMemo(() => {
    const source = activeGroup === 'Недавние' ? recent : (emojiGroups[activeGroup] || []);
    const trimmed = query.trim();
    if (!trimmed) return source;
    const q = trimmed.toLowerCase();
    const allEmojis = Object.values(emojiGroups).flat();
    const searchPool = activeGroup === 'Недавние' ? source : Array.from(new Set(allEmojis));
    return searchPool.filter((emoji) => {
      const aliases = emojiAliases[emoji] || [];
      return aliases.some(alias => alias.includes(q)) || emoji.includes(q);
    });
  }, [activeGroup, query, recent]);

  const handleEmojiClick = (emoji: string) => {
    setRecent(prev => {
      const next = [emoji, ...prev.filter(item => item !== emoji)].slice(0, 16);
      localStorage.setItem('chat_recent_emojis', JSON.stringify(next));
      return next;
    });
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
        style={
          isCompactViewport
            ? undefined
            : {
                bottom: position.bottom,
                left: position.left,
                transform: 'translateX(-50%)',
              }
        }
      >
        <div className={styles['emoji-picker__top']}>
          {recent.length > 0 && (
            <button
              className={`${styles['emoji-picker__group']} ${activeGroup === 'Недавние' ? styles['emoji-picker__group--active'] : ''}`}
              onClick={() => setActiveGroup('Недавние')}
              type="button"
            >
              Недавние
            </button>
          )}
          {Object.keys(emojiGroups).map((group) => (
            <button
              key={group}
              className={`${styles['emoji-picker__group']} ${activeGroup === group ? styles['emoji-picker__group--active'] : ''}`}
              onClick={() => setActiveGroup(group)}
              type="button"
            >
              {group}
            </button>
          ))}
        </div>
        <input
          className={styles['emoji-picker__search']}
          placeholder="Поиск эмодзи"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles['emoji-grid']}>
          {visibleEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              type="button"
              className={styles['emoji-button']}
              onClick={() => handleEmojiClick(emoji)}
              aria-label="Выбрать эмоджи"
            >
              {emoji}
            </button>
          ))}
        </div>
        <button type="button" className={styles['close-button']} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
};

export default EmojiPicker;
