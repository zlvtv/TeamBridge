import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import styles from './Login.module.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { state } = useLocation();

  useEffect(() => {
    if (state?.invite_token) {
      console.log('📬 [Login] Получен invite_token из state:', state.invite_token);
      try {
        localStorage.setItem('invite_token', state.invite_token);
      } catch (e) {
        console.error('[Login] Не удалось сохранить в localStorage', e);
      }
    }
  }, [state]);

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🔐 [Login] handleSubmit вызван');
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email.trim(), password);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Не удалось получить пользователя');
      }

      const savedToken = localStorage.getItem('invite_token');
      console.log('[Login] Проверка invite_token после входа:', savedToken);

      if (savedToken) {
        localStorage.removeItem('invite_token');
        console.log('[Login] Отправляю invite_after_login:', savedToken);
        window.dispatchEvent(new CustomEvent('invite_after_login', { detail: savedToken }));
      } else {
        console.log('[Login] Нет invite_token — переходим на /dashboard');
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('[Login] Ошибка входа:', err);
      setError(translateError(err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>Войти в аккаунт</h1>
        <p className={styles.subtitle}>Введите свои данные, чтобы продолжить</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Электронная почта
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              disabled={isLoading}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Пароль
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
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.link}
              onClick={() => navigate('/password-recovery')}
              disabled={isLoading}
            >
              Забыли пароль?
            </button>
          </div>

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className={styles.footer}>
          Нет аккаунта?{' '}
          <button
            type="button"
            className={styles.link}
            onClick={() => navigate('/signup')}
            disabled={isLoading}
          >
            Зарегистрироваться
          </button>
        </p>
      </div>
    </div>
  );
};

const translateError = (message: string): string => {
  if (message.includes('Invalid login credentials')) return 'Неверный email или пароль';
  if (message.includes('Email not confirmed')) return 'Email не подтверждён. Проверьте почту';
  return 'Ошибка входа. Попробуйте снова';
};

export default Login;
