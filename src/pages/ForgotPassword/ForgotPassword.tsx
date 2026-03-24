import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/auth/AuthShell';
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
    <AuthShell
      badge="Восстановление"
      title={success ? 'Проверьте почту' : 'Восстановите доступ без лишних шагов'}
      subtitle={
        success
          ? 'Ссылка для восстановления уже отправлена. После смены пароля можно сразу вернуться в TeamBridge.'
          : 'Введите email, чтобы получить письмо для сброса пароля и быстро вернуться к проектам, задачам и уведомлениям.'
      }
      showcaseLabel="Security flow"
      showcaseTitle="Безопасный возврат в рабочее пространство"
      showcaseDescription="Потерянный пароль не должен ломать рабочий ритм команды. Восстановление проходит через email и ведет обратно в актуальный контекст."
      showcaseItems={[
        'Сброс пароля идет через подтвержденный email-канал',
        'После восстановления можно снова открыть проекты, роли и задачи',
        'Уведомления и переписка останутся внутри того же аккаунта',
      ]}
      showcaseStats={['Email recovery', 'Secure access', 'Fast return']}
      footer={!success ? (
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
      ) : undefined}
    >
        {success ? (
          <div className={styles['auth__successContainer']}>
            <div className={styles['auth__successBox']}>
              Если аккаунт с email <strong>{email}</strong> существует, вы получите письмо со ссылкой для восстановления.
            </div>
            <p className={styles['auth__successHint']}>Проверьте папку «Спам», если письмо не пришло в течение пары минут.</p>
            <Button variant="primary" size="large" fullWidth onClick={() => navigate('/login')}>
              Войти
            </Button>
          </div>
        ) : (
          <>
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
                  name="email"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  error={error || undefined}
                />
              </div>
              <Button type="submit" variant="primary" size="large" fullWidth loading={isLoading}>
                {isLoading ? 'Отправка...' : 'Отправить ссылку'}
              </Button>
            </form>
          </>
        )}
    </AuthShell>
  );
};

export default ForgotPassword;
