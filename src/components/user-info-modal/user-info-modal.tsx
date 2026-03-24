import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './user-info-modal.module.css';
import { isDeletedUserProfile } from '../../utils/user.utils';

const DEFAULT_NOTE_LIMIT = 280;

interface UserInfoModalProps {
  user: {
    id?: string;
    full_name?: string;
    username?: string;
    email: string;
    avatar_url?: string | null;
    description?: string;
    roles?: Array<string | { name: string; color?: string }>;
  };
  position?: { x: number; y: number } | null;
  mode?: 'popover' | 'center';
  onClose: () => void;
}

const normalizeRoles = (roles: UserInfoModalProps['user']['roles']) =>
  (roles || []).map((role) =>
    typeof role === 'string'
      ? { name: role, color: undefined }
      : { name: role.name, color: role.color }
  );

const UserInfoModal: React.FC<UserInfoModalProps> = ({ user, position = null, mode = 'popover', onClose }) => {
  const { user: currentUser } = useAuth();
  const deletedUser = isDeletedUserProfile(user);
  const modalRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState(position || { x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [note, setNote] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const noteStorageKey = useMemo(() => {
    const targetId = user.id || user.username || user.email;
    if (!currentUser?.id || !targetId) return null;
    return `teambridge:private-member-note:${currentUser.id}:${targetId}`;
  }, [currentUser?.id, user.email, user.id, user.username]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (mode === 'center' || !position) return;
    const width = 340;
    const margin = 12;
    const clampedX = Math.max(margin + width / 2, Math.min(position.x, window.innerWidth - margin - width / 2));
    const clampedY = Math.max(80, position.y);
    setCoords({ x: clampedX, y: clampedY });
  }, [mode, position?.x, position?.y]);

  useEffect(() => {
    if (!noteStorageKey) {
      setNote('');
      setNoteLimit(DEFAULT_NOTE_LIMIT);
      setIsLoaded(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(noteStorageKey);
      if (!raw) {
        setNote('');
      } else {
        const parsed = JSON.parse(raw);
        setNote(typeof parsed?.content === 'string' ? parsed.content.slice(0, DEFAULT_NOTE_LIMIT) : '');
      }
    } catch {
      setNote('');
    } finally {
      setIsLoaded(true);
      setSaveState('idle');
      setIsEditingNote(false);
    }
  }, [noteStorageKey]);

  useEffect(() => {
    if (!noteStorageKey || !isLoaded) return;

    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          noteStorageKey,
          JSON.stringify({
            content: note.trim(),
            updatedAt: new Date().toISOString(),
          })
        );
        setSaveState('saved');
        window.setTimeout(() => setSaveState('idle'), 1200);
      } catch {
        setSaveState('idle');
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [isLoaded, note, noteStorageKey]);

  const getInitials = () => {
    if (deletedUser) return 'У';
    return user.full_name?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || 'U';
  };

  const handleNoteChange = (value: string) => {
    setNote(value.slice(0, DEFAULT_NOTE_LIMIT));
  };

  const notePlaceholder = 'Нажмите, чтобы оставить личную заметку об участнике. Ее видите только вы.';
  const normalizedRoles = normalizeRoles(user.roles);

  if (mode === 'center') {
    return (
      <div className={styles['user-info-modal__overlay']} onClick={onClose}>
        <div
          ref={modalRef}
          className={styles['user-info-modal']}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles['user-info-modal__header']}>
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Avatar"
                className={styles['user-info-modal__avatar']}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className={styles['user-info-modal__fallback']}>{getInitials()}</span>
            )}
            <div className={styles['user-info-modal__info']}>
              <h3 className={styles['user-info-modal__name']}>{user.full_name || 'Пользователь'}</h3>
              {user.username && !deletedUser && (
                <p className={styles['user-info-modal__email']}>@{user.username}</p>
              )}
            </div>
          </div>
          <div className={styles['user-info-modal__body']}>
            {user.description && (
              <p className={styles['user-info-modal__description']}>{user.description}</p>
            )}
            {user.email ? (
              <a
                href={`mailto:${user.email}`}
                className={styles['user-info-modal__email']}
              >
                {user.email}
              </a>
            ) : null}
            {normalizedRoles.length > 0 && (
              <div className={styles['user-info-modal__roles']}>
                <strong className={styles['user-info-modal__roles-label']}>Роли</strong>
                {normalizedRoles.map((role, index) => (
                  <span
                    key={`${role.name}-${index}`}
                    className={styles['user-info-modal__role']}
                    style={role.color ? { background: `${role.color}20`, color: role.color, borderColor: `${role.color}55` } : undefined}
                  >
                    {role.name}
                  </span>
                ))}
              </div>
            )}

            <div className={styles['user-info-modal__notes']}>
              <div className={styles['user-info-modal__notes-header']}>
                <strong>Личная заметка</strong>
              </div>
              {isEditingNote ? (
                <textarea
                  className={styles['user-info-modal__notes-textarea']}
                  value={note}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder={notePlaceholder}
                  rows={5}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className={`${styles['user-info-modal__notes-preview']} ${!note ? styles['user-info-modal__notes-preview--empty'] : ''}`}
                  onClick={() => setIsEditingNote(true)}
                >
                  {note || notePlaceholder}
                </button>
              )}
              <div className={styles['user-info-modal__notes-footer']}>
                <span>{note.length}/{DEFAULT_NOTE_LIMIT}</span>
                <span>{saveState === 'saved' ? 'Сохранено' : 'Автосохранение'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={modalRef}
      className={styles['user-info-modal']}
      style={{
        position: 'absolute',
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        transform: 'translateX(-50%) translateY(calc(-100% + -8px))',
        zIndex: 10010,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles['user-info-modal__header']}>
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt="Avatar"
            className={styles['user-info-modal__avatar']}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          
        ) : (
          <span className={styles['user-info-modal__fallback']}>{getInitials()}</span>
        )}
        <div className={styles['user-info-modal__info']}>
          <h3 className={styles['user-info-modal__name']}>{user.full_name || 'Пользователь'}</h3>
          {user.username && !deletedUser && (
            <p className={styles['user-info-modal__email']}>@{user.username}</p>
          )}
        </div>
      </div>

      <div className={styles['user-info-modal__body']}>
                {user.description && (
          <p className={styles['user-info-modal__description']}>{user.description}</p>
        )}

        {user.email ? (
          <a
              href={`mailto:${user.email}`}
              className={styles['user-info-modal__email']}
            >
              {user.email}
            </a>
        ) : null}

        {normalizedRoles.length > 0 && (
          <div className={styles['user-info-modal__roles']}>
            <strong className={styles['user-info-modal__roles-label']}>Роли</strong>
            {normalizedRoles.map((role, index) => (
              <span
                key={`${role.name}-${index}`}
                className={styles['user-info-modal__role']}
                style={role.color ? { background: `${role.color}20`, color: role.color, borderColor: `${role.color}55` } : undefined}
              >
                {role.name}
              </span>
            ))}
          </div>
        )}

        <div className={styles['user-info-modal__notes']}>
          <div className={styles['user-info-modal__notes-header']}>
            <strong>Личная заметка</strong>
          </div>
          {isEditingNote ? (
            <textarea
              className={styles['user-info-modal__notes-textarea']}
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder={notePlaceholder}
              rows={4}
              autoFocus
            />
          ) : (
            <button
              type="button"
              className={`${styles['user-info-modal__notes-preview']} ${!note ? styles['user-info-modal__notes-preview--empty'] : ''}`}
              onClick={() => setIsEditingNote(true)}
            >
              {note || notePlaceholder}
            </button>
          )}
          <div className={styles['user-info-modal__notes-footer']}>
            <span>{note.length}/{DEFAULT_NOTE_LIMIT}</span>
            <span>{saveState === 'saved' ? 'Сохранено' : 'Автосохранение'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfoModal;
