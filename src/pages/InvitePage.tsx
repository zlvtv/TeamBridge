// src/pages/InvitePage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import Button from '../components/ui/button/button';
import styles from './InvitePage.module.css';

const InvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refreshOrganizations } = useOrganization();
  const [status, setStatus] = useState<'loading' | 'success' | 'expired' | 'error'>('loading');

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setStatus('error');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Перенаправить на login с сохранением токена
        navigate(`/login?invite=${token}`);
        return;
      }

      const { error } = await supabase.rpc('accept_organization_invite', {
        invite_token: token,
        user_id: user.id,
      });

      if (error) {
        if (error.message.includes('expired')) setStatus('expired');
        else setStatus('error');
        return;
      }

      await refreshOrganizations();
      setStatus('success');
    };

    acceptInvite();
  }, [token, navigate, refreshOrganizations]);

  if (status === 'loading') return <div>Загрузка...</div>;

  return (
    <div className={styles.container}>
      {status === 'success' && (
        <>
          <h1>✅ Успешно!</h1>
          <p>Вы вступили в организацию.</p>
          <Button onClick={() => navigate('/dashboard')}>Перейти в организацию</Button>
        </>
      )}

      {status === 'expired' && (
        <>
          <h1>❌ Приглашение истекло</h1>
          <p>Срок действия пригласительной ссылки истёк.</p>
          <Button onClick={() => navigate('/')}>На главную</Button>
        </>
      )}

      {status === 'error' && (
        <>
          <h1>❌ Ошибка</h1>
          <p>Приглашение недействительно.</p>
          <Button onClick={() => navigate('/')}>На главную</Button>
        </>
      )}
    </div>
  );
};

export default InvitePage;
