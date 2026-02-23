import React, { useState } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Input from '../../ui/input/input';
import Button from '../../ui/button/button';
import styles from './edit-profile-modal.module.css';
import { useAuth } from '../../../contexts/AuthContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать профиль">
      <form onSubmit={handleSubmit} className={styles['edit-profile-modal__form']}>
        <div className={styles['edit-profile-modal__field']}>
          <label htmlFor="username" className={styles['edit-profile-modal__label']}>
            Имя пользователя
          </label>
          <Input
            id="username"
            placeholder="Введите имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className={styles['edit-profile-modal__field']}>
          <label htmlFor="full-name" className={styles['edit-profile-modal__label']}>
            Полное имя
          </label>
          <Input
            id="full-name"
            placeholder="Введите полное имя"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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
            onChange={(e) => setBio(e.target.value)}
            textarea
            disabled={isSubmitting}
          />
        </div>

        <div className={styles['edit-profile-modal__field']}>
          <label htmlFor="avatar" className={styles['edit-profile-modal__label']}>
            Аватар
          </label>
          <input
            id="avatar"
            type="file"
            accept="image/*"
            onChange={(e) => setAvatar(e.target.files?.[0] || null)}
            className={styles['edit-profile-modal__file-input']}
            disabled={isSubmitting}
          />
        </div>

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
  );
};

export default EditProfileModal;
