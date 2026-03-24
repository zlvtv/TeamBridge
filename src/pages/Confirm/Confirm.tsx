import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import Button from '../../components/ui/button/button';
import styles from './Confirm.module.css';
import { useAuth } from '../../contexts/AuthContext';

const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_COOLDOWN_KEY = 'teambridge:confirm-resend-cooldown-until';

const Confirm: React.FC = () => {
  const navigate = useNavigate();
  const { user, isInitialized, refreshEmailVerificationStatus } = useAuth();
  const currentUser = auth.currentUser;

  const urlParams = new URLSearchParams(window.location.search);
  const hasVerified = urlParams.get('verified') === 'true';
  const error = urlParams.get('error');

  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const readCooldown = () => {
      const raw = localStorage.getItem(RESEND_COOLDOWN_KEY);
      const until = raw ? Number(raw) : 0;
      if (!until || Number.isNaN(until)) {
        setCooldownLeft(0);
        return;
      }

      const nextLeft = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setCooldownLeft(nextLeft);

      if (nextLeft <= 0) {
        localStorage.removeItem(RESEND_COOLDOWN_KEY);
      }
    };

    readCooldown();
    const intervalId = window.setInterval(readCooldown, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isInitialized || !currentUser) return;

    const checkVerified = async () => {
      const verified = await refreshEmailVerificationStatus();
      if (verified) {
        navigate('/dashboard', { replace: true });
      }
    };

    void checkVerified();
  }, [isInitialized, currentUser, navigate, refreshEmailVerificationStatus]);

  const handleResend = async () => {
    if (!currentUser || resendLoading || cooldownLeft > 0) return;

    setResendLoading(true);
    setResendError(null);

    try {
      const actionCodeSettings = {
        url: window.location.origin + '/auth/callback',
        handleCodeInApp: true,
      };
      await sendEmailVerification(currentUser, actionCodeSettings);
      const cooldownUntil = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      localStorage.setItem(RESEND_COOLDOWN_KEY, String(cooldownUntil));
      setCooldownLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      console.error('Ошибка отправки письма:', err);
      const message = String(err?.message || '');

      if (message.includes('auth/too-many-requests')) {
        const cooldownUntil = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        localStorage.setItem(RESEND_COOLDOWN_KEY, String(cooldownUntil));
        setCooldownLeft(RESEND_COOLDOWN_SECONDS);
        setResendError('Слишком частая отправка. Подождите немного перед новой попыткой.');
      } else {
        setResendError('Не удалось отправить письмо повторно. Попробуйте позже.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!currentUser || statusLoading) {
      if (!currentUser) navigate('/login');
      return;
    }

    setStatusLoading(true);
    setStatusMessage(null);

    try {
      const verified = await refreshEmailVerificationStatus();
      if (verified) {
        navigate('/dashboard', { replace: true });
        return;
      }

      setStatusMessage('Email еще не подтвержден. Перейдите по ссылке из письма и попробуйте снова.');
    } catch {
      setStatusMessage('Не удалось обновить статус подтверждения. Попробуйте еще раз.');
    } finally {
      setStatusLoading(false);
    }
  };
  if (hasVerified) {
    return (
      <div className={styles.auth}>
        <div className={styles['auth__wrapper']}>
          <h1 className={styles['auth__title']}>Успешно!</h1>
          <p className={styles['confirm__success-text']}>
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
            className={styles['confirm__error-action']}
            disabled={resendLoading || cooldownLeft > 0}
          >
            {resendLoading ? 'Отправка...' : cooldownLeft > 0 ? `Повторно через ${cooldownLeft} c` : 'Отправить повторно'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.auth}>
      <div className={styles['auth__wrapper']}>
        <div className={styles['confirm__header']}>
          <h1 className={styles['auth__title']}>Подтвердите email</h1>
          <p className={styles['auth__subtitle']}>
            Мы отправили письмо на
          </p>
          <p className={styles['confirm__email-line']}>{currentUser?.email}</p>
          <p className={styles['confirm__hint']}>Перейдите по ссылке из письма, чтобы завершить регистрацию.</p>
        </div>

        <div className={styles['confirm__actions']}>
          <Button
            variant="primary"
            size="large"
            onClick={handleCheckStatus}
            fullWidth
            className={styles['confirm__primary-button']}
            loading={statusLoading}
          >
            Проверить статус
          </Button>

          <p className={styles['confirm__spam-note']}>Проверьте папку «Спам», если письма нет.</p>

          <button
            type="button"
            className={styles['auth__link']}
            onClick={handleResend}
            disabled={resendLoading || cooldownLeft > 0}
          >
            {resendLoading ? 'Отправка...' : cooldownLeft > 0 ? `Отправить повторно через ${cooldownLeft} c` : 'Отправить письмо повторно'}
          </button>

          {resendError ? <div className={styles['confirm__message']}>{resendError}</div> : null}
          {!resendError && statusMessage ? <div className={styles['confirm__message']}>{statusMessage}</div> : null}
          {!resendError && cooldownLeft > 0 ? (
            <div className={styles['confirm__message']}>
              Повторная отправка будет доступна через {cooldownLeft} с.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Confirm;
