import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';

const InvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { joinOrganization, refreshOrganizations, setCurrentOrganization } = useOrganization();
  const { user, isInitialized } = useAuth();
  const navigate = useNavigate();

  const hasBeenCalled = useRef(false);

  useEffect(() => {
    if (hasBeenCalled.current || !token) return;
    if (!isInitialized) return; 

    if (!user) {
      console.log('[InvitePage] Пользователь не авторизован — сохраняем токен и на /login');
      try {
        localStorage.setItem('invite_token', token);
      } catch (e) {
        console.error('[InvitePage] Не удалось сохранить токен', e);
      }
      navigate('/login', { replace: true });
      return;
    }

    hasBeenCalled.current = true;
    const acceptInvite = async () => {
      try {
        console.log('🔧 [InvitePage] Вызов joinOrganization с токеном:', token);
        const orgId = await joinOrganization(token);

        const orgs = await refreshOrganizations();
        const org = orgs.find(o => o.id === orgId);

        if (org) {
          setCurrentOrganization(org);
          navigate(`/organization/${orgId}`, { replace: true });
        } else {
          console.warn('Организация не найдена после вступления');
          navigate('/dashboard', { replace: true });
        }
      } catch (err: any) {
        const message = err.message || String(err);

        if (
          message.includes('duplicate key') ||
          message.includes('уже состоит')
        ) {
          const orgs = await refreshOrganizations();
          const org = orgs[0] || null;
          if (org) {
            setCurrentOrganization(org);
            navigate(`/organization/${org.id}`, { replace: true });
          } else {
            navigate('/');
          }
        } else if (
          message.includes('invalid') ||
          message.includes('not found')
        ) {
          alert('Приглашение недействительно');
          navigate('/', { replace: true });
        } else {
          alert('Ошибка вступления: ' + message);
          navigate('/dashboard', { replace: true });
        }
      }
    };

    acceptInvite();
  }, [token, user, isInitialized, navigate, joinOrganization, refreshOrganizations, setCurrentOrganization]);

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h2>Присоединяемся к организации...</h2>
      <p>Ожидание авторизации...</p>
    </div>
  );
};

export default InvitePage;