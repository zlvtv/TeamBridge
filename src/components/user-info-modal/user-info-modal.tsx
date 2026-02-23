import React, { useRef, useEffect } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import styles from './user-info-modal.module.css';

interface UserInfoModalProps {
  user: {
    full_name?: string;
    email: string;
    avatar_url?: string | null;
    description?: string;
    roles?: string[];
  };
  position: { x: number; y: number };
  onClose: () => void;
}

const UserInfoModal: React.FC<UserInfoModalProps> = ({ user, position, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getInitials = () => {
    return user.full_name?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <div
      ref={modalRef}
      className={styles['user-info-modal']}
      style={{
        position: 'absolute',
        top: `${position.y}px`,
        left: `${position.x}px`,
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
      </div>

      <div className={styles['user-info-modal__body']}>
        <h3 className={styles['user-info-modal__name']}>{user.full_name}</h3>
        <p className={styles['user-info-modal__email']}>{user.email}</p>
        {user.description && (
          <p className={styles['user-info-modal__description']}>{user.description}</p>
        )}
        {user.roles && user.roles.length > 0 && (
          <div className={styles['user-info-modal__roles']}>
            <strong>Роли:</strong>
            {user.roles.map((role, index) => (
              <span key={index} className={styles['user-info-modal__role']}>
                {role}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserInfoModal;
