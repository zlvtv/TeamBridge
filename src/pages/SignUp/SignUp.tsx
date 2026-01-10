import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './SignUp.module.css';
import { supabase } from '../../lib/supabase';

const SignUp: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const validateUsername = (username: string): string | null => {
    const trimmed = username.trim();

    if (trimmed.length === 0) return 'Имя пользователя обязательно';
    if (trimmed.length < 3) return 'Имя пользователя должно быть не менее 3 символов';
    if (trimmed.length > 15) return 'Имя пользователя не должно превышать 15 символов';
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return 'Имя пользователя может содержать только буквы, цифры, дефис и подчёркивание';
    }

    return null;
  };

  const checkIfEmailExists = async (email: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('is_email_registered', { user_email: email });
    if (error) return false;
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setShowConfirmScreen(false);

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      setIsLoading(false);
      return;
    }

    const emailTrimmed = email.trim();

    try {
      const emailExists = await checkIfEmailExists(emailTrimmed);
      if (emailExists) {
        setError('Пользователь с таким email уже зарегистрирован. Войдите в аккаунт.');
        setIsLoading(false);
        return;
      }

      const { data, error } = await signUp(emailTrimmed, password, username.trim());

      if (error) {
        if (error.message.includes('Password should be at least 6 characters')) {
          setError('Пароль должен быть не менее 6 символов.');
        } else if (error.message.includes('Password is too weak')) {
          setError('Пароль слишком простой. Попробуйте другой.');
        } else if (error.message.includes('User already registered')) {
          setError('Пользователь с таким email уже зарегистрирован.');
        } else if (error.message.includes('duplicate key value violates unique constraint "profiles_username_key"')) {
          setError('Это имя пользователя уже занято. Выберите другое.');
        } else {
          setError('Ошибка регистрации: ' + error.message);
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        setShowConfirmScreen(true);
      }
    } catch (err: any) {
      const networkError = !err.message.includes('password') && !err.message.includes('email');
      if (networkError) {
        setError('Не удалось подключиться к серверу. Проверьте интернет.');
      } else {
        setError('Пароль должен быть не менее 6 символов.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmScreen) {
    return (
      <div className={styles.container}>
        <div className={styles.formWrapper}>
          <h1 className={styles.title}>Почти готово!</h1>
          <p className={styles.subtitle}>
            Мы отправили письмо на <strong>{email}</strong>. Перейдите по ссылке подтверждения, чтобы завершить регистрацию.
          </p>
          <p className={styles.footer}>Не пришло письмо? Проверьте папку "Спам"</p>
          <button className={styles.submit} onClick={() => navigate('/login')}>
            Хорошо
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>Регистрация</h1>
        <p className={styles.subtitle}>Создайте аккаунт, чтобы начать работу</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username" className={styles.label}>
              Имя пользователя
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ваше_имя"
              required
              minLength={3}
              maxLength={30}
              disabled={isLoading}
              className={styles.input}
            />
            <small>От 3 до 15 символов. Только буквы, цифры, _, -</small>
          </div>

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

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className={styles.footer}>
          Уже есть аккаунт?{' '}
          <button
            type="button"
            className={styles.link}
            onClick={() => navigate('/login')}
            disabled={isLoading}
          >
            Войти
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignUp;
