import React, { useRef, useEffect, useState } from 'react';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../ui/button/button';
import Input from '../../ui/input/input';
import styles from './org-info-modal.module.css';

interface OrgInfoModalProps {
  anchorEl: HTMLElement;
  onClose: () => void;
}

const OrgInfoModal: React.FC<OrgInfoModalProps> = ({ anchorEl, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { currentOrganization, leaveOrganization, deleteOrganization, createOrganizationInvite } = useOrganization();
  const { user } = useAuth();

  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentOrganization?.created_by === user?.id;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [anchorEl, onClose]);

  if (!currentOrganization) return null;

  const handleLeaveOrg = async () => {
    if (!window.confirm('Вы уверены, что хотите выйти из организации?')) return;

    setIsLeaving(true);
    try {
      await leaveOrganization(currentOrganization.id);
      onClose();
    } catch (err: any) {
      alert('Ошибка выхода: ' + err.message);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить организацию? Все данные будут потеряны.')) return;

    setIsDeleting(true);
    try {
      await deleteOrganization(currentOrganization.id);
      onClose();
    } catch (err: any) {
      alert('Ошибка удаления: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateInvite = async () => {
  if (!currentOrganization) return;

  setIsGenerating(true);
  setError(null);

  try {
    const data = await createOrganizationInvite(currentOrganization.id);

    if (data && data.invite_link) {
      setInviteLink(data.invite_link);
      setExpiresAt(data.expires_at);
    } else {
      setError('Не удалось получить ссылку');
    }
  } catch (err: any) {
    setError(err.message || 'Не удалось создать приглашение');
  } finally {
    setIsGenerating(false);
  }
};

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      alert('Ссылка скопирована в буфер обмена');
    }
  };

  const anchorRect = anchorEl.getBoundingClientRect();
  const modalWidth = 360;
  const leftGap = 8;
  let left = anchorRect.left - modalWidth - leftGap;
  if (left < 0) left = anchorRect.left + leftGap;
  const top = anchorRect.bottom + 8;

  return (
    <div
      ref={modalRef}
      className={styles.modal}
      style={{ position: 'absolute', top: `${top}px`, left: `${left}px`, zIndex: 10000 }}
      role="dialog"
      aria-label="Информация об организации"
    >
      <h3 className={styles.title}>{currentOrganization.name}</h3>

      {currentOrganization.description && (
        <div className={styles.section}>
          <strong>Описание:</strong>
          <p>{currentOrganization.description}</p>
        </div>
      )}

      <div className={styles.section}>
        <strong>Участники ({currentOrganization.organization_members?.length || 1}):</strong>
        <div className={styles.members}>
          {currentOrganization.organization_members?.map((member) => (
            <div key={member.id} className={styles.member}>
              <div
                className={styles.avatar}
                title={member.user?.full_name || `@${member.user?.username}`}
              >
                {member.user?.full_name?.charAt(0).toUpperCase() ||
                 member.user?.username?.charAt(0).toUpperCase() ||
                 'U'}
              </div>
              <span>{member.user?.full_name || `@${member.user?.username}`}</span>
              <span className={styles.role}>
                {member.role === 'owner' ? 'Владелец' : 'Участник'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isOwner && (
        <div className={styles.section}>
          <strong>Пригласить участников:</strong>
          {inviteLink ? (
            <div className={styles.inviteLink}>
              <Input
                value={inviteLink}
                readOnly
                fullWidth
                size="small"
                style={{ marginBottom: '8px' }}
              />
              <Button variant="secondary" size="small" onClick={handleCopyLink}>
                Скопировать ссылку
              </Button>
              {inviteLink && expiresAt && (
  <div className={styles.inviteInfo}>
    <small>
      Ссылка действительна 1 час.
  </small>
</div>
)}
            </div>
          ) : (
            <Button
              variant="primary"
              size="small"
              onClick={handleGenerateInvite}
              disabled={isGenerating}
            >
              {isGenerating ? 'Создание...' : 'Создать ссылку-приглашение'}
            </Button>
          )}
          {error && <div className={styles.error}>{error}</div>}
        </div>
      )}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={handleLeaveOrg}
          disabled={isLeaving || isOwner}
          title={isOwner ? 'Владелец не может выйти. Удалите организацию вместо этого.' : undefined}
        >
          {isLeaving ? 'Выход...' : 'Выйти из организации'}
        </Button>

        {isOwner && (
          <Button
            variant="danger"
            onClick={handleDeleteOrg}
            disabled={isDeleting}
          >
            {isDeleting ? 'Удаление...' : 'Удалить организацию'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OrgInfoModal;
