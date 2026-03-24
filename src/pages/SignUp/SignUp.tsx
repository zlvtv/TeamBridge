import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/auth/AuthShell';
import Input from '../../components/ui/input/input';
import Button from '../../components/ui/button/button';
import styles from './SignUp.module.css';
import {
  sanitizeUsernameInput,
  validateFullName,
  validateUsername,
  USERNAME_MAX_LENGTH,
} from '../../utils/profileValidation';

const SignUp: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    fullName: false,
  });

  const navigate = useNavigate();
  const { signUp, checkUsernameAvailability } = useAuth();

  const validateEmail = (email: string): string | null => {
    const trimmed = email.trim();
    if (trimmed.length === 0) return 'Email обязателен';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return 'Некорректный email';
    return null;
  };

  const validatePassword = (password: string): string | null => {
    if (password.length === 0) return 'Пароль обязателен';
    if (password.length < 6) return 'Пароль должен быть не менее 6 символов';
    return null;
  };

  const handleBlur = async (field: 'username' | 'email' | 'password' | 'fullName') => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field !== 'username') return;

    const usernameError = validateUsername(username);
    if (usernameError) {
      setUsernameStatus(null);
      return;
    }

    setIsCheckingUsername(true);
    const result = await checkUsernameAvailability(username);
    setUsernameStatus(result.available ? 'Имя пользователя свободно' : result.message || 'Имя пользователя уже занято');
    setIsCheckingUsername(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTouched({
      username: true,
      email: true,
      password: true,
      fullName: true,
    });

    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const fullNameError = validateFullName(fullName);

    if (usernameError || emailError || passwordError || fullNameError) {
      return;
    }

    setIsLoading(true);

    try {
      const usernameAvailability = await checkUsernameAvailability(username);
      if (!usernameAvailability.available) {
        setUsernameStatus(usernameAvailability.message || 'Имя пользователя уже занято');
        setIsLoading(false);
        return;
      }

      const result = await signUp(
        email.trim(),
        password,
        username.trim(),
        fullName.trim()
      );

      if (result.data?.user) {
        navigate('/confirm', { replace: true });
      } else if (result.error) {
        if (result.error.message.includes('Имя пользователя уже занято')) {
          setUsernameStatus(result.error.message);
        } else {
          setError(result.error.message);
        }
      }
    } catch (err) {
      setError('Не удалось зарегистрироваться. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  const usernameValidationError = touched.username ? validateUsername(username) ?? undefined : undefined;
  const usernameAvailabilityError =
    !usernameValidationError && usernameStatus && usernameStatus !== 'Имя пользователя свободно'
      ? usernameStatus
      : undefined;

  return (
    <AuthShell
      compact
      badge="Регистрация"
      title="Создайте аккаунт TeamBridge"
      subtitle=""
      showcaseLabel="Setup"
      showcaseTitle="Быстрый старт без лишнего шума"
      showcaseDescription="После регистрации можно сразу перейти к проектам, ролям и задачам."
      showcaseItems={[
        'Кастомные роли и структура команды',
        'Инвайты, задачи и уведомления в одном месте',
      ]}
      footer={(
        <p className={styles['auth__footer']}>
          Уже есть аккаунт?{' '}
          <button
            type="button"
            className={styles['auth__link']}
            onClick={() => navigate('/login')}
            disabled={isLoading}
          >
            Войти
          </button>
        </p>
      )}
    >
        {error && <div className={styles['auth__error']}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles['auth__form']}>
          <div className={styles['auth__field']}>
            <label htmlFor="username" className={styles['auth__label']}>
              Имя пользователя
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(sanitizeUsernameInput(e.target.value));
                setUsernameStatus(null);
              }}
              onBlur={() => handleBlur('username')}
              placeholder="ваше_имя"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={USERNAME_MAX_LENGTH}
              disabled={isLoading || isCheckingUsername}
              error={usernameValidationError || usernameAvailabilityError}
            />
            <span className={styles['auth__helper']}>
              {touched.username && !usernameValidationError
                ? isCheckingUsername
                  ? 'Проверяем доступность имени...'
                  : usernameStatus || '3-30 символов. Только буквы, цифры, _, -.'
                : '3-30 символов. Только буквы, цифры, _, -.'}
            </span>
          </div>

          <div className={styles['auth__field']}>
            <label htmlFor="fullName" className={styles['auth__label']}>
              Полное имя
            </label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => handleBlur('fullName')}
              placeholder="Иван Иванов"
              name="fullName"
              autoComplete="name"
              required
              disabled={isLoading}
              error={touched.fullName ? validateFullName(fullName) ?? undefined : undefined}
            />
            <span className={styles['auth__helper']}>Это имя будет видно в команде и внутри проектов.</span>
          </div>

          <div className={styles['auth__field']}>
            <label htmlFor="email" className={styles['auth__label']}>
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="name@example.com"
              name="email"
              autoComplete="email"
              required
              disabled={isLoading}
              error={touched.email ? validateEmail(email) ?? undefined : undefined}
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
              onBlur={() => handleBlur('password')}
              placeholder="••••••••"
              name="password"
              autoComplete="new-password"
              required
              disabled={isLoading}
              error={touched.password ? validatePassword(password) ?? undefined : undefined}
            />
            <span className={styles['auth__helper']}>Минимум 6 символов для безопасного входа.</span>
          </div>

          <Button type="submit" variant="primary" size="large" fullWidth loading={isLoading}>
            Зарегистрироваться
          </Button>
        </form>
    </AuthShell>
  );
};

export default SignUp;
