import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/globals.css';

const handleAuthCallback = () => {
  const hash = window.location.hash;

  if (hash) {
    const urlParams = new URLSearchParams(hash.replace('#', '?'));

    const accessToken = urlParams.get('access_token');
    const type = urlParams.get('type');

    if (accessToken) {
      if (type === 'recovery') {
        localStorage.setItem('auth_recovery_token', accessToken);
        window.location.href = '/reset-password';
        return true;
      } else if (type === 'signup' || type === 'magiclink' || type === 'invite') {
        window.location.href = '/confirm';
        return true;
      }
    }
  }

  return false;
};

if (!handleAuthCallback()) {
  createRoot(document.getElementById('root')).render(
      <App />
  );
}
