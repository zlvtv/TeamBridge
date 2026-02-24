import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { applyActionCode, sendEmailVerification } from 'firebase/auth';
import Button from '../../components/ui/button/button';
import LoadingState from '../../components/ui/loading/LoadingState';
import styles from './Confirm.module.css';
import { useAuth } from '../../contexts/AuthContext';

const Confirm: React.FC = () => {
  const navigate = useNavigate();
  const { user, isInitialized } = useAuth();
  const currentUser = auth.currentUser;

  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const oobCode = urlParams.get('oobCode');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Обработка действия подтверждения email
  useEffect(() => {
    if (!isInitialized || !currentUser) return;

    const checkVerified = async () => {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        navigate('/dashboard', { replace: true });
      } else {
        // Если email не подтверждён, оставайтесь на /confirm
        if (window.location.pathname !== '/confirm') {
          navigate('/confirm', { replace: true });
        }
      }
    };

    checkVerified();
  }, [isInitialized, currentUser, navigate]);

  const handleResend = async () => {
    if (!currentUser) {
      alert('Сессия истекла. Войдите снова.');
      navigate('/login');
      return;
    }

    const actionCodeSettings = {
      url: window.location.origin + '/confirm',
      handleCodeInApp: true,
    };

    try {
      await sendEmailVerification(currentUser, actionCodeSettings);
      alert('Письмо отправлено! Проверьте спам.');
    } catch (err: any) {
      console.error('Ошибка отправки письма:', err);
      alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    }
  };

  // Если идёт обработка подтверждения
  if (oobCode && mode === 'verifyEmail') {
    return (
      <div className={styles.auth}>
        <div className={styles['auth__wrapper']}>
          <h1 className={styles['auth__title']}>Подтверждение email</h1>

          {status === 'loading' && <LoadingState message="Подтверждаем ваш email..." />}

          {status === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: '#065f46', margin: '0 0 8px 0' }}>✅ Успешно!</h2>
              <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                Ваш email подтверждён. Через несколько секунд вы будете перенаправлены...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className={styles['auth__error']} style={{ textAlign: 'center' }}>
                {error}
              </div>
              <Button
                variant="secondary"
                size="medium"
                onClick={handleResend}
                fullWidth
                style={{ marginTop: '16px' }}
              >
                Отправить повторно
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Если нет oobCode — просто показываем напоминание
  return (
    <div className={styles.auth}>
      <div className={styles['auth__wrapper']}>
        <h1 className={styles['auth__title']}>Подтвердите email</h1>
        <p className={styles['auth__subtitle']}>
          Мы отправили письмо на <strong>{currentUser?.email}</strong>. Перейдите по ссылке.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Button
            variant="primary"
            size="large"
            onClick={async () => {
              if (!currentUser) return navigate('/login');
              await currentUser.reload();
              if (currentUser.emailVerified) {
                navigate('/dashboard', { replace: true });
              } else {
                alert('Email ещё не подтверждён. Перейдите по ссылке из письма.');
              }
            }}
            fullWidth
            style={{ maxWidth: '280px' }}
          >
            Продолжить в приложение
          </Button>

          <p style={{ margin: '12px 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-light)', textAlign: 'center' }}>
            <small>Проверьте папку «Спам», если письма нет.</small>
          </p>

          <button
            type="button"
            className={styles['auth__link']}
            onClick={handleResend}
            style={{ marginTop: '8px', textAlign: 'center' }}
          >
            Отправить письмо повторно
          </button>
        </div>
      </div>
    </div>
  );
};

export default Confirm;
