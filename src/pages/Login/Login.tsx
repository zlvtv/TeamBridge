import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button/Button';
import Input from '../../components/ui/Input/Input';
import styles from './Login.module.css';
import { supabase } from '../../lib/supabase';

/**
 * Компонент аутентификации с поддержкой входа, регистрации и восстановления пароля
 */
const Login: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { signUp, signIn } = useAuth();

  useEffect(() => {
    clearForm();
  }, [isSignUp, isForgotPassword]);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isForgotPassword) {
        const redirectUrl = `${window.location.origin}/recovery-callback`;
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });
      
        if (error) throw error;
      
        setSuccessMessage(`Password reset instructions have been sent to ${email}. Please check your email.`);
        setEmail('');
      } else if (isSignUp) {
        const result = await signUp(email, password, username);
        
        if (result.needsEmailConfirmation) {
          setSuccessMessage(`Registration successful! We've sent a confirmation email to ${email}. Please check your inbox and click the confirmation link to activate your account.`);
        } else if (result.session) {
          setSuccessMessage('Registration successful! Redirecting...');
        }
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToSignIn = () => {
    setIsSignUp(false);
    setIsForgotPassword(false);
  };

  const handleSwitchToSignUp = () => {
    setIsSignUp(true);
    setIsForgotPassword(false);
  };

  const handleSwitchToForgotPassword = () => {
    setIsForgotPassword(true);
    setIsSignUp(false);
  };

  const getTitle = () => {
    if (isForgotPassword) return 'Reset Password';
    return isSignUp ? 'Create Account' : 'Welcome Back';
  };

  const getSubmitButtonText = () => {
    if (isLoading) return 'Loading...';
    if (isForgotPassword) return 'Send Reset Instructions';
    return isSignUp ? 'Sign Up' : 'Sign In';
  };

  return (
    <div className={styles.login}>
      <div className={styles.login__card}>
        <h1 className={styles.login__title}>
          {getTitle()}
        </h1>
        
        <form onSubmit={handleSubmit} className={styles.login__form}>
          {isSignUp && (
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
            />
          )}
          
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
          
          {!isForgotPassword && (
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          )}

          {error && (
            <div className={styles.login__error}>
              {error.includes('already registered') ? (
                <div>
                  <strong>This email is already registered</strong>
                  <br />
                  Please sign in or use a different email address.
                </div>
              ) : (
                error
              )}
            </div>
          )}

          {successMessage && (
            <div className={styles.login__success}>
              {successMessage}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className={styles.login__button}
          >
            {getSubmitButtonText()}
          </Button>
        </form>

        <div className={styles.login__switch}>
          {isForgotPassword ? (
            <div className={styles.login__links}>
              <button
                type="button"
                onClick={handleSwitchToSignIn}
                className={styles.login__switchButton}
                disabled={isLoading}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <div className={styles.login__links}>
              <button
                type="button"
                onClick={isSignUp ? handleSwitchToSignIn : handleSwitchToSignUp}
                className={styles.login__switchButton}
                disabled={isLoading}
              >
                {isSignUp 
                  ? 'Already have an account? Sign In' 
                  : "Don't have an account? Sign Up"
                }
              </button>
              
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleSwitchToForgotPassword}
                  className={styles.login__switchButton}
                  disabled={isLoading}
                >
                  Forgot your password?
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;