import React, { useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../ui/button/button';
import Input from '../../ui/input/input';
import Toast from '../../ui/toast/Toast';
import styles from './org-info-modal.module.css';
import EditOrganizationModal from '../../modals/edit-organization-modal/edit-organization-modal';
import UserInfoModal from '../../user-info-modal/user-info-modal';
import ConfirmationModal from '../../ui/confirmation-modal/confirmation-modal';

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
  const {
    currentOrganization,
    leaveOrganization,
    deleteOrganization,
    createOrganizationInvite,
    refreshOrganizations,
  } = useOrganization();
  const { user } = useAuth();

  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastId = useRef(0);

  const isOwner = currentOrganization?.created_by === user?.id;
  const currentUserMember = currentOrganization?.organization_members?.find(
    (m) => m.user_id === user?.id
  );
  const isModerator = isOwner || !!currentUserMember?.status === 'admin';
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMembers = useMemo(() => {
    if (!currentOrganization?.organization_members) return [];

    const term = searchTerm.toLowerCase().trim();
    if (!term) return currentOrganization.organization_members;

    return currentOrganization.organization_members.filter((member) => {
      const displayName = (member.user?.full_name || '').toLowerCase();
      const username = (member.user?.username || '').toLowerCase();
      const email = (member.user?.email || '').toLowerCase();
      const systemRole =
        member.status === 'owner'
          ? 'владелец'
          : member.status === 'admin'
          ? 'модератор'
          : 'участник';
      const memberStatus = member.status === 'pending' ? 'ожидание' : 'активен';

      const customRoles = Array.isArray(member.roles)
        ? member.roles.map((r) => r.toLowerCase())
        : typeof member.roles === 'string'
        ? [member.roles.toLowerCase()]
        : [];

      return (
        displayName.includes(term) ||
        username.includes(term) ||
        email.includes(term) ||
        systemRole.includes(term) ||
        memberStatus.includes(term) ||
        customRoles.some((role) => role.includes(term))
      );
    });
  }, [currentOrganization?.organization_members, searchTerm]);

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
      await deleteOrganization(currentOrganization.id);
      await refreshOrganizations();
      showToast('Организация удалена', 'success');
      onClose();
    } catch (err: any) {
      console.error('Ошибка удаления:', err);
      showToast('Ошибка: ' + (err.message || 'Не удалось удалить'), 'error');
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

      if (data?.invite_link) {
        setInviteLink(data.invite_link);
        setExpiresAt(data.expires_at);

        navigator.clipboard
          .writeText(data.invite_link)
          .then(() => {
            showToast('Ссылка создана и скопирована!', 'success');
          })
          .catch(() => {
            showToast('Ссылка создана. Нажмите, чтобы скопировать.', 'success');
          });
      } else {
        setError('Нет ссылки в ответе');
        showToast('Не удалось создать приглашение', 'error');
      }
    } catch (err: any) {
      setError(err.message);
      showToast('Ошибка: ' + err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const anchorRect = anchorEl.getBoundingClientRect();
  const modalWidth = 360;
  const leftGap = 8;
  let left = anchorRect.left - modalWidth - leftGap;
  if (left < 0) left = anchorRect.left + leftGap;
  const top = anchorRect.bottom + 8;

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userInfoPosition, setUserInfoPosition] = useState({ x: 0, y: 0 });

  const handleAvatarClick = (e: React.MouseEvent, member: any) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setUserInfoPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + window.scrollY,
    });

    setSelectedUser({
      id: member.user.id,
      email: member.user.email,
      username: member.user.username,
      full_name: member.user.full_name || member.user.username || 'Пользователь',
      avatar_url: member.user.avatar_url,
      roles: Array.isArray(member.roles)
        ? member.roles.filter(Boolean)
        : typeof member.roles === 'string' && member.roles.trim() !== ''
        ? [member.roles]
        : [],
      description: member.user.description || null,
    });
  };

  const closeUserInfoModal = () => {
    setSelectedUser(null);
  };

  if (!currentOrganization) return null;

  return createPortal(
    <div
      className={styles['org-info-modal__overlay']}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
    >
      {isEditOrgModalOpen && (
        <EditOrganizationModal
          isOpen={isEditOrgModalOpen}
          onClose={() => {
            setIsEditOrgModalOpen(false);
            onClose();
          }}
          organizationId={currentOrganization.id}
          initialName={currentOrganization.name}
          initialDescription={currentOrganization.description || ''}
          initialRoles={currentOrganization.roles || []}
          initialAutoRemove={currentOrganization.autoRemoveMembers || false}
        />
      )}

      {selectedUser && (
        <UserInfoModal
          user={selectedUser}
          position={userInfoPosition}
          onClose={closeUserInfoModal}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          title="Удалить организацию?"
          description="Это действие нельзя отменить. Все проекты, задачи и сообщения будут безвозвратно удалены."
          confirmText="Удалить"
          cancelText="Отмена"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isDanger
          isLoading={isDeleting}
        />
      )}

      {showLeaveConfirm && (
        <ConfirmationModal
          isOpen={showLeaveConfirm}
          title="Покинуть организацию?"
          description="Вы больше не сможете получать сообщения и доступ к проектам этой организации."
          confirmText="Покинуть"
          cancelText="Отмена"
          onConfirm={confirmLeave}
          onCancel={() => setShowLeaveConfirm(false)}
          isDanger
          isLoading={isLeaving}
        />
      )}

      <div
        ref={modalRef}
        className={styles['org-info-modal']}
        style={{ position: 'absolute', top: `${top}px`, left: `${left}px` }}
        role="dialog"
        aria-label="Информация об организации"
      >
        <h3 className={styles['org-info-modal__title']}>
          {currentOrganization.name}
          {isOwner && (
            <button
              className={styles['org-info-modal__edit-button']}
              onClick={() => setIsEditOrgModalOpen(true)}
              aria-label="Редактировать организацию"
            >
              🔧
            </button>
          )}
        </h3>

        {currentOrganization.description && (
          <div className={styles['org-info-modal__section']}>
            <div>{currentOrganization.description}</div>
          </div>
        )}

        <div className={styles['org-info-modal__section']}>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск участников..."
            size="small"
            fullWidth
          />
          <strong>Участники ({filteredMembers.length}):</strong>
          <div className={styles['org-info-modal__members']}>
            {filteredMembers.map((member) => {
              const displayName =
                member.user?.full_name ||
                (member.user?.username ? `@${member.user.username}` : `Пользователь ${member.id.slice(-5)}`);

              const systemRoleLabel =
                member.status === 'owner'
                  ? 'Владелец'
                  : member.status === 'admin'
                  ? 'Модератор'
                  : 'Участник';

              const customRoles = Array.isArray(member.roles)
                ? member.roles.filter(Boolean)
                : typeof member.roles === 'string' && member.roles.trim() !== ''
                ? [member.roles]
                : [];

              return (
                <div
                  key={member.id}
                  className={styles['org-info-modal__member']}
                  onClick={(e) => handleAvatarClick(e, member)}
                >
                  <div className={styles['org-info-modal__avatar']} title={displayName}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles['org-info-modal__member-info']}>
                    <span className={styles['org-info-modal__member-name']}>{displayName}</span>
                    <span
                      className={`${styles['org-info-modal__status-badge']} ${
                        styles[
                          member.status === 'owner'
                            ? 'org-info-modal__status-badge--owner'
                            : member.status === 'admin'
                            ? 'org-info-modal__status-badge--admin'
                            : 'org-info-modal__status-badge--member'
                        ]
                      }`}
                    >
                      {systemRoleLabel}
                    </span>
                  </div>
                  <div className={styles['org-info-modal__member-roles']}>
                    {customRoles.map((roleName) => {
                      const role = currentOrganization.roles?.find((r) => r.name === roleName);
                      return (
                        <span
                          key={roleName}
                          className={styles['org-info-modal__role-badge']}
                          style={{ backgroundColor: role?.color || 'var(--color-primary)' }}
                        >
                          {roleName}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isOwner && (
          <div className={styles['org-info-modal__section']}>
            {inviteLink ? (
              <div className={styles['org-info-modal__link-container']}>
                <Input
                  value={inviteLink}
                  readOnly
                  fullWidth
                  size="small"
                  style={{ marginBottom: '8px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink).then(
                      () => showToast('Скопировано!', 'success'),
                      () => showToast('Не удалось скопировать', 'error')
                    );
                  }}
                  title="Нажмите, чтобы скопировать"
                />
                {expiresAt && <small>Ссылка действительна 1 час.</small>}
              </div>
            ) : (
              <div className={styles['org-info-modal__actions']}>
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleGenerateInvite}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Создание...' : 'Создать ссылку-приглашение'}
                </Button>
              </div>
            )}
            {error && <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>{error}</div>}

            <div className={styles['org-info-modal__actions']}>
              {!isOwner && (
                <Button variant="danger" size="small" onClick={handleLeaveOrg}>
                  Покинуть организацию
                </Button>
              )}
              {isOwner && (
                <Button variant="danger" size="small" onClick={handleDeleteOrg}>
                  Удалить организацию
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10010 }}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => closeToast(toast.id)}
          />
        ))}
      </div>
    </div>,
    document.body
  );
};

export default OrgInfoModal;
