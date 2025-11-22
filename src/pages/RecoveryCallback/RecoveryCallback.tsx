// RecoveryCallback.tsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './RecoveryCallback.module.css';

const RecoveryCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleRecoveryCallback = async () => {
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get('type');
    
    if (type !== 'recovery' && !location.hash.includes('type=recovery')) {
      navigate('/login?error=invalid_recovery_type', { replace: true });
      return;
    }
      try {
        // Supabase автоматически обрабатывает токен из URL
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          navigate('/login?error=session_error', { replace: true });
          return;
        }

        // RecoveryCallback.tsx
        if (session?.user) {
            navigate('/password-recovery', { replace: true });
        } else {
        // Если сессии нет, пробуем извлечь токен из URL
        const hashParams = new URLSearchParams(location.hash.replace('#', ''));
        const accessToken = hashParams.get('access_token');
        
        if (accessToken) {
            navigate('/password-recovery', { replace: true });
        } else {
            navigate('/login?error=recovery_failed', { replace: true });
        }
        }

      } catch (err) {
        console.error('Recovery callback error:', err);
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