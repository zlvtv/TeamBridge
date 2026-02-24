import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Input from '../../components/ui/input/input';
import Button from '../../components/ui/button/button';
import styles from './SignUp.module.css';

const SignUp: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    fullName: false,
  });

  const navigate = useNavigate();
  const { signUp } = useAuth();

  const validateUsername = (username: string): string | null => {
    const trimmed = username.trim();
    if (trimmed.length === 0) return 'Имя пользователя обязательно';
    if (trimmed.length < 3) return 'Минимум 3 символа';
    if (trimmed.length > 15) return 'Не более 15 символов';
    if (!/^[a-zA-Z0-9_-]+$/i.test(trimmed)) {
      return 'Только буквы, цифры, _, -';
    }
    return null;
  };

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

  const validateFullName = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return 'Полное имя обязательно';
    if (trimmed.length < 2) return 'Слишком короткое имя';
    if (trimmed.length > 50) return 'Слишком длинное имя';
    return null;
  };

  const handleBlur = (field: 'username' | 'email' | 'password' | 'fullName') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
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
      const result = await signUp(
        email.trim(),
        password,
        username.trim(),
        fullName.trim()
      );

      if (result.data?.user) {
        navigate('/confirm', { replace: true });
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Не удалось зарегистрироваться. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.auth}>
      <div className={styles['auth__wrapper']}>
        <h1 className={styles['auth__title']}>Регистрация</h1>
        <p className={styles['auth__subtitle']}>Создайте аккаунт, чтобы начать работу</p>

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
      const value = e.target.value;
      const filtered = value.replace(/[^a-zA-Z0-9_-]/g, '');
      setUsername(filtered);
    }}
    onBlur={() => handleBlur('username')}
    placeholder="ваше_имя"
    required
    minLength={3}
    maxLength={15}
    disabled={isLoading}
    error={touched.username ? validateUsername(username) : undefined}
  />
  {touched.username && !validateUsername(username) && (
    <small>3–15 символов. Только a–z, 0–9, _, -</small>
  )}
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
              required
              disabled={isLoading}
              error={touched.fullName ? validateFullName(fullName) : undefined}
            />
            {touched.fullName && !validateFullName(fullName) && (
              <small>Введите ваше настоящее имя</small>
            )}
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
              required
              disabled={isLoading}
              error={touched.email ? validateEmail(email) : undefined}
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
              required
              disabled={isLoading}
              error={touched.password ? validatePassword(password) : undefined}
            />
            {touched.password && !validatePassword(password) && (
              <small>Минимум 6 символов</small>
            )}
          </div>

          <Button type="submit" variant="primary" size="large" fullWidth loading={isLoading}>
            Зарегистрироваться
          </Button>
        </form>

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
      </div>
    </div>
  );
};

export default SignUp;
