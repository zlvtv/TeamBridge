import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../lib/firebase';
import { applyActionCode } from 'firebase/auth';
import styles from './Confirm.module.css';

const Confirm: React.FC = () => {
  const navigate = useNavigate();
  const { isInitialized } = useAuth();
  const currentUser = auth.currentUser;

  const urlParams = new URLSearchParams(window.location.search);
  const oobCode = urlParams.get('oobCode');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    oobCode ? 'loading' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Confirm: oobCode=', oobCode);
    console.log('Confirm: isInitialized=', isInitialized);
    console.log('Confirm: currentUser=', currentUser);
  }, [oobCode, isInitialized, currentUser]);

  useEffect(() => {
    if (!isInitialized || !oobCode || status !== 'loading') return;

    applyActionCode(auth, oobCode)
      .then(async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
        }
        setStatus('success');
        const timer = setTimeout(() => navigate('/dashboard'), 2000);
        return () => clearTimeout(timer);
      })
      .catch((err) => {
        setStatus('error');
        setError(
          err.code === 'auth/expired-action-code'
            ? 'Ссылка устарела. Запросите новое письмо.'
            : 'Неверная или уже использованная ссылка.'
        );
      });
  }, [isInitialized, oobCode, status, navigate]);

  const handleResend = async () => {
    if (!currentUser) {
      alert('Сессия истекла. Войдите снова.');
      navigate('/login');
      return;
    }
    try {
      await auth.currentUser.sendEmailVerification();
      alert('Письмо отправлено! Проверьте спам.');
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  if (oobCode) {
    return (
      <div className={styles.container}>
        <div className={styles.formWrapper}>
          <h1 className={styles.title}>Подтверждение email</h1>

          {status === 'loading' && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Подтверждаем ваш email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className={styles.success}>
              <h2>Успешно!</h2>
              <p>Ваш email подтверждён. Через несколько секунд вы будете перенаправлены в приложение...</p>
            </div>
          )}

          {status === 'error' && (
            <div className={styles.errorBox}>
              <p>{error}</p>
              <button className={styles.submit} onClick={handleResend}>
                Отправить повторно
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>Подтвердите email</h1>
        <p className={styles.subtitle}>
          Мы отправили письмо на <strong>{currentUser?.email}</strong>. Перейдите по ссылке.
        </p>
        <button className={styles.submit} onClick={handleGoToLogin}>
          Войти
        </button>
        <p className={styles.hint}>
          <small>Проверьте папку «Спам», если письма нет.</small>
        </p>
      </div>
    </div>
  );
};

export default Confirm;