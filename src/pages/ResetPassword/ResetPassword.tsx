import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, confirmPasswordReset } from 'firebase/auth';
import AuthShell from '../../components/auth/AuthShell';
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
    <AuthShell
      badge="Новый пароль"
      title={isSuccess ? 'Пароль обновлен' : 'Создайте новый пароль'}
      subtitle={
        isSuccess
          ? 'Доступ восстановлен. Теперь можно снова войти и продолжить работу в TeamBridge.'
          : 'Новый пароль откроет доступ к проектам, задачам, ролям и командной переписке из вашего рабочего пространства.'
      }
      showcaseLabel="Recovery complete"
      showcaseTitle="Возвращение в командный поток должно быть быстрым и безопасным"
      showcaseDescription="После смены пароля вы снова попадете в привычный рабочий контекст: проекты, kanban, календарь и notifications останутся на месте."
      showcaseItems={[
        'Смена пароля подтверждается только по безопасной recovery-ссылке',
        'После входа останутся доступны проекты, участники и роли организации',
        'Командные задачи, обсуждения и дедлайны никуда не теряются',
      ]}
      showcaseStats={['Secure reset', 'Projects intact', 'Ready to continue']}
      footer={!isSuccess ? (
        <p className={styles['auth__footer']}>
          <button type="button" className={styles['auth__link']} onClick={handleBack} disabled={isLoading}>
            ← Назад ко входу
          </button>
        </p>
      ) : undefined}
    >
        {isSuccess ? (
          <div className={styles['auth__successContainer']}>
            <h2 className={styles['auth__successTitle']}>Пароль изменен.</h2>
            <div className={styles['auth__successBox']}>Теперь вы можете войти с новым паролем и продолжить работу.</div>
            <Button variant="primary" size="large" fullWidth onClick={() => navigate('/login')}>
              Войти
            </Button>
          </div>
        ) : (
          <>
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
                  name="password"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  error={password.length > 0 && password.length < 6 ? 'Минимум 6 символов' : undefined}
                />
                <span className={styles['auth__helper']}>Используйте минимум 6 символов для нового пароля.</span>
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
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  error={confirmPassword.length > 0 && password !== confirmPassword ? 'Пароли не совпадают' : undefined}
                />
              </div>
              <Button type="submit" variant="primary" size="large" fullWidth loading={isLoading}>
                Сменить пароль
              </Button>
            </form>
          </>
        )}
    </AuthShell>
  );
};

export default ResetPassword;
