import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/auth/AuthShell';
import Input from '../../components/ui/input/input';
import Button from '../../components/ui/button/button';
import styles from './Login.module.css';

interface LocationState {
  fromInvite?: string;
  from?: string;
}

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const state = location.state as LocationState | null;
  const fromInvite = state?.fromInvite;
  const from = state?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email.trim(), password);

      const redirectPath = fromInvite ? `/invite/${fromInvite}` : from || '/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      compact
      badge="Вход"
      title="Войдите в TeamBridge"
      subtitle="Продолжите работу с проектами, задачами и командной коммуникацией."
      showcaseLabel="Workspace"
      showcaseTitle="Рабочее пространство снова под рукой"
      showcaseDescription="После входа вы сразу возвращаетесь к активным обсуждениям, задачам и срокам."
      showcaseItems={[
        'Чат, kanban и календарь в одном интерфейсе',
        'Упоминания и уведомления помогают быстро включиться в работу',
      ]}
      footer={(
        <p className={styles['auth__footer']}>
          Нет аккаунта?{' '}
          <button
            type="button"
            className={styles['auth__link']}
            onClick={() => navigate('/signup')}
            disabled={isLoading}
          >
            Зарегистрироваться
          </button>
        </p>
      )}
    >
        {error && <div className={styles['auth__error']}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles['auth__form']}>
          <div className={styles['auth__field']}>
            <label htmlFor="email" className={styles['auth__label']}>
              Электронная почта
            </label>
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
            />
          </div>

          <div className={styles['auth__field']}>
            <label htmlFor="password" className={styles['auth__label']}>
              Пароль
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              name="password"
              autoComplete="current-password"
              required
              disabled={isLoading}
            />
          </div>

          <div className={styles['auth__linkRow']}>
            <button
              type="button"
              className={styles['auth__link']}
              onClick={() => navigate('/password-recovery')}
              disabled={isLoading}
            >
              Забыли пароль?
            </button>
          </div>

          <Button type="submit" variant="primary" size="large" fullWidth loading={isLoading}>
            Войти
          </Button>
        </form>
    </AuthShell>
  );
};

export default Login;
