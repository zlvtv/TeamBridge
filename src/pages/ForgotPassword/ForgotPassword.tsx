import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Input from '../../components/ui/input/input';
import Button from '../../components/ui/button/button';
import styles from './ForgotPassword.module.css';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email.trim()) {
      setError('Введите email');
      setIsLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Введите корректный email');
      setIsLoading(false);
      return;
    }

    try {
      const result = await resetPassword(email.trim());

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Не удалось отправить письмо. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/login');
  };

  return (
    <div className={styles.auth}>
      <div className={styles['auth__wrapper']}>
        <h1 className={styles['auth__title']}>{success ? 'Проверьте почту' : 'Восстановление пароля'}</h1>

        {success ? (
          <div className={styles['auth__success-container']}>
            <p className={styles['auth__subtitle']}>
              Если аккаунт с email <strong>{email}</strong> существует, вы получите письмо со ссылкой для восстановления.
            </p>
            <p className={styles['auth__spam-hint']}>
              Проверьте папку «Спам», если письмо не пришло.
            </p>
            <Button variant="primary" size="large" fullWidth onClick={() => navigate('/login')}>
              Войти
            </Button>
          </div>
        ) : (
          <>
            <p className={styles['auth__subtitle']}>Введите email, чтобы получить ссылку для восстановления</p>
            {error && <div className={styles['auth__error']}>{error}</div>}
            <form onSubmit={handleSubmit} className={styles['auth__form']}>
              <div className={styles['auth__field']}>
                <label htmlFor="email" className={styles['auth__label']}>Электронная почта</label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  disabled={isLoading}
                  error={error || undefined}
                />
              </div>
              <Button type="submit" variant="primary" size="large" fullWidth loading={isLoading}>
                {isLoading ? 'Отправка...' : 'Отправить ссылку'}
              </Button>
            </form>
            <p className={styles['auth__footer']}>
              <button
                type="button"
                className={styles['auth__link']}
                onClick={handleBack}
                disabled={isLoading}
              >
                ← Назад ко входу
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
