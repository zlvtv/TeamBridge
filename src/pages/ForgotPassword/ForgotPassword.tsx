import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './ForgotPassword.module.css';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const checkIfUserExists = async (email: string): Promise<boolean> => {
    const { data } = await supabase.rpc('is_email_registered', { user_email: email });
    return data ?? false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const emailTrimmed = email.trim();

    try {
      const userExists = await checkIfUserExists(emailTrimmed);
      if (!userExists) {
        setError('Пользователь с таким email не найден');
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
        redirectTo: `${window.location.origin}/recovery/callback`,
      });

      if (resetError) {
        setError('Не удалось отправить ссылку. Повторите попытку.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Произошла ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>{success ? 'Проверьте почту' : 'Восстановление пароля'}</h1>

        {success ? (
          <div className={styles.successContainer}>
            <p className={styles.subtitle}>
              На адрес <strong>{email}</strong> отправлено письмо с инструкциями.
            </p>
            <p className={styles.spamHint}>Проверьте папку «Спам», если письмо не пришло.</p>
            <button className={styles.submit} onClick={() => navigate('/login')}>
              Войти
            </button>
          </div>
        ) : (
          <>
            <p className={styles.subtitle}>Введите email, чтобы получить ссылку для восстановления</p>
            {error && <div className={styles.error}>{error}</div>}
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Электронная почта</label>
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
              <button type="submit" className={styles.submit} disabled={isLoading}>
                {isLoading ? 'Отправка...' : 'Отправить ссылку'}
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
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
