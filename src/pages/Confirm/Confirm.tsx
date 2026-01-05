// src/pages/Confirm/Confirm.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './Confirm.module.css';

const Confirm: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate('/dashboard', { replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  const handleContinue = async () => {
    const { data } = await supabase.auth.getSession();
    navigate(data.session ? '/dashboard' : '/login', { replace: true });
  };

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>✅ Подтверждение завершено</h1>
        <p className={styles.subtitle}>Email успешно подтверждён.</p>
        <button className={styles.submit} onClick={handleContinue}>
          Продолжить
        </button>
      </div>
    </div>
  );
};

export default Confirm;
