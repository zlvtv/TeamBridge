import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, confirmPasswordReset } from 'firebase/auth';
import styles from './ResetPassword.module.css';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const oobCode = localStorage.getItem('reset_password_oobCode');
    if (!oobCode) {
      navigate('/password-recovery', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setIsSuccess(false);

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    const oobCode = localStorage.getItem('reset_password_oobCode');
    if (!oobCode) {
      setError('Ссылка недействительна или истекла');
      setIsLoading(false);
      return;
    }

    try {
      await confirmPasswordReset(auth, oobCode, password);
      localStorage.removeItem('reset_password_oobCode');
      setIsSuccess(true);
    } catch (err: any) {
      let message = 'Не удалось сменить пароль';

      switch (err.code) {
        case 'auth/invalid-action-code':
          message = 'Ссылка недействительна или уже использована';
          break;
        case 'auth/expired-action-code':
          message = 'Срок действия ссылки истек';
          break;
        case 'auth/weak-password':
          message = 'Пароль слишком слабый';
          break;
        default:
          console.error('Ошибка сброса пароля:', err);
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    localStorage.removeItem('reset_password_oobCode');
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>Новый пароль</h1>

        {isSuccess ? (
          <div className={styles.successContainer}>
            <h2 className={styles.successTitle}>Пароль изменён.</h2>
            <p className={styles.successText}>Теперь вы можете войти с новым паролем.</p>
            <button className={styles.submit} onClick={() => navigate('/login')}>
              Войти
            </button>
          </div>
        ) : (
          <>
            <p className={styles.subtitle}>Введите и подтвердите новый пароль</p>
            {error && <div className={styles.error}>{error}</div>}
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="password" className={styles.label}>
                  Новый пароль
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className={styles.input}
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="confirmPassword" className={styles.label}>
                  Подтвердите
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className={styles.input}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className={styles.submit} disabled={isLoading}>
                {isLoading ? 'Сохранение...' : 'Сменить пароль'}
              </button>
            </form>
            <p className={styles.footer}>
              <button type="button" className={styles.link} onClick={handleBack} disabled={isLoading}>
                ← Назад ко входу
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
