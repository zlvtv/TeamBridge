import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './AuthCallback.module.css';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Confirming your email...');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const token = searchParams.get('token');
        const type = searchParams.get('type');

        // ЗАЩИТА: Проверяем что это действительно callback с токеном подтверждения
        if (!token) {
          console.error('❌ No token found in URL');
          setMessage('Invalid confirmation link. Please use the link from your email.');
          return;
        }

        // ЗАЩИТА: Проверяем что это правильный тип callback
        if (type !== 'signup' && type !== 'email_change') {
          console.error('❌ Invalid callback type:', type);
          setMessage('Invalid confirmation link type.');
          return;
        }

        console.log('✅ Valid email confirmation callback detected');

        // Искусственная задержка для лучшего UX
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error after confirmation:', error);
          setMessage('Email confirmation failed. Please try again.');
          return;
        }

        if (session?.user) {
          console.log('✅ Email confirmed successfully for:', session.user.email);
          setMessage('Email confirmed successfully! You can now close this window and return to the application.');
          setIsSuccess(true);
        } else {
          console.log('✅ Email confirmed but no session');
          setMessage('Email confirmed! You can now sign in. Please close this window and return to the application.');
          setIsSuccess(true);
        }

      } catch (err) {
        console.error('Auth callback error:', err);
        setMessage('An error occurred during email confirmation. Please try again.');
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

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