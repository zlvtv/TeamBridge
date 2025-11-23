import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button/Button';
import Input from '../../components/ui/Input/Input';
import styles from './ResetPassword.module.css';

/**
 * Компонент для установки нового пароля после восстановления
 */
const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidRecovery, setIsValidRecovery] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setIsValidRecovery(false);
          setError('Failed to verify recovery session.');
          return;
        }

        if (!session?.user?.email) {
          setIsValidRecovery(false);
          setError('Invalid recovery session. Please use a valid password reset link.');
          
          if (session?.user) {
            await supabase.auth.signOut();
          }
          return;
        }

        setIsValidRecovery(true);
        
      } catch (err) {
        setIsValidRecovery(false);
        setError('Failed to verify recovery session.');
      }
    };

    checkRecoverySession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccessMessage('Password updated successfully! Redirecting to login...');
      
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);

    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidRecovery === null) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>
            <div>Checking recovery link...</div>
            <div className={styles.loadingSubtext}>
              This should only take a moment
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isValidRecovery === false) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Cannot Reset Password</h1>
          <div className={styles.error}>
            {error}
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/login')}
            className={styles.button}
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Set New Password</h1>
        <p className={styles.subtitle}>
          Please enter your new password below.
        </p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              New Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm New Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {successMessage && (
            <div className={styles.success}>
              {successMessage}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className={styles.button}
          >
            {isLoading ? 'Updating Password...' : 'Update Password'}
          </Button>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/login');
              }}
              className={styles.backButton}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;