import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLoadingPage from '../../components/ui/loading/AuthLoadingPage';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    if (!mode || !oobCode) {
      navigate('/password-recovery', { replace: true });
      return;
    }

    switch (mode) {
      case 'resetPassword':
        navigate(`/recovery/callback?oobCode=${oobCode}`, { replace: true });
        break;

      case 'verifyEmail':
        navigate(`/confirm?oobCode=${oobCode}`, { replace: true });
        break;

      case 'signIn':
        navigate(`/confirm?mode=signIn&oobCode=${oobCode}`, { replace: true });
        break;

      default:
        navigate('/login', { replace: true });
    }
  }, [navigate]);

  return <AuthLoadingPage message="Проверка ссылки подтверждения..." />;
};

export default AuthCallback;
