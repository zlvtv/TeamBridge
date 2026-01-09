import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './ResetPassword.module.css';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 6) return 'Пароль должен быть не менее 6 символов';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const passError = validatePassword(password);
    if (passError) {
      setError(passError);
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message.includes('Invalid token')
          ? 'Ссылка устарела. Повторите запрос.'
          : 'Не удалось изменить пароль.');
        setIsLoading(false);
        return;
      }

      await supabase.auth.signOut();
      navigate('/login?message=Пароль успешно изменён');
    } catch {
      setError('Произошла ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>Новый пароль</h1>
        <p className={styles.subtitle}>Введите и подтвердите новый пароль</p>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Новый пароль</label>
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
            <label htmlFor="confirmPassword" className={styles.label}>Подтвердите</label>
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
          <button
            type="button"
            className={styles.link}
            onClick={() => navigate('/login')}
            disabled={isLoading}
          >
            ← Назад ко входу
          </button>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
