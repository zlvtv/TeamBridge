import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, applyActionCode } from 'firebase/auth';
import AuthLoadingPage from '../../components/ui/loading/AuthLoadingPage';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const auth = getAuth(); 

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    if (!mode || !oobCode) {
      navigate('/login', { replace: true });
      return;
    }

    switch (mode) {
      case 'verifyEmail':
        applyActionCode(auth, oobCode)
          .then(() => {
            navigate('/confirm?verified=true', { replace: true });
          })
          .catch((error) => {
            console.error('Ошибка подтверждения email:', error);
            navigate(`/confirm?error=${encodeURIComponent(error.message)}`, { replace: true });
          });
        break;

      case 'resetPassword':
        navigate(`/recovery/callback?oobCode=${oobCode}`, { replace: true });
        break;

      case 'signIn':
        navigate(`/confirm?mode=signIn&oobCode=${oobCode}`, { replace: true });
        break;

      default:
        navigate('/login', { replace: true });
    }
  }, [navigate]);

  return <AuthLoadingPage message="Подтверждение email..." />;
};

export default AuthCallback;
