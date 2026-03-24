import React, { useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../ui/button/button';
import Input from '../../ui/input/input';
import Toast from '../../ui/toast/Toast';
import styles from './org-info-modal.module.css';
import UserInfoModal from '../../user-info-modal/user-info-modal';
import ConfirmationModal from '../../ui/confirmation-modal/confirmation-modal';
import { getPresenceStatus } from '../../../utils/presence.utils';
import { isDeletedUserProfile } from '../../../utils/user.utils';
import { canManageOrganization, isOrganizationOwner } from '../../../utils/permissions';

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

interface OrgInfoModalProps {
  anchorEl: HTMLElement;
  onClose: () => void;
}

const normalizeRoleKey = (role: string) => role.trim().toLocaleLowerCase('ru');

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
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('all');

  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastId = useRef(0);
  const [stableOrganization, setStableOrganization] = useState(currentOrganization);

  useEffect(() => {
    if (currentOrganization) {
      setStableOrganization(currentOrganization);
    }
  }, [currentOrganization]);

  const resolvedOrganization = currentOrganization || stableOrganization;

  const isOwner = isOrganizationOwner(resolvedOrganization, user?.id);
  const currentUserMember = resolvedOrganization?.organization_members?.find((member) => member.user_id === user?.id);
  const canEditOrganization = canManageOrganization(resolvedOrganization, user?.id);
  const [searchTerm, setSearchTerm] = useState('');

  const systemRoleFilters = [
    { id: 'all', label: 'Все' },
    { id: 'owner', label: 'Владельцы' },
    { id: 'admin', label: 'Модераторы' },
    { id: 'member', label: 'Участники' },
  ];

  const customRoleFilters = (resolvedOrganization?.roles || [])
    .filter((role) => role?.name)
    .map((role) => ({
      id: `custom:${role.name}`,
      label: role.name,
      color: role.color,
    }));

  const filteredMembers = useMemo(() => {
    if (!resolvedOrganization?.organization_members) return [];

    const term = searchTerm.toLowerCase().trim();
    return resolvedOrganization.organization_members.filter((member) => {
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

      const matchesSearch =
        !term ||
        displayName.includes(term) ||
        username.includes(term) ||
        email.includes(term) ||
        systemRole.includes(term) ||
        memberStatus.includes(term) ||
        customRoles.some((role) => role.includes(term));

      const matchesRoleFilter =
        activeRoleFilter === 'all' ||
        (activeRoleFilter === 'owner' && member.status === 'owner') ||
        (activeRoleFilter === 'admin' && member.status === 'admin') ||
        (activeRoleFilter === 'member' && !['owner', 'admin'].includes(String(member.status || '').toLowerCase())) ||
        (activeRoleFilter.startsWith('custom:') &&
          customRoles.includes(activeRoleFilter.replace('custom:', '').toLowerCase()));

      return matchesSearch && matchesRoleFilter;
    });
  }, [activeRoleFilter, resolvedOrganization?.organization_members, searchTerm]);

  const sortedMembers = useMemo(() => {
    const rank = (member: any) => {
      if (member.status === 'owner') return 0;
      if (member.status === 'admin') return 1;
      return 2;
    };

    return [...filteredMembers].sort((a, b) => {
      const roleDiff = rank(a) - rank(b);
      if (roleDiff !== 0) return roleDiff;
      const aName = a.user?.full_name || a.user?.username || '';
      const bName = b.user?.full_name || b.user?.username || '';
      return aName.localeCompare(bName, 'ru');
    });
  }, [filteredMembers]);

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
    if (!resolvedOrganization?.id) return;
    setIsLeaving(true);
    try {
      await leaveOrganization(resolvedOrganization.id);
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
    if (!resolvedOrganization?.id) return;
    setIsDeleting(true);
    try {
      await deleteOrganization(resolvedOrganization.id);
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
    if (!resolvedOrganization) return;

    setIsGenerating(true);
    setError(null);

    try {
      const data = await createOrganizationInvite(resolvedOrganization.id);

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

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userInfoPosition, setUserInfoPosition] = useState({ x: 0, y: 0 });

  const handleAvatarClick = (e: React.MouseEvent, member: any) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setUserInfoPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + window.scrollY,
    });

    const systemRole =
      member.status === 'owner'
        ? { name: 'Владелец', color: '#b45309' }
        : member.status === 'admin'
        ? { name: 'Модератор', color: 'var(--color-primary)' }
        : { name: 'Участник' };
    const customRoles = Array.isArray(member.roles)
      ? member.roles
          .filter(Boolean)
          .map((roleName: string) => {
            const foundRole = resolvedOrganization?.roles?.find((role) => role.name === roleName);
            return { name: roleName, color: foundRole?.color };
          })
      : typeof member.roles === 'string' && member.roles.trim() !== ''
      ? [{ name: member.roles, color: resolvedOrganization?.roles?.find((role) => role.name === member.roles)?.color }]
      : [];

    setSelectedUser({
      id: member.user.id,
      email: member.user.email,
      username: member.user.username,
      full_name: member.user.full_name || member.user.username || 'Пользователь',
      avatar_url: member.user.avatar_url,
      roles: [systemRole, ...customRoles],
      description: member.user.description || null,
    });
  };

  const closeUserInfoModal = () => {
    setSelectedUser(null);
  };

  if (!resolvedOrganization) return null;

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
        role="dialog"
        aria-label="Информация об организации"
      >
        <h3 className={styles['org-info-modal__title']}>{resolvedOrganization.name}</h3>
        {resolvedOrganization.description ? (
          <p className={styles['org-info-modal__title-description']}>{resolvedOrganization.description}</p>
        ) : null}

        <div className={styles['org-info-modal__tabs']}>
          <button
            type="button"
            className={`${styles['org-info-modal__tab']} ${activeTab === 'members' ? styles['org-info-modal__tab--active'] : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Обзор
          </button>
          {canEditOrganization && (
            <button
              type="button"
              className={`${styles['org-info-modal__tab']} ${activeTab === 'settings' ? styles['org-info-modal__tab--active'] : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Настройки
            </button>
          )}
        </div>

        {activeTab === 'members' && (
          <>

        <div className={styles['org-info-modal__section']}>
          <div className={styles['org-info-modal__filter-group']}>
            <div className={styles['org-info-modal__filter-label']}>Системные роли</div>
            <div className={styles['org-info-modal__filter-row']}>
              {systemRoleFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`${styles['org-info-modal__filter-chip']} ${activeRoleFilter === filter.id ? styles['org-info-modal__filter-chip--active'] : ''}`}
                  onClick={() => setActiveRoleFilter((prev) => (prev === filter.id ? 'all' : filter.id))}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {customRoleFilters.length > 0 && (
            <div className={styles['org-info-modal__filter-group']}>
              <div className={styles['org-info-modal__filter-label']}>Кастомные роли</div>
              <div className={styles['org-info-modal__filter-row']}>
                {customRoleFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`${styles['org-info-modal__filter-chip']} ${activeRoleFilter === filter.id ? styles['org-info-modal__filter-chip--active'] : ''}`}
                    style={activeRoleFilter === filter.id ? { borderColor: filter.color, color: filter.color } : undefined}
                    onClick={() => setActiveRoleFilter((prev) => (prev === filter.id ? 'all' : filter.id))}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск участников..."
            size="small"
            fullWidth
          />
          <strong>Участники ({sortedMembers.length}):</strong>
          <div className={styles['org-info-modal__members']}>
            {sortedMembers.map((member) => {
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
              const presence = getPresenceStatus(member.user?.last_seen_at);
              const deletedUser = isDeletedUserProfile(member.user);

              return (
                <div
                  key={member.id}
                  className={styles['org-info-modal__member']}
                  onClick={(e) => handleAvatarClick(e, member)}
                >
                  <div className={styles['org-info-modal__avatar']} title={displayName}>
                    {member.user?.avatar_url ? (
                      <img src={member.user.avatar_url} alt={displayName} className={styles['org-info-modal__avatar-image']} />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={styles['org-info-modal__member-info']}>
                    <div className={styles['org-info-modal__member-topline']}>
                      <span className={styles['org-info-modal__member-name']}>{displayName}</span>
                    </div>
                    {!deletedUser ? (
                      <div className={styles['org-info-modal__member-secondary']}>
                        @{member.user?.username || 'unknown'}
                      </div>
                    ) : null}
                    <div
                      className={`${styles['org-info-modal__member-last-seen']} ${styles[`org-info-modal__member-last-seen--${presence.tone}`]}`}
                    >
                      <span className={styles['org-info-modal__presence-dot']} />
                      {presence.label}
                    </div>
                    <div className={styles['org-info-modal__member-roles']}>
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
                      {customRoles.map((roleName) => {
                        const role = resolvedOrganization.roles?.find(
                          (r) => normalizeRoleKey(r.name) === normalizeRoleKey(roleName)
                        );
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
                </div>
              );
            })}
          </div>

          {!isOwner && (
            <div className={`${styles['org-info-modal__settings-card']} ${styles['org-info-modal__overview-action-card']}`}>
              <div className={styles['org-info-modal__settings-copy']}>
                <span className={styles['org-info-modal__settings-eyebrow']}>Участие</span>
                <strong>Покинуть организацию</strong>
                <p className={styles['org-info-modal__settings-text']}>
                  После выхода вы потеряете доступ к проектам, участникам и переписке этой организации.
                </p>
              </div>
              <Button variant="secondary" size="small" className={styles['org-info-modal__danger-button']} onClick={handleLeaveOrg}>
                Покинуть организацию
              </Button>
            </div>
          )}
        </div>
          </>
        )}

        {activeTab === 'settings' && canEditOrganization && (
          <div className={styles['org-info-modal__section']}>
            <div className={styles['org-info-modal__settings-card']}>
              <div className={styles['org-info-modal__settings-copy']}>
                <span className={styles['org-info-modal__settings-eyebrow']}>Редактор</span>
                <strong>Управление организацией</strong>
                <p className={styles['org-info-modal__settings-text']}>
                  Владельцы и модераторы могут редактировать организацию, роли и доступ участников.
                </p>
              </div>
              <Button
                variant="secondary"
                size="small"
                className={styles['org-info-modal__settings-button']}
                onClick={() => {
                  onClose();
                  window.setTimeout(() => {
                    const event = new CustomEvent('open-edit-organization');
                    window.dispatchEvent(event);
                  }, 0);
                }}
              >
                Открыть редактор
              </Button>
            </div>
            {inviteLink ? (
              <div className={`${styles['org-info-modal__link-container']} ${styles['org-info-modal__settings-card']}`}>
                <div className={styles['org-info-modal__settings-copy']}>
                  <span className={styles['org-info-modal__settings-eyebrow']}>Приглашение</span>
                  <strong>Ссылка для участников</strong>
                </div>
                <Input
                  value={inviteLink}
                  readOnly
                  fullWidth
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink).then(
                      () => showToast('Скопировано!', 'success'),
                      () => showToast('Не удалось скопировать', 'error')
                    );
                  }}
                  title="Нажмите, чтобы скопировать"
                />
                {expiresAt && <small className={styles['org-info-modal__settings-note']}>Ссылка действительна 1 час.</small>}
              </div>
            ) : (
              <div className={`${styles['org-info-modal__actions']} ${styles['org-info-modal__settings-card']}`}>
                <div className={styles['org-info-modal__settings-copy']}>
                  <span className={styles['org-info-modal__settings-eyebrow']}>Приглашение</span>
                  <strong>Открыть доступ по ссылке</strong>
                  <p className={styles['org-info-modal__settings-text']}>
                    Создайте временную ссылку, чтобы пригласить нового участника в организацию.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  className={styles['org-info-modal__settings-button']}
                  onClick={handleGenerateInvite}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Создание...' : 'Создать ссылку-приглашение'}
                </Button>
              </div>
            )}
            {error && <div className={styles['org-info-modal__settings-error']}>{error}</div>}

            {isOwner && (
              <div className={`${styles['org-info-modal__actions']} ${styles['org-info-modal__settings-card']} ${styles['org-info-modal__settings-card--danger']}`}>
              <div className={styles['org-info-modal__settings-copy']}>
                <span className={styles['org-info-modal__settings-eyebrow']}>Доступ</span>
                <strong>Удалить организацию</strong>
                <p className={styles['org-info-modal__settings-text']}>
                  Это действие удалит организацию со всеми проектами, задачами и сообщениями.
                </p>
              </div>
                <Button variant="secondary" size="small" className={styles['org-info-modal__danger-button']} onClick={handleDeleteOrg}>
                  Удалить организацию
                </Button>
              </div>
            )}
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
