import React, { useRef, useEffect, useState } from 'react';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../ui/button/button';
import Input from '../../ui/input/input';
import Toast from '../../ui/toast/Toast';
import styles from './org-info-modal.module.css';

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

interface OrgInfoModalProps {
  anchorEl: HTMLElement;
  onClose: () => void;
}

const OrgInfoModal: React.FC<OrgInfoModalProps> = ({ anchorEl, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { currentOrganization, leaveOrganization, deleteOrganization, createOrganizationInvite, refreshCurrentOrganization } = useOrganization();
  const { user } = useAuth();

  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastId = useRef(0);

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

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const closeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLeaveOrg = () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeave = async () => {
    setIsLeaving(true);
    try {
      await leaveOrganization(currentOrganization.id);
      onClose();
      showToast('Вы вышли из организации', 'success');
    } catch (err: any) {
      showToast('Ошибка выхода: ' + err.message, 'error');
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleDeleteOrg = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      onClose();
      await deleteOrganization(currentOrganization.id);
      showToast('Организация удалена', 'success');
    } catch (err: any) {
      showToast('Ошибка удаления: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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
        showToast('Ссылка создана', 'success');
      } else {
        setError('Не удалось получить ссылку');
        showToast('Не удалось создать приглашение', 'error');
      }
    } catch (err: any) {
      const message = err.message || 'Не удалось создать приглашение';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      showToast('Ссылка скопирована в буфер обмена', 'success');
    }
  };

  const anchorRect = anchorEl.getBoundingClientRect();
  const modalWidth = 360;
  const leftGap = 8;
  let left = anchorRect.left - modalWidth - leftGap;
  if (left < 0) left = anchorRect.left + leftGap;
  const top = anchorRect.bottom + 8;

  return (
    <>
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
            {currentOrganization.organization_members?.map((member) => {
              const displayName = member.user?.full_name ||
                (member.user?.username ? `@${member.user.username}` : `Пользователь ${member.id.slice(-5)}`);

              return (
                <div key={member.id} className={styles.member}>
                  <div className={styles.avatar} title={displayName}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <span>{displayName}</span>
                  <span className={styles.role}>
                    {member.role === 'owner' ? 'Владелец' : 'Участник'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {isOwner && (
          <div className={styles.section}>
            <strong>Пригласить участников:</strong>
            {inviteLink ? (
              <div className={styles.inviteLink}>
                <Input value={inviteLink} readOnly fullWidth size="small" style={{ marginBottom: '8px' }} />
                <Button variant="secondary" size="small" onClick={handleCopyLink}>
                  Скопировать ссылку
                </Button>
                {expiresAt && (
                  <div className={styles.inviteInfo}>
                    <small>Ссылка действительна 1 час.</small>
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

        {showLeaveConfirm ? (
          <div className={styles.section}>
            <p>Вы уверены, что хотите выйти? Доступ к проектам будет закрыт.</p>
            <div className={styles.actions}>
              <Button variant="secondary" size="small" onClick={() => setShowLeaveConfirm(false)}>
                Отмена
              </Button>
              <Button variant="primary" size="small" onClick={confirmLeave} disabled={isLeaving}>
                {isLeaving ? 'Выход...' : 'Выйти'}
              </Button>
            </div>
          </div>
        ) : showDeleteConfirm ? (
          <div className={styles.section}>
            <p>Вы уверены, что хотите удалить организацию? Все данные будут потеряны безвозвратно.</p>
            <div className={styles.actions}>
              <Button variant="secondary" size="small" onClick={() => setShowDeleteConfirm(false)}>
                Отмена
              </Button>
              <Button variant="danger" size="small" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        ) : (
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
              <Button variant="danger" onClick={handleDeleteOrg} disabled={isDeleting}>
                {isDeleting ? 'Удаление...' : 'Удалить организацию'}
              </Button>
            )}
          </div>
        )}
      </div>

      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => closeToast(toast.id)}
        />
      ))}
    </>
  );
};

export default OrgInfoModal;
