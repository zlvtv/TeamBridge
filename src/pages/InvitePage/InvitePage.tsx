import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { organizationService } from '../../services/organizationService';
import { getDocById } from '../../services/firestore/firestoreService';
import Button from '../../components/ui/button/button';
import LoadingState from '../../components/ui/loading/LoadingState';
import styles from './InvitePage.module.css';

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const { user, isInitialized } = useAuth();
  const { refreshOrganizations, setCurrentOrganization } = useOrganization();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'checking' | 'already-member' | 'joined' | 'error'>('checking');
  const [orgName, setOrgName] = useState<string>('');

  if (!isInitialized) return <LoadingState />;

  useEffect(() => {
    const checkAndJoin = async () => {
      if (!token) {
        setError('Неверная ссылка');
        setStatus('error');
        setLoading(false);
        return;
      }

      try {
        const inviteSnap = await getDocById('organization_invites', token);
        if (!inviteSnap) {
          setError('Приглашение не найдено. Возможно, оно было отозвано или срок действия истек.');
          setStatus('error');
          setLoading(false);
          return;
        }

        if (!inviteSnap.active) {
          setError('Приглашение отозвано.');
          setStatus('error');
          setLoading(false);
          return;
        }

        const expiresAt = inviteSnap.expires_at?.toDate ? inviteSnap.expires_at.toDate() : null;
        if (expiresAt && new Date() > expiresAt) {
          setError('Срок действия приглашения истек.');
          setStatus('error');
          setLoading(false);
          return;
        }

        const organizationId = inviteSnap.organization_id;
        const userId = user?.id;

        if (!userId) {
          navigate('/login', { replace: true, state: { fromInvite: token } });
          return;
        }

        const orgSnap = await getDocById('organizations', organizationId);
        if (!orgSnap) {
          setError('Организация не найдена. Возможно, она была удалена.');
          setStatus('error');
          setLoading(false);
          return;
        }

        const organizationName = orgSnap.name || 'Организация';
        setOrgName(organizationName);

        const isInOrg = await organizationService.isUserInOrganization(organizationId, userId);
        if (isInOrg) {
          setStatus('already-member');

          const orgs = await refreshOrganizations();
          const org = orgs.find((o) => o.id === organizationId);
          if (org) {
            setCurrentOrganization(org);
            localStorage.setItem('currentOrgId', org.id);
          }

          setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
          return;
        }

        const result = await organizationService.joinOrganization(token);
        setStatus('joined');
        setOrgName(result.orgName);

        const orgs = await refreshOrganizations();
        const newOrg = orgs.find((o) => o.id === result.organizationId);
        if (newOrg) {
          setCurrentOrganization(newOrg);
          localStorage.setItem('currentOrgId', newOrg.id);
        }

        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      } catch (err: any) {
        setError(err.message || 'Не удалось присоединиться к организации.');
        setStatus('error');
      } finally {
        setLoading(false);
      }
    };

    checkAndJoin();
  }, [token, user, navigate, refreshOrganizations, setCurrentOrganization]);

  return (
    <div className={styles.container}>
      {loading ? (
        <LoadingState message="Проверка приглашения..." />
      ) : status === 'already-member' ? (
        <div className={styles.content}>
          <h2>Вы уже состоите в «{orgName}»</h2>
          <p>Переадресация на дашборд...</p>
        </div>
      ) : status === 'joined' ? (
        <div className={styles.content}>
          <h2>Добро пожаловать в «{orgName}»!</h2>
          <p>Вы успешно присоединились.</p>
          <p>Переадресация на дашборд...</p>
        </div>
      ) : error ? (
        <div className={styles.content}>
          <h2>Не удалось присоединиться</h2>
          <div className={styles.errorBox}>
            <p className={styles.errorMessage}>{error}</p>
          </div>
          <Button onClick={() => navigate('/dashboard')}>На главную</Button>
        </div>
      ) : null}
    </div>
  );
};

export default InvitePage;
