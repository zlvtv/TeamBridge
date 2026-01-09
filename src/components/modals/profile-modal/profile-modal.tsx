import React, { useRef, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useUI } from '../../../contexts/UIContext';
import styles from './profile-modal.module.css';

const ProfileModal: React.FC = () => {
  const { closeProfile } = useUI();
  const { user, signOut } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      const button = document.querySelector('[data-profile-button]') as HTMLButtonElement;
      if (button) {
        const rect = button.getBoundingClientRect();
        const top = rect.bottom - 200;
        const left = rect.right + 8;
        setPosition({ top, left });
      }
    };

    updatePosition();
    const timer = setTimeout(updatePosition, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const button = document.querySelector('[data-profile-button]');
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        !button?.contains(e.target as Node)
      ) {
        closeProfile();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeProfile();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeProfile]);

  const handleSignOut = async () => {
    await signOut();
    closeProfile();
  };

  if (!position) return null;

  return (
    <div
      ref={modalRef}
      className={styles['profile-modal']}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '240px',
        zIndex: 1000,
      }}
      role="dialog"
      aria-label="Профиль пользователя"
    >
      <div className={styles['profile-modal__content']}>
        <div className={styles['profile-modal__header']}>
          <h3>Профиль</h3>
        </div>

        <div className={styles['profile-modal__body']}>
          <p>
            <strong>Имя:</strong>{' '}
            {user?.full_name || user?.username || user?.email?.split('@')[0] || 'Аноним'}
          </p>
          <p>
            <strong>Email:</strong> {user?.email || '—'}
          </p>
        </div>

        <div className={styles['profile-modal__footer']}>
          <button
            className={`${styles['profile-modal__btn']} ${styles['profile-modal__btn_logout']}`}
            onClick={handleSignOut}
            aria-label="Выйти из аккаунта"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
