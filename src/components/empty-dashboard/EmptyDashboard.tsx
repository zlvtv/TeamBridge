import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../contexts/UIContext';
import { supabase } from '../../lib/supabase';
import styles from './EmptyDashboard.module.css';

const EmptyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openCreateOrgModal } = useUI();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleCreateOrgClick = () => {
    openCreateOrgModal(); 
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <button className={styles.logoutBtn} onClick={handleLogout} aria-label="Выйти из аккаунта">
          Выйти
        </button>
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>
          Добро пожаловать, {user?.username || user?.email?.split('@')[0] || 'Пользователь'}!
        </h1>
        <p className={styles.subtitle}>Вы ещё не состоите ни в одной организации.</p>

        <div className={styles.actions}>
          <button className={styles.primary} onClick={handleCreateOrgClick}>
            Создать организацию
          </button>
        </div>

        <p className={styles.tip}>
          Создайте организацию, чтобы начать работу с проектами и командой.
        </p>
      </div>
    </div>
  );
};

export default EmptyDashboard;
