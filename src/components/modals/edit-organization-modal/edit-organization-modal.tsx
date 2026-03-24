import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Modal from '@/components/ui/modal/modal';
import Input from '../../ui/input/input';
import Button from '../../ui/button/button';
import styles from './edit-organization-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { organizationService } from '../../../services/organizationService';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';
import { isDeletedUserProfile } from '../../../utils/user.utils';

interface Role {
  name: string;
  color: string;
}

interface EditOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  initialName: string;
  initialDescription: string;
  initialRoles: Role[];
  initialAutoRemove: boolean;
  initialAutoAddRoleMembersToChats: boolean;
}

const ORGANIZATION_NAME_MAX_LENGTH = 40;

const normalizeMemberRoles = (roles: unknown): string[] => {
  if (Array.isArray(roles)) return roles.filter(Boolean).map((role) => String(role));
  if (typeof roles === 'string' && roles.trim()) return [roles];
  return [];
};

const normalizeRoleKey = (role: string) => role.trim().toLocaleLowerCase('ru');

const areRoleSetsEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].map(normalizeRoleKey).sort();
  const rightSorted = [...right].map(normalizeRoleKey).sort();
  return leftSorted.every((role, index) => role === rightSorted[index]);
};

const areRolesEqual = (left: Role[], right: Role[]) => {
  if (left.length !== right.length) return false;

  const normalize = (roles: Role[]) =>
    roles
      .map((role) => ({
        name: role.name.trim(),
        color: role.color,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const leftNormalized = normalize(left);
  const rightNormalized = normalize(right);

  return leftNormalized.every((role, index) => {
    const other = rightNormalized[index];
    return role.name === other.name && role.color === other.color;
  });
};

const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  initialName,
  initialDescription,
  initialRoles,
  initialAutoRemove,
  initialAutoAddRoleMembersToChats,
}) => {
  const { currentOrganization, updateOrganization: contextUpdateOrg, refreshCurrentOrganization } = useOrganization();
  const { showToast } = useUI();
  const { user } = useAuth();
  const sourceOrganization = currentOrganization?.id === organizationId ? currentOrganization : null;
  const organizationMembers = currentOrganization?.organization_members ?? [];
  const sourceName = sourceOrganization?.name ?? initialName;
  const sourceDescription = sourceOrganization?.description ?? initialDescription;
  const sourceRoles = sourceOrganization?.roles ?? initialRoles;
  const sourceAutoRemove = sourceOrganization?.autoRemoveMembers ?? initialAutoRemove;
  const sourceAutoAddRoleMembersToChats =
    sourceOrganization?.autoAddRoleMembersToChats ?? initialAutoAddRoleMembersToChats;

  const [name, setName] = useState(sourceName);
  const [description, setDescription] = useState(sourceDescription);
  const [roles, setRoles] = useState<Role[]>(sourceRoles);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRemoveMembers, setAutoRemoveMembers] = useState(sourceAutoRemove);
  const [autoAddRoleMembersToChats, setAutoAddRoleMembersToChats] = useState(sourceAutoAddRoleMembersToChats);
  const [activeTab, setActiveTab] = useState<'info' | 'members'>('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [memberRolesState, setMemberRolesState] = useState<Record<string, string[]>>({});
  const [rolePickerMemberId, setRolePickerMemberId] = useState<string | null>(null);
  const [rolePickerMemberSnapshot, setRolePickerMemberSnapshot] = useState<(typeof organizationMembers)[number] | null>(null);
  const [roleUpdatingMemberId, setRoleUpdatingMemberId] = useState<string | null>(null);
  const [statusUpdatingMemberId, setStatusUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const pendingMemberRolesRef = useRef<Record<string, string[]>>({});
  const assignableRoles = useMemo(
    () => roles.filter((role) => role.name.trim()),
    [roles]
  );

  const setFocus = useCallback(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;

    wasOpenRef.current = true;
    setName(sourceName);
    setDescription(sourceDescription);
    setRoles(sourceRoles);
    setAutoRemoveMembers(sourceAutoRemove);
    setAutoAddRoleMembersToChats(sourceAutoAddRoleMembersToChats);
    setError(null);
    setIsUpdating(false);
    setActiveTab('info');
    setSearchTerm('');
    setRolePickerMemberId(null);
    setRolePickerMemberSnapshot(null);
    pendingMemberRolesRef.current = {};
    setTimeout(setFocus, 0);
  }, [isOpen, sourceName, sourceDescription, sourceRoles, sourceAutoRemove, sourceAutoAddRoleMembersToChats, setFocus]);

  useEffect(() => {
    if (!isOpen || organizationMembers.length === 0) return;
    setMemberRolesState((prev) => {
      const nextState: Record<string, string[]> = { ...prev };
      organizationMembers.forEach((member) => {
        const backendRoles = normalizeMemberRoles(member.roles);
        const pendingRoles = pendingMemberRolesRef.current[member.id];

        if (pendingRoles) {
          if (areRoleSetsEqual(backendRoles, pendingRoles)) {
            delete pendingMemberRolesRef.current[member.id];
            nextState[member.id] = backendRoles;
          } else if (!(member.id in nextState)) {
            nextState[member.id] = pendingRoles;
          }
        } else {
          nextState[member.id] = backendRoles;
        }
      });
      return nextState;
    });
  }, [isOpen, organizationMembers]);

  const filteredMembers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return organizationMembers.filter((member) => {
      const displayName = (member.user?.full_name || '').toLowerCase();
      const username = (member.user?.username || '').toLowerCase();
      const email = (member.user?.email || '').toLowerCase();
      const systemRole = member.status === 'owner' ? 'владелец' : member.status === 'admin' ? 'модератор' : 'участник';
      const customRoles = (memberRolesState[member.id] ?? normalizeMemberRoles(member.roles)).map((role) => role.toLowerCase());
      return (
        !term ||
        displayName.includes(term) ||
        username.includes(term) ||
        email.includes(term) ||
        systemRole.includes(term) ||
        customRoles.some((role) => role.includes(term))
      );
    });
  }, [organizationMembers, memberRolesState, searchTerm]);

  const rolePickerMember = useMemo(() => {
    if (!rolePickerMemberId) return null;
    return organizationMembers.find((member) => member.id === rolePickerMemberId) || rolePickerMemberSnapshot;
  }, [organizationMembers, rolePickerMemberId, rolePickerMemberSnapshot]);

  useEffect(() => {
    if (!rolePickerMemberId) {
      setRolePickerMemberSnapshot(null);
      return;
    }

    const nextMember = organizationMembers.find((member) => member.id === rolePickerMemberId);
    if (nextMember) {
      setRolePickerMemberSnapshot(nextMember);
    }
  }, [organizationMembers, rolePickerMemberId]);

  const openRolePicker = (memberId: string) => {
    const member = organizationMembers.find((item) => item.id === memberId) || null;
    if (!member || isDeletedUserProfile(member.user)) return;
    setRolePickerMemberId(memberId);
    setRolePickerMemberSnapshot(member);
  };

  const closeRolePicker = () => {
    setRolePickerMemberId(null);
    setRolePickerMemberSnapshot(null);
  };

  const addRole = () => {
    setRoles((prev) => [...prev, { name: '', color: '#6366f1' }]);
  };

  const removeRole = (index: number) => {
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRole = (index: number, field: keyof Role, value: string) => {
    setRoles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const filteredRoles = roles.filter((role) => role.name.trim());

    if (!trimmedName) {
      setError('Введите название организации');
      return;
    }
    if (trimmedName.length > ORGANIZATION_NAME_MAX_LENGTH) {
      setError(`Название организации не должно превышать ${ORGANIZATION_NAME_MAX_LENGTH} символов`);
      return;
    }

    const roleNames = filteredRoles.map((role) => role.name.trim()).filter(Boolean);
    if (new Set(roleNames).size !== roleNames.length) {
      setError('Названия ролей должны быть уникальными');
      return;
    }

    const hasChanges =
      trimmedName !== sourceName.trim() ||
      trimmedDescription !== sourceDescription.trim() ||
      autoRemoveMembers !== sourceAutoRemove ||
      autoAddRoleMembersToChats !== sourceAutoAddRoleMembersToChats ||
      !areRolesEqual(filteredRoles, sourceRoles);

    if (!hasChanges) {
      onClose();
      return;
    }

    setIsUpdating(true);
    setError(null);
    try {
      await contextUpdateOrg(organizationId, {
        name: trimmedName,
        description: trimmedDescription,
        roles: filteredRoles,
        autoRemoveMembers,
        autoAddRoleMembersToChats,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить организацию');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleAdmin = async (memberId: string) => {
    const member = organizationMembers.find((item) => item.id === memberId);
    if (!member) return;
    if (isDeletedUserProfile(member.user)) {
      showToast('Удаленному пользователю нельзя назначить модерацию', 'error');
      return;
    }

    setStatusUpdatingMemberId(memberId);
    try {
      const nextStatus = member.status === 'admin' ? 'member' : 'admin';
      await organizationService.updateMemberStatus(organizationId, memberId, nextStatus);
      await refreshCurrentOrganization();
      showToast(nextStatus === 'admin' ? 'Участник стал модератором' : 'Статус участника обновлен', 'success');
    } catch {
      showToast('Не удалось изменить статус участника', 'error');
    } finally {
      setStatusUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    try {
      await organizationService.removeMember(organizationId, memberId);
      await refreshCurrentOrganization();
      showToast('Участник удалён', 'success');
      if (rolePickerMemberId === memberId) closeRolePicker();
    } catch {
      showToast('Не удалось удалить участника', 'error');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleToggleRoleForMember = async (memberId: string, roleName: string) => {
    const targetMember = organizationMembers.find((member) => member.id === memberId) || rolePickerMemberSnapshot;
    if (targetMember && isDeletedUserProfile(targetMember.user)) {
      showToast('Удаленному пользователю нельзя назначать роли', 'error');
      return;
    }

    const currentRoles =
      memberRolesState[memberId] ??
      normalizeMemberRoles(organizationMembers.find((member) => member.id === memberId)?.roles);
    const normalizedRoleName = normalizeRoleKey(roleName);
    const hasRole = currentRoles.some((role) => normalizeRoleKey(role) === normalizedRoleName);
    const nextRoles = hasRole
      ? currentRoles.filter((role) => normalizeRoleKey(role) !== normalizedRoleName)
      : [...currentRoles, roleName];

    pendingMemberRolesRef.current[memberId] = nextRoles;
    setMemberRolesState((prev) => ({ ...prev, [memberId]: nextRoles }));
    setRolePickerMemberSnapshot((prev) => {
      if (!prev || prev.id !== memberId) return prev;
      return { ...prev, roles: nextRoles };
    });
    setRoleUpdatingMemberId(memberId);

    try {
      await organizationService.updateMemberRoles(organizationId, memberId, nextRoles);
      await refreshCurrentOrganization();
      showToast(hasRole ? 'Роль снята' : 'Роль назначена', 'success');
    } catch {
      delete pendingMemberRolesRef.current[memberId];
      setMemberRolesState((prev) => ({ ...prev, [memberId]: currentRoles }));
      setRolePickerMemberSnapshot((prev) => {
        if (!prev || prev.id !== memberId) return prev;
        return { ...prev, roles: currentRoles };
      });
      showToast('Не удалось обновить роли', 'error');
    } finally {
      setRoleUpdatingMemberId(null);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Редактировать организацию"
        maxWidth={760}
        disableOutsideClick={isUpdating || !!rolePickerMember}
        disableEscape={isUpdating || !!rolePickerMember}
      >
        <div className={styles['edit-org-modal__content']}>

          <div className={styles['edit-org-modal__tabs']}>
            <button
              type="button"
              className={`${styles['edit-org-modal__tab']} ${activeTab === 'info' ? styles['edit-org-modal__tab--active'] : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Настройки
            </button>
            <button
              type="button"
              className={`${styles['edit-org-modal__tab']} ${activeTab === 'members' ? styles['edit-org-modal__tab--active'] : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Участники
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles['edit-org-modal__form']}>
            {activeTab === 'info' ? (
              <div className={styles['edit-org-modal__panel']}>
                <div className={styles['edit-org-modal__field']}>
                  <label htmlFor="org-name" className={styles['edit-org-modal__label']}>Название организации</label>
                  <Input
                    id="org-name"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, ORGANIZATION_NAME_MAX_LENGTH))}
                    maxLength={ORGANIZATION_NAME_MAX_LENGTH}
                    required
                    disabled={isUpdating}
                    ref={inputRef}
                  />
                </div>

                <div className={styles['edit-org-modal__field']}>
                  <label htmlFor="org-description" className={styles['edit-org-modal__label']}>Описание</label>
                  <Input
                    id="org-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 260))}
                    textarea
                    resize="none"
                    rows={4}
                    disabled={isUpdating}
                  />
                </div>

                <div className={styles['edit-org-modal__card']}>
                  <div className={styles['edit-org-modal__card-title']}>Кастомные роли</div>
                  <div className={styles['edit-org-modal__role-fields']}>
                    {roles.map((role, index) => (
                      <div key={`${role.name}-${index}`} className={styles['edit-org-modal__role-field']}>
                        <Input
                          className={styles['edit-org-modal__role-name']}
                          placeholder="Название роли"
                          value={role.name}
                          onChange={(e) => updateRole(index, 'name', e.target.value.slice(0, 30))}
                          disabled={isUpdating}
                        />
                        <div className={styles['edit-org-modal__color-picker']}>
                          <span className={styles['edit-org-modal__color-preview']} style={{ backgroundColor: role.color }} />
                          <input
                            type="color"
                            value={role.color}
                            onChange={(e) => updateRole(index, 'color', e.target.value)}
                            disabled={isUpdating}
                          />
                        </div>
                        <Button
                          variant="secondary"
                          size="small"
                          type="button"
                          onClick={() => removeRole(index)}
                          disabled={isUpdating}
                        >
                          Удалить
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      size="small"
                      type="button"
                      onClick={addRole}
                      disabled={isUpdating}
                      className={styles['edit-org-modal__add-role-btn']}
                    >
                      Добавить роль
                    </Button>
                  </div>
                </div>

                <div className={styles['edit-org-modal__settings-grid']}>
                  <div className={styles['edit-org-modal__card']}>
                    <div className={styles['edit-org-modal__toggle-row']}>
                      <div>
                        <strong>Автоматически удалять из проектов</strong>
                        <span>Если участник больше не подходит по ролям, он автоматически убирается из связанных проектов.</span>
                      </div>
                      <label className={styles['edit-org-modal__switch']}>
                        <input
                          type="checkbox"
                          checked={autoRemoveMembers}
                          onChange={(e) => setAutoRemoveMembers(e.target.checked)}
                          disabled={isUpdating}
                        />
                        <span />
                      </label>
                    </div>
                  </div>

                  <div className={styles['edit-org-modal__card']}>
                    <div className={styles['edit-org-modal__toggle-row']}>
                      <div>
                        <strong>Автодобавление в чаты по ролям</strong>
                        <span>Когда участник получает новую роль, он автоматически подключается к связанным чатам.</span>
                      </div>
                      <label className={styles['edit-org-modal__switch']}>
                        <input
                          type="checkbox"
                          checked={autoAddRoleMembersToChats}
                          onChange={(e) => setAutoAddRoleMembersToChats(e.target.checked)}
                          disabled={isUpdating}
                        />
                        <span />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles['edit-org-modal__panel']}>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск участников..."
                  size="small"
                  fullWidth
                />

                <div className={styles['edit-org-modal__members-list']}>
                  {filteredMembers.length === 0 ? (
                    <div className={styles['edit-org-modal__empty']}>
                      {searchTerm ? 'Ничего не найдено' : 'Участники не найдены'}
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const displayName =
                        member.user?.full_name ||
                        (member.user?.username ? `@${member.user.username}` : `Пользователь ${member.id.slice(-5)}`);
                      const isOwner = currentOrganization?.created_by === member.user_id;
                      const isCurrentUser = member.user_id === user?.id;
                      const customRoles = memberRolesState[member.id] ?? normalizeMemberRoles(member.roles);
                      const deletedUser = isDeletedUserProfile(member.user);
                      const canManageRoles = !deletedUser;

                      return (
                        <div
                          key={member.id}
                          className={`${styles['edit-org-modal__member']} ${!canManageRoles ? styles['edit-org-modal__member--disabled'] : ''}`}
                          onClick={() => {
                            if (!canManageRoles) return;
                            openRolePicker(member.id);
                          }}
                          onKeyDown={(e) => {
                            if (!canManageRoles) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openRolePicker(member.id);
                            }
                          }}
                          role={canManageRoles ? 'button' : undefined}
                          tabIndex={canManageRoles ? 0 : -1}
                          aria-disabled={!canManageRoles}
                        >
                          <div className={styles['edit-org-modal__avatar']} title={displayName}>
                            {member.user?.avatar_url ? (
                              <img src={member.user.avatar_url} alt={displayName} className={styles['edit-org-modal__avatar-image']} />
                            ) : (
                              displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className={styles['edit-org-modal__member-info']}>
                            <div className={styles['edit-org-modal__member-topline']}>
                              <span className={styles['edit-org-modal__member-name']}>{displayName}</span>
                            </div>
                            {!deletedUser ? (
                              <div className={styles['edit-org-modal__member-secondary']}>@{member.user?.username || 'unknown'}</div>
                            ) : null}
                            <div className={styles['edit-org-modal__member-roles']}>
                              <span
                                className={`${styles['edit-org-modal__status-badge']} ${
                                  isOwner
                                    ? styles['edit-org-modal__status-badge--owner']
                                    : member.status === 'admin'
                                    ? styles['edit-org-modal__status-badge--admin']
                                    : styles['edit-org-modal__status-badge--member']
                                }`}
                              >
                                {isOwner ? 'Владелец' : member.status === 'admin' ? 'Модератор' : 'Участник'}
                              </span>
                              {customRoles.length > 0 ? (
                                customRoles.map((roleName) => {
                                  const role = roles.find((item) => item.name === roleName);
                                  return (
                                    <span
                                      key={roleName}
                                      className={styles['edit-org-modal__role-badge']}
                                      style={{ backgroundColor: role?.color || 'var(--color-primary)' }}
                                    >
                                      {roleName}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className={styles['edit-org-modal__member-role-placeholder']}>
                                  {deletedUser ? 'Для удаленного пользователя роли недоступны' : 'Нажмите, чтобы назначить роли'}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isOwner && !isCurrentUser ? (
                            <div
                              className={styles['edit-org-modal__member-actions']}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <Button
                                variant="secondary"
                                size="small"
                                type="button"
                                loading={statusUpdatingMemberId === member.id}
                                disabled={deletedUser}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleToggleAdmin(member.id);
                                }}
                              >
                                {member.status === 'admin' ? 'Сделать участником' : 'Сделать модератором'}
                              </Button>
                              <Button
                                variant="danger"
                                size="small"
                                type="button"
                                loading={removingMemberId === member.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleRemoveMember(member.id);
                                }}
                              >
                                Удалить
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {error ? <div className={styles['edit-org-modal__error-message']}>{error}</div> : null}

            <div className={styles['edit-org-modal__actions']}>
              <Button variant="secondary" onClick={onClose} type="button" disabled={isUpdating}>
                Закрыть
              </Button>
              <Button type="submit" variant="primary" loading={isUpdating}>
                Сохранить
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {rolePickerMember ? (
        <Modal
          isOpen={!!rolePickerMember}
          onClose={closeRolePicker}
          title={`Роли: ${rolePickerMember.user?.full_name || rolePickerMember.user?.username || 'Участник'}`}
          maxWidth={560}
        >
          <div className={styles['edit-org-modal__role-picker']}>
            <p className={styles['edit-org-modal__role-picker-text']}>
              Нажмите на роль, чтобы назначить ее участнику. Повторное нажатие снимает роль.
            </p>
            <div className={styles['edit-org-modal__role-picker-grid']}>
              {assignableRoles.length === 0 ? (
                <div className={styles['edit-org-modal__empty']}>Сначала добавьте кастомные роли в настройках организации.</div>
              ) : (
                assignableRoles.map((role) => {
                  const activeRoles = memberRolesState[rolePickerMember.id] ?? normalizeMemberRoles(rolePickerMember.roles);
                  const isActive = activeRoles.includes(role.name);
                  return (
                    <button
                      key={role.name}
                      type="button"
                      className={`${styles['edit-org-modal__role-picker-chip']} ${isActive ? styles['edit-org-modal__role-picker-chip--active'] : ''}`}
                      style={{
                        borderColor: role.color,
                        backgroundColor: isActive ? `${role.color}22` : undefined,
                        color: isActive ? role.color : undefined,
                      }}
                      disabled={roleUpdatingMemberId === rolePickerMember.id}
                      onClick={() => handleToggleRoleForMember(rolePickerMember.id, role.name)}
                    >
                      <span className={styles['edit-org-modal__role-picker-dot']} style={{ backgroundColor: role.color }} />
                      {role.name}
                    </button>
                  );
                })
              )}
            </div>
            <div className={styles['edit-org-modal__role-picker-footer']}>
              <Button variant="secondary" type="button" onClick={closeRolePicker}>
                Закрыть
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
};

export default EditOrganizationModal;
