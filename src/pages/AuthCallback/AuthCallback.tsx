import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './AuthCallback.module.css';

/**
 * Обрабатывает callback подтверждения email после регистрации
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Confirming your email...');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Даем Supabase время обработать токен подтверждения
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setMessage('Email confirmation failed. Please try again.');
          return;
        }

        if (session?.user) {
          setMessage('Email confirmed successfully! You can now close this window and return to the application.');
          setIsSuccess(true);
        } else {
          navigate('/login?error=email_confirmation_failed', { replace: true });
        }

      } catch (err) {
        setMessage('An error occurred during email confirmation. Please try again.');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Email Confirmation</h1>
        
        {!isSuccess ? (
          <>
            <div className={styles.spinner}></div>
            <div className={styles.message}>{message}</div>
          </>
        ) : (
          <>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.message}>{message}</div>
            <div className={styles.instruction}>
              You can safely close this window now.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;