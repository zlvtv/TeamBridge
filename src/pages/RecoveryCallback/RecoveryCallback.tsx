// RecoveryCallback.tsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './RecoveryCallback.module.css';

/**
 * Обрабатывает callback от Supabase после перехода по ссылке восстановления пароля
 */
const RecoveryCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleRecoveryCallback = async () => {
      try {
        // Supabase автоматически обрабатывает токен из URL
        await new Promise(resolve => setTimeout(resolve, 3000));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          navigate('/login?error=session_error', { replace: true });
          return;
        }

        if (session?.user) {
          navigate('/password-recovery', { replace: true });
        } else {
          // Попытка ручного извлечения токена из хэша
          if (location.hash) {
            const hashParams = new URLSearchParams(location.hash.replace('#', ''));
            const accessToken = hashParams.get('access_token');
            const tokenType = hashParams.get('token_type');
            
            if (accessToken && tokenType === 'bearer') {
              navigate('/password-recovery', { replace: true });
              return;
            }
          }
          
          navigate('/login?error=recovery_failed', { replace: true });
        }

      } catch (err) {
        navigate('/login?error=recovery_error', { replace: true });
      }
    };

    handleRecoveryCallback();
  }, [navigate, location]);

  return (
    <div className={styles.container}>
      <div className={styles.message}>Processing password recovery...</div>
      <div className={styles.spinner}></div>
    </div>
  );
};

export default RecoveryCallback;