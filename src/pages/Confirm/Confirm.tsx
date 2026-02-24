import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import Button from '../../components/ui/button/button';
import LoadingState from '../../components/ui/loading/LoadingState';
import styles from './Confirm.module.css';
import { useAuth } from '../../contexts/AuthContext';

const Confirm: React.FC = () => {
  const navigate = useNavigate();
  const { user, isInitialized } = useAuth();
  const currentUser = auth.currentUser;

  const urlParams = new URLSearchParams(window.location.search);
  const hasVerified = urlParams.get('verified') === 'true';
  const error = urlParams.get('error');

  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!isInitialized || !currentUser) return;

    const checkVerified = async () => {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        navigate('/dashboard', { replace: true });
      }
    };

    checkVerified();
  }, [isInitialized, currentUser, navigate]);

  const handleResend = async () => {
    if (!currentUser || resendLoading) return;

    setResendLoading(true);

    try {
      const actionCodeSettings = {
        url: window.location.origin + '/auth/callback',
        handleCodeInApp: true,
      };
      await sendEmailVerification(currentUser, actionCodeSettings);
      alert('Письмо отправлено! Проверьте спам.');
    } catch (err: any) {
      console.error('Ошибка отправки письма:', err);
      alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setResendLoading(false);
    }
  };
  if (hasVerified) {
    return (
      <div className={styles.auth}>
        <div className={styles['auth__wrapper']}>
          <h1 className={styles['auth__title']}>Успешно!</h1>
          <p style={{ color: '#065f46', fontSize: '1rem' }}>
            Ваш email подтверждён. Через несколько секунд вы будете перенаправлены...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.auth}>
        <div className={styles['auth__wrapper']}>
          <h1 className={styles['auth__title']}>❌ Ошибка</h1>
          <div className={styles['auth__error']}>{decodeURIComponent(error)}</div>
          <Button
            variant="secondary"
            size="medium"
            onClick={handleResend}
            fullWidth
            style={{ marginTop: '16px' }}
            disabled={resendLoading}
          >
            {resendLoading ? 'Отправка...' : 'Отправить повторно'}
          </Button>
        </div>
      </div>
    );
  }

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
            Проверить статус
          </Button>

          <p style={{ margin: '12px 0 0 0', fontSize: '0.875rem', color: 'var(--color-text-light)', textAlign: 'center' }}>
            <small>Проверьте папку «Спам», если письма нет.</small>
          </p>

          <button
            type="button"
            className={styles['auth__link']}
            onClick={handleResend}
            disabled={resendLoading}
            style={{ marginTop: '8px', textAlign: 'center' }}
          >
            {resendLoading ? 'Отправка...' : 'Отправить письмо повторно'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Confirm;
