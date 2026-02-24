import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../contexts/UIContext';
import Button from '../../components/ui/button/button';
import styles from './EmptyDashboard.module.css';

const EmptyDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { openModal } = useUI();

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleCreateOrgClick = () => {
    openModal('createOrg');
  };



  return (
    <div className={styles['empty-dashboard']}>
      <div className={styles['empty-dashboard__header']}>
        <Button variant="ghost" size="small" onClick={handleLogout}>
          Выйти
        </Button>
      </div>

      <div className={styles['empty-dashboard__content']}>
        <h1 className={styles['empty-dashboard__title']}>
          Добро пожаловать, {user?.username || user?.email?.split('@')[0] || 'Пользователь'}!
        </h1>
        <p className={styles['empty-dashboard__subtitle']}>
          Вы ещё не состоите ни в одной организации.
        </p>

        <div className={styles['empty-dashboard__actions']}>
          <Button variant="primary" size="large" onClick={handleCreateOrgClick}>
            Создать организацию
          </Button>
        </div>

        <p className={styles['empty-dashboard__tip']}>
          Создайте организацию, чтобы начать работу с проектами и командой.
        </p>
      </div>
    </div>
  );
};

export default EmptyDashboard;
