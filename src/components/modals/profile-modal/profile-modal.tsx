import React, { useState } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import { useAuth } from '../../../contexts/AuthContext';
import { useUI } from '../../../contexts/UIContext';
import Button from '../../ui/button/button';
import styles from './profile-modal.module.css';
import EditProfileModal from '../edit-profile-modal/edit-profile-modal';
import DeleteAccountModal from '../delete-account-modal/delete-account-modal';

const ProfileModal: React.FC = () => {
  const { closeModal } = useUI();
  const { user, signOut } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleNotificationToggle = () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
    } else {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            setNotificationsEnabled(true);
          }
        });
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      closeModal('profile');
    }
  };

  const closeProfile = () => closeModal('profile');

  return (
    <>
      <Modal
        isOpen={true}
        onClose={closeProfile}
        title="Профиль"
        maxWidth={520}
      >
        <div className={styles['profile-modal__content']}>
          <div className={styles['profile-modal__body']}>
            <div className={styles['profile-modal__hero']}>
              <div className={styles['profile-modal__avatar']}>
                {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>{(user?.full_name || user?.username || 'П').charAt(0).toUpperCase()}</span>}
              </div>
              <div className={styles['profile-modal__identity']}>
                <strong>{user?.full_name || 'Без имени'}</strong>
                <span>@{user?.username || 'username'}</span>
                <span>{user?.email || '—'}</span>
              </div>
            </div>

            <div className={styles['profile-modal__infoCard']}>
              <div className={styles['profile-modal__infoRow']}>
                <span>Никнейм</span>
                <strong>@{user?.username || '—'}</strong>
              </div>
              <div className={styles['profile-modal__infoRow']}>
                <span>Полное имя</span>
                <strong>{user?.full_name || '—'}</strong>
              </div>
              <div className={styles['profile-modal__infoRow']}>
                <span>Почта</span>
                <strong>{user?.email || '—'}</strong>
              </div>
            </div>

            <div className={styles['profile-modal__notifications']}>
              <label className={styles['profile-modal__checkbox']}>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={handleNotificationToggle}
                />
                Разрешить браузерные уведомления
              </label>
            </div>

            <div className={styles['profile-modal__actions']}>
              <Button
                variant="primary"
                onClick={() => setIsEditModalOpen(true)}
              >
                Редактировать
              </Button>
              <Button
                variant="danger"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Удалить
              </Button>
            </div>
          </div>

          <div className={styles['profile-modal__footer']}>
            <Button variant="danger" onClick={handleSignOut}>
              Выйти
            </Button>
          </div>
        </div>
      </Modal>

      {isEditModalOpen && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteAccountModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
        />
      )}
    </>
  );
};

export default ProfileModal;
