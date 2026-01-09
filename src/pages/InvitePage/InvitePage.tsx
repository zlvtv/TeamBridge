// src/pages/InvitePage/InvitePage.tsx

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';

const InvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { joinOrganization, refreshOrganizations, setCurrentOrganization } = useOrganization();
  const { user, isInitialized, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  // Обработка после входа
  useEffect(() => {
    const handleInviteAfterLogin = (e: CustomEvent) => {
      navigate(`/invite/${e.detail}`, { replace: true });
    };

    window.addEventListener('invite_after_login', handleInviteAfterLogin as any);
    return () => {
      window.removeEventListener('invite_after_login', handleInviteAfterLogin as any);
    };
  }, [navigate]);

  useEffect(() => {
    let hasBeenCalled = false;

    const acceptInvite = async () => {
      if (hasBeenCalled) return;
      hasBeenCalled = true;

      if (!isInitialized || isAuthLoading) return;

      if (!user) {
        if (token) localStorage.setItem('invite_token', token);
        navigate('/login', { replace: true });
        return;
      }

      if (!token) {
        navigate('/');
        return;
      }

      try {
        // 1. Вступаем
        const orgId = await joinOrganization(token);

        // 2. Обновляем список (полностью)
        const fullOrgs = await refreshOrganizations();

        // 3. Ищем организацию
        const newOrg = fullOrgs.find(org => org.id === orgId);

        if (newOrg) {
          // 4. Устанавливаем как текущую
          setCurrentOrganization(newOrg);
          // 5. Переходим на дашборд
          navigate(`/organization/${orgId}`, { replace: true });
        } else {
          // Если не нашли — возможно, задержка, но мы уже в ней
          navigate('/');
        }
      } catch (err: any) {
        const message = err.message || String(err);

        // Уже состоит — просто обновим и переключим
        if (message.includes('duplicate key') || message.includes('уже состоит')) {
          const fullOrgs = await refreshOrganizations();
          const existingOrg = fullOrgs.find(org => org.id === err.orgId) || fullOrgs[0];
          if (existingOrg) {
            setCurrentOrganization(existingOrg);
            navigate(`/organization/${existingOrg.id}`, { replace: true });
          } else {
            navigate('/');
          }
        } else if (message.includes('Приглашение недействительно')) {
          // Может быть уже принято
          const fullOrgs = await refreshOrganizations();
          const existingOrg = fullOrgs[0] || null;
          if (existingOrg) {
            setCurrentOrganization(existingOrg);
            navigate(`/organization/${existingOrg.id}`, { replace: true });
          } else {
            navigate('/');
          }
        } else {
          console.error('❌ Ошибка вступления:', err);
          navigate('/');
        }
      }
    };

    acceptInvite();
  }, [
    token,
    joinOrganization,
    refreshOrganizations,
    setCurrentOrganization,
    navigate,
    user,
    isInitialized,
    isAuthLoading,
  ]);

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h2>Присоединяемся к организации...</h2>
      <p>Не закрывайте страницу</p>
    </div>
  );
};

export default InvitePage;
