// src/components/modals/profile-modal/profile-modal.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useUI } from '../../../contexts/UIContext';
import styles from './profile-modal.module.css';

const ProfileModal: React.FC = () => {
  const { closeProfile } = useUI();
  const { user, signOut } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Обновляем позицию при монтировании
  useEffect(() => {
    const updatePosition = () => {
      const button = document.querySelector('[data-profile-button]') as HTMLButtonElement;
      if (button) {
        const rect = button.getBoundingClientRect();
        const top = rect.bottom - 200; // Пример высоты модалки
        const left = rect.right + 8;
        setPosition({ top, left });
      }
    };

    updatePosition();
    const timer = setTimeout(updatePosition, 50);
    return () => clearTimeout(timer);
  }, []);

  // 🔥 Закрытие: по клику вне И по Esc
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
      if (e.key === 'Escape') {
        closeProfile();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeProfile]);

  // Обработчик выхода
  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      closeProfile();
    } catch (err) {
      console.error('Ошибка при выходе:', err);
      setIsLoading(false);
    }
  };

  if (!position) {
    return null;
  }

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
            {user?.full_name
              ? user.full_name
              : user?.username
              ? user.username
              : user?.email?.split('@')[0] || 'Без имени'}
          </p>
          <p>
            <strong>Email:</strong> {user?.email || 'Не указан'}
          </p>
        </div>

        <div className={styles['profile-modal__footer']}>
          {/* ✅ Кнопка "Закрыть" удалена */}
          <button
            className={`${styles['profile-modal__btn']} ${styles['profile-modal__btn_logout']}`}
            onClick={handleSignOut}
            disabled={isLoading}
          >
            {isLoading ? 'Выход...' : 'Выйти'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
