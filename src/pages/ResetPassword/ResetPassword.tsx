import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, confirmPasswordReset } from 'firebase/auth';
import Input from '../../components/ui/input/input';
import Button from '../../components/ui/button/button';
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
    <div className={styles.auth}>
      <div className={styles['auth__wrapper']}>
        <h1 className={styles['auth__title']}>Новый пароль</h1>

        {isSuccess ? (
          <div className={styles['auth__success-container']}>
            <h2 className={styles['auth__success-title']}>Пароль изменён.</h2>
            <p className={styles['auth__success-text']}>Теперь вы можете войти с новым паролем.</p>
            <Button variant="primary" size="large" fullWidth onClick={() => navigate('/login')}>
              Войти
            </Button>
          </div>
        ) : (
          <>
            <p className={styles['auth__subtitle']}>Введите и подтвердите новый пароль</p>
            {error && <div className={styles['auth__error']}>{error}</div>}
            <form onSubmit={handleSubmit} className={styles['auth__form']}>
              <div className={styles['auth__field']}>
                <label htmlFor="password" className={styles['auth__label']}>
                  Новый пароль
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  error={password.length < 6 ? 'Минимум 6 символов' : undefined}
                />
              </div>
              <div className={styles['auth__field']}>
                <label htmlFor="confirmPassword" className={styles['auth__label']}>
                  Подтвердите
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  error={password !== confirmPassword ? 'Пароли не совпадают' : undefined}
                />
              </div>
              <Button type="submit" variant="primary" size="large" fullWidth loading={isLoading}>
                Сменить пароль
              </Button>
            </form>
            <p className={styles['auth__footer']}>
              <button type="button" className={styles['auth__link']} onClick={handleBack} disabled={isLoading}>
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
