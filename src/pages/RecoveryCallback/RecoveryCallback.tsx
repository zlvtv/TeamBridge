import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './RecoveryCallback.module.css';

const RecoveryCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleRecovery = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        navigate('/password-recovery', { replace: true });
        return;
      }
      navigate('/reset-password', { replace: true });
    };
    handleRecovery();
  }, [navigate]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.spinner}></div>
        <div className={styles.message}>Обработка ссылки...</div>
      </div>
    </div>
  );
};

export default RecoveryCallback;
