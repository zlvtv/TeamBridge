import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Input from '../../ui/input/input';
import Button from '../../ui/button/button';
import styles from './edit-profile-modal.module.css';
import { useAuth } from '../../../contexts/AuthContext';
import { setNotificationsEnabled } from '../../notifications-panel/notifications-panel';
import ConfirmationModal from '../../ui/confirmation-modal/confirmation-modal';
import {
  sanitizeUsernameInput,
  validateFullName,
  validateProfileDescription,
  validateUsername,
  USERNAME_MAX_LENGTH,
} from '../../../utils/profileValidation';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, checkUsernameAvailability, updateCurrentUserProfile, deleteCurrentUserAccount, signOut } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.description || '');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUsername(user?.username || '');
    setFullName(user?.full_name || '');
    setBio(user?.description || '');
    setAvatar(null);
    setError(null);
    setUsernameStatus(null);
    setIsSubmitting(false);
    setRemoveAvatar(false);
    const savedNotificationsPreference = localStorage.getItem('browserNotificationsEnabled') === 'true';
    const allowedByBrowser = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    const nextValue = savedNotificationsPreference && allowedByBrowser;
    setNotificationsEnabledState(nextValue);
    setNotificationsEnabled(nextValue);
  }, [isOpen, user?.username, user?.full_name, user?.description]);

  const avatarPreview = useMemo(() => {
    if (removeAvatar) return null;
    if (avatar) return URL.createObjectURL(avatar);
    return user?.avatar_url || null;
  }, [avatar, removeAvatar, user?.avatar_url]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatar) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview, avatar]);

  const handleUsernameBlur = async () => {
    const trimmedUsername = username.trim();
    const validationError = validateUsername(trimmedUsername);

    if (validationError) {
      setUsernameStatus(validationError);
      return;
    }

    if (trimmedUsername.toLowerCase() === (user?.username || '').trim().toLowerCase()) {
      setUsernameStatus('Текущий никнейм');
      return;
    }

    setIsCheckingUsername(true);
    const result = await checkUsernameAvailability(trimmedUsername);
    setUsernameStatus(result.available ? 'Никнейм доступен' : result.message || 'Никнейм занят');
    setIsCheckingUsername(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const usernameError = validateUsername(username);
    const fullNameError = validateFullName(fullName);
    const descriptionError = validateProfileDescription(bio);

    if (usernameError || fullNameError || descriptionError) {
      setError(usernameError || fullNameError || descriptionError || 'Некорректные данные профиля');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await updateCurrentUserProfile({
        username,
        fullName,
        description: bio,
        avatarFile: avatar,
        removeAvatar,
      });

      if (!result.success) {
        if ((result.message || '').includes('Имя пользователя уже занято')) {
          setUsernameStatus(result.message || 'Имя пользователя уже занято');
          setError(null);
          return;
        }
        setError(result.message || 'Не удалось обновить профиль');
        return;
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotificationsToggle = async () => {
    if (notificationsEnabled) {
      setError(null);
      setNotificationsEnabledState(false);
      setNotificationsEnabled(false);
      localStorage.setItem('browserNotificationsEnabled', 'false');
      return;
    }

    if (typeof Notification === 'undefined') {
      setError('Браузерные уведомления не поддерживаются в этом браузере');
      return;
    }

    if (Notification.permission === 'granted') {
      setError(null);
      setNotificationsEnabledState(true);
      setNotificationsEnabled(true);
      localStorage.setItem('browserNotificationsEnabled', 'true');
      return;
    }

    if (Notification.permission === 'denied') {
      setError('Разрешение на уведомления заблокировано в браузере');
      return;
    }

    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    setNotificationsEnabledState(enabled);
    setNotificationsEnabled(enabled);
    localStorage.setItem('browserNotificationsEnabled', enabled ? 'true' : 'false');
    if (enabled) {
      setError(null);
    } else {
      setError('Разрешение на уведомления не было предоставлено');
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setError(null);

    try {
      const result = await deleteCurrentUserAccount();
      if (!result.success) {
        setError(result.message || 'Не удалось удалить аккаунт');
        return;
      }

      setIsDeleteModalOpen(false);
      onClose();
      window.location.replace('/login');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Настройки профиля"
      maxWidth={560}
      disableOutsideClick={isDeleteModalOpen}
      disableEscape={isDeleteModalOpen}
    >
      <form onSubmit={handleSubmit} className={styles['edit-profile-modal__form']}>
        <div className={styles['edit-profile-modal__hero']}>
          <div className={styles['edit-profile-modal__avatar-preview']}>
            {avatarPreview ? <img src={avatarPreview} alt="" /> : <span>{(fullName || username || 'П').charAt(0).toUpperCase()}</span>}
          </div>
          <div className={styles['edit-profile-modal__heroText']}>
            <strong>{fullName.trim() || username.trim() || 'Профиль'}</strong>
            <span>{user?.email || '—'}</span>
          </div>
        </div>

        <div className={styles['edit-profile-modal__field']}>
          <label htmlFor="username" className={styles['edit-profile-modal__label']}>
            Имя пользователя
          </label>
          <Input
            id="username"
            placeholder="Введите имя пользователя"
            value={username}
            onChange={(e) => {
              setUsername(sanitizeUsernameInput(e.target.value));
              setUsernameStatus(null);
            }}
            onBlur={handleUsernameBlur}
            required
            disabled={isSubmitting}
          />
          <div className={styles['edit-profile-modal__meta']}>
            <span>{isCheckingUsername ? 'Проверяем доступность...' : usernameStatus || '3-30 символов, буквы, цифры, _, -'}</span>
            <span>{username.trim().length}/{USERNAME_MAX_LENGTH}</span>
          </div>
        </div>

        <div className={styles['edit-profile-modal__field']}>
          <label htmlFor="full-name" className={styles['edit-profile-modal__label']}>
            Полное имя
          </label>
          <Input
            id="full-name"
            placeholder="Введите полное имя"
            value={fullName}
            onChange={(e) => setFullName(e.target.value.slice(0, 60))}
            disabled={isSubmitting}
          />
        </div>

        <div className={styles['edit-profile-modal__field']}>
          <label htmlFor="bio" className={styles['edit-profile-modal__label']}>
            Описание профиля
          </label>
          <Input
            id="bio"
            placeholder="Расскажите о себе"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 240))}
            textarea
            resize="none"
            disabled={isSubmitting}
          />
          <div className={styles['edit-profile-modal__meta']}>
            <span>Описание профиля</span>
            <span>{bio.length}/240</span>
          </div>
        </div>

        <div className={styles['edit-profile-modal__field']}>
          <label className={styles['edit-profile-modal__label']}>
            Email
          </label>
          <div className={styles['edit-profile-modal__static']}>
            {user?.email || '—'}
          </div>
        </div>

        <div className={styles['edit-profile-modal__field']}>
          <label htmlFor="avatar" className={styles['edit-profile-modal__label']}>
            Аватар
          </label>
          <input
            id="avatar"
            type="file"
            accept="image/*"
            onChange={(e) => {
              setAvatar(e.target.files?.[0] || null);
              setRemoveAvatar(false);
            }}
            className={styles['edit-profile-modal__file-input']}
            disabled={isSubmitting}
          />
          {(user?.avatar_url || avatarPreview) ? (
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => {
                setAvatar(null);
                setRemoveAvatar(true);
              }}
              disabled={isSubmitting}
            >
              Удалить аватар
            </Button>
          ) : null}
        </div>

        <div className={styles['edit-profile-modal__settingsCard']}>
          <button
            type="button"
            className={styles['edit-profile-modal__settingRow']}
            onClick={handleNotificationsToggle}
          >
            <div className={styles['edit-profile-modal__settingText']}>
              <strong>Браузерные уведомления</strong>
              <span>{notificationsEnabled ? 'Разрешены' : 'Отключены'}</span>
            </div>
            <span className={styles['edit-profile-modal__settingValue']}>
              {notificationsEnabled ? 'Вкл' : 'Выкл'}
            </span>
          </button>
          <button
            type="button"
            className={styles['edit-profile-modal__settingRow']}
            onClick={async () => {
              onClose();
              await signOut();
            }}
          >
            <div className={styles['edit-profile-modal__settingText']}>
              <strong>Выйти из профиля</strong>
              <span>Завершить текущую сессию и вернуться на страницу входа</span>
            </div>
            <span className={styles['edit-profile-modal__settingValue']}>Выйти</span>
          </button>
          <button
            type="button"
            className={`${styles['edit-profile-modal__settingRow']} ${styles['edit-profile-modal__settingRow--danger']}`}
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <div className={styles['edit-profile-modal__settingText']}>
              <strong>Удалить профиль</strong>
              <span>Удаление аккаунта и пользовательских данных</span>
            </div>
            <span className={styles['edit-profile-modal__settingValue']}>Удалить</span>
          </button>
        </div>

        {error ? (
          <div className={styles['edit-profile-modal__error']}>{error}</div>
        ) : null}

        <div className={styles['edit-profile-modal__actions']}>
          <Button variant="secondary" onClick={onClose} type="button" disabled={isSubmitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Удалить аккаунт?"
        description="Это действие нельзя отменить. Профиль и связанные пользовательские данные будут удалены."
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={handleDeleteAccount}
        onCancel={() => setIsDeleteModalOpen(false)}
        isDanger
        isLoading={isDeletingAccount}
      />
    </>
  );
};

export default EditProfileModal;
