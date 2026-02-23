import React, { useState } from 'react';
import Modal from '../../ui/modal/Modal';
import { useAuth } from '../../../contexts/AuthContext';
import { useUI } from '../../../contexts/UIContext';
import Button from '../../ui/button/button';
import Input from '../../ui/input/input';
import styles from './profile-modal.module.css';
import EditProfileModal from '../edit-profile-modal/edit-profile-modal';
import DeleteAccountModal from '../delete-account-modal/delete-account-modal';
import { useModalPosition } from '../../../hooks/useModalPosition';

const ProfileModal: React.FC = () => {
  const { closeProfile } = useUI();
  const { user, signOut } = useAuth();

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const { position, isVisible } = useModalPosition({
    referenceRef: buttonRef,
    modalWidth: 240,
  });

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
      closeProfile();
    }
  };

  if (!isVisible) return null;

  return (
    <>
      <Modal
        isOpen={true}
        onClose={closeProfile}
        style={{ ...position, minWidth: '240px' }}
        showCloseButton={false}
        usePortal={true}
      >
        <div className={styles['profile-modal__content']}>
          <div className={styles['profile-modal__header']}>
            <h3>Профиль</h3>
          </div>

          <div className={styles['profile-modal__body']}>
            <div className={styles['profile-modal__avatar']}>👤</div>
            <p>
              <strong>Имя пользователя:</strong> {user?.username || '—'}
            </p>
            <p>
              <strong>Полное имя:</strong> {user?.full_name || '—'}
            </p>
            <p>
              <strong>Email:</strong> {user?.email || '—'}
            </p>
            <p>
              <strong>Уведомления:</strong>
            </p>
            <div className={styles['profile-modal__notifications']}>
              <label className={styles['profile-modal__checkbox']}>
                <Input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={handleNotificationToggle}
                  style={{ marginRight: '8px' }}
                />
                Разрешить браузерные уведомления
              </label>
            </div>
            <div className={styles['profile-modal__actions']}>
              <Button
                variant="primary"
                size="small"
                fullWidth
                onClick={() => setIsEditModalOpen(true)}
              >
                Редактировать
              </Button>
              <Button
                variant="danger"
                size="small"
                fullWidth
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Удалить
              </Button>
            </div>
          </div>

          <div className={styles['profile-modal__footer']}>
            <Button variant="danger" size="small" fullWidth onClick={handleSignOut}>
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
