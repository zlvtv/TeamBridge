import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Input from '../../ui/input/input';
import Button from '../../ui/button/button';
import styles from './edit-organization-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { organizationService } from '../../../services/organizationService';
import { useUI } from '../../../contexts/UIContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';

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
}

const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  initialName,
  initialDescription,
  initialRoles,
  initialAutoRemove,
}) => {
  const { currentOrganization, updateOrganization: contextUpdateOrg, refreshCurrentOrganization } = useOrganization();
  const { showToast } = useUI();
  const { user } = useAuth();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRemoveMembers, setAutoRemoveMembers] = useState(initialAutoRemove);
  const [activeTab, setActiveTab] = useState<'info' | 'members'>('info');
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showRoleEditPanel, setShowRoleEditPanel] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>({});

  const setFocus = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
const handleToggleAdmin = async (memberId: string) => {
  try {
    const member = currentOrganization.organization_members.find(m => m.id === memberId);
    if (!member) return;

    const newStatus = member.status === 'admin' ? 'member' : 'admin';
    
    const memberDocRef = doc(db, 'organization_members', memberId);
    await updateDoc(memberDocRef, { status: newStatus });

    await refreshCurrentOrganization();
    showToast(
      newStatus === 'admin'
        ? 'Пользователь стал модератором'
        : 'Пользователь теперь участник',
      'success'
    );
  } catch (err) {
    showToast('Не удалось изменить статус', 'error');
  } finally {
    setActiveDropdown(null);
  }
};
   useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      setRoles(initialRoles);
      setAutoRemoveMembers(initialAutoRemove);
      setError(null);
      setIsUpdating(false);
      setTimeout(setFocus, 0);
    }
  }, [isOpen, initialName, initialDescription, initialRoles, initialAutoRemove]);

  useEffect(() => {
    if (isOpen && currentOrganization?.organization_members) {
      const initialSelectedRoles: Record<string, string[]> = {};
      currentOrganization.organization_members.forEach(member => {
        const memberRoles = Array.isArray(member.roles)
          ? member.roles
          : (typeof member.roles === 'string' ? [member.roles] : []);
        initialSelectedRoles[member.id] = memberRoles;
      });
      setSelectedRoles(initialSelectedRoles);
    }
  }, [isOpen, currentOrganization?.organization_members]);

  const addRole = () => {
    setRoles([...roles, { name: '', color: '#6366f1' }]);
  };

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index));
  };

  const updateRole = (index: number, field: keyof Role, value: string) => {
    const newRoles = [...roles];
    newRoles[index][field] = value;
    setRoles(newRoles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название организации');
      return;
    }

    const roleNames = roles.map(r => r.name.trim()).filter(n => n);
    if (new Set(roleNames).size !== roleNames.length) {
      setError('Названия ролей должны быть уникальными');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      await contextUpdateOrg(organizationId, {
        name: name.trim(),
        description: description.trim(),
        roles: roles.filter(r => r.name.trim()),
        autoRemoveMembers: autoRemoveMembers
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить организацию');
      setIsUpdating(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!currentOrganization?.organization_members) return [];

    const term = searchTerm.toLowerCase().trim();
    if (!term) return currentOrganization.organization_members;

    return currentOrganization.organization_members.filter(member => {
      const displayName = (member.user?.full_name || "").toLowerCase();
      const username = (member.user?.username || "").toLowerCase();
      const email = (member.user?.email || "").toLowerCase();
      const systemRole = (member.status === 'owner' ? 'Создатель' :
                         member.status === 'admin' ? 'Модератор' :
                         'участник') || '';

      const customRoles = Array.isArray(member.roles)
        ? member.roles.map(r => r.toLowerCase())
        : (typeof member.roles === 'string' ? [member.roles.toLowerCase()] : []);

      return (
        displayName.includes(term) ||
        username.includes(term) ||
        email.includes(term) ||
        systemRole.includes(term) ||
        customRoles.some(role => role.includes(term))
      );
    });
  }, [currentOrganization?.organization_members, searchTerm]);

  const handleDotsClick = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === memberId ? null : memberId);
    setShowRoleEditPanel(null);
  };

  const handleMakeModerator = async (memberId: string) => {
    try {
      await organizationService.makeModerator(organizationId, memberId);
      await refreshCurrentOrganization();
      showToast('Участник стал модератором', 'success');
    } catch (err) {
      showToast('Не удалось сделать модератором', 'error');
    } finally {
      setActiveDropdown(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await organizationService.removeMember(organizationId, memberId);
      await refreshCurrentOrganization();
      showToast('Участник удалён', 'success');
    } catch (err) {
      showToast('Не удалось удалить участника', 'error');
    } finally {
      setActiveDropdown(null);
    }
  };

  const handleEditRolesClick = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRoleEditPanel(showRoleEditPanel === memberId ? null : memberId);
    setActiveDropdown(null);
  };

  const handleRoleToggle = (memberId: string, roleName: string) => {
    setSelectedRoles(prev => {
      const memberRoles = prev[memberId] || [];
      if (memberRoles.includes(roleName)) {
        return {
          ...prev,
          [memberId]: memberRoles.filter(r => r !== roleName)
        };
      } else {
        return {
          ...prev,
          [memberId]: [...memberRoles, roleName]
        };
      }
    });
  };

  const handleSaveRoles = async (memberId: string) => {
    try {
      await organizationService.updateMemberRoles(organizationId, memberId, selectedRoles[memberId] || []);
      await refreshCurrentOrganization();
      setShowRoleEditPanel(null);
      showToast('Роли обновлены', 'success');
    } catch (err) {
      showToast('Не удалось обновить роли', 'error');
    }
  };

  useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (activeDropdown && !e.target.closest(`[data-dropdown-id="${activeDropdown}"]`)) {
      setActiveDropdown(null);
    }
    if (showRoleEditPanel && !e.target.closest(`[data-role-panel-id="${showRoleEditPanel}"]`)) {
      setShowRoleEditPanel(null);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [activeDropdown, showRoleEditPanel]);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      disableOutsideClick={isUpdating}
      disableEscape={isUpdating}
    >
      <div className={styles['edit-org-modal__header']}>
        <h2 className={styles['edit-org-modal__title']}>
          {isUpdating ? "Обновление организации..." : "Редактирование организации"}
        </h2>
        <div className={styles['edit-org-modal__tabs']}>
          <button
            className={`${styles['edit-org-modal__tab']} ${activeTab === 'info' ? styles['edit-org-modal__tab--active'] : ''}`}
            onClick={() => setActiveTab('info')}
            type="button"
          >
            Основная информация
          </button>
          <button
            className={`${styles['edit-org-modal__tab']} ${activeTab === 'members' ? styles['edit-org-modal__tab--active'] : ''}`}
            onClick={() => setActiveTab('members')}
            type="button"
          >
            Участники
          </button>
        </div>
      </div>

      {activeTab === 'info' && (
        <form onSubmit={handleSubmit} className={styles['edit-org-modal__form']}>
          <div className={styles['edit-org-modal__field']}>
            <label htmlFor="org-name" className={styles['edit-org-modal__label']}>Название организации</label>
            <Input
              id="org-name"
              placeholder="Введите название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              error={error}
              disabled={isUpdating}
              ref={inputRef}
            />
            {error && <div className={styles['edit-org-modal__error-message']}>{error}</div>}
          </div>

          <div className={styles['edit-org-modal__field']}>
            <label htmlFor="org-description" className={styles['edit-org-modal__label']}>Описание (опционально)</label>
            <Input
              id="org-description"
              placeholder="Расскажите, чем занимается организация"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              textarea
              disabled={isUpdating}
            />
          </div>

          <div className={styles['edit-org-modal__role-fields']}>
            <label className={styles['edit-org-modal__label']}>Роли организации</label>
            {roles.map((role, index) => (
              <div key={index} className={styles['edit-org-modal__role-field']}>
                <Input
                  className={styles['edit-org-modal__role-name']}
                  placeholder="Название роли"
                  value={role.name}
                  onChange={(e) => updateRole(index, 'name', e.target.value)}
                  disabled={isUpdating}
                />
                <div className={styles['edit-org-modal__color-picker']}>
                  <span className={styles['edit-org-modal__color-preview']} style={{ backgroundColor: role.color }} />
                  <input
                    type="color"
                    value={role.color}
                    onChange={(e) => updateRole(index, 'color', e.target.value)}
                    disabled={isUpdating}
                    className={styles['edit-org-modal__color-input']}
                  />
                </div>
                {roles.length > 1 && (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => removeRole(index)}
                    disabled={isUpdating}
                    type="button"
                  >
                    Удалить
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              size="small"
              onClick={addRole}
              disabled={isUpdating}
              type="button"
              className={styles['edit-org-modal__add-role-btn']}
            >
              + Добавить роль
            </Button>
          </div>

          <div className={styles['edit-org-modal__field']}>
            <label className={styles['edit-org-modal__label']}>
              <input
                type="checkbox"
                checked={autoRemoveMembers}
                onChange={(e) => setAutoRemoveMembers(e.target.checked)}
                disabled={isUpdating}
              />
              <span className={styles['edit-org-modal__checkbox-label']}>
                Автоматическое удаление участников из проектов при изменении ролей
              </span>
            </label>
            <small className={styles['edit-org-modal__hint']}>
              Когда включено, участники будут автоматически удаляться из проектов, если они перестают иметь общие роли с проектом.
            </small>
          </div>

          <div className={styles['edit-org-modal__actions']}>
            <Button variant="secondary" onClick={onClose} type="button" disabled={isUpdating}>
              Закрыть
            </Button>
            <Button type="submit" variant="primary" disabled={isUpdating}>
              {isUpdating ? 'Обновление...' : 'Сохранить'}
            </Button>
          </div>

          {isUpdating && (
            <div className={styles['edit-org-modal__feedback']}>
              <small>Обновляем организацию…</small>
            </div>
          )}
        </form>
      )}

      {activeTab === 'members' && (
  <div className={styles['edit-org-modal__members-tab']}>
    <div className={styles['edit-org-modal__search-container']}>
      <Input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Поиск участников..."
        size="small"
        fullWidth
      />
    </div>

    {filteredMembers.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-light)' }}>
        <small>{searchTerm ? 'Ничего не найдено' : 'Нет участников'}</small>
      </div>
    ) : (
      <div className={styles['edit-org-modal__members-list']}>
        {filteredMembers.map((member) => {
          const displayName =
            member.user?.full_name ||
            (member.user?.username ? `@${member.user.username}` : `Пользователь ${member.id.slice(-5)}`);

          const isCurrentUser = member.user_id === user?.id;
          const isOwner = currentOrganization.created_by === member.user_id;
          const isAdmin = !isOwner && member.status === 'admin';

          return (
            <div key={member.id} className={styles['edit-org-modal__member-item']}>
              <div className={styles['edit-org-modal__member-info']}>
                <div className={styles['edit-org-modal__avatar']} title={displayName}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className={styles['edit-org-modal__member-details']}>
                  <span className={styles['edit-org-modal__member-name']}>{displayName}</span>
                  <div className={styles['edit-org-modal__member-roles']}>
                    <span
                      className={`${styles['edit-org-modal__status-badge']} ${
                        isOwner
                          ? styles['edit-org-modal__status-badge--owner']
                          : isAdmin
                          ? styles['edit-org-modal__status-badge--admin']
                          : styles['edit-org-modal__status-badge--member']
                      }`}
                    >
                      {isOwner ? 'Владелец' : isAdmin ? 'Модератор' : 'Участник'}
                    </span>
                    {Array.isArray(member.roles) &&
                      member.roles
                        .filter(Boolean)
                        .map((roleName) => {
                          const role = roles.find((r) => r.name === roleName);
                          return (
                            <span
                              key={roleName}
                              className={styles['edit-org-modal__role-badge']}
                              style={{ backgroundColor: role?.color || 'var(--color-primary)' }}
                            >
                              {roleName}
                            </span>
                          );
                        })}
                  </div>
                </div>
              </div>
              
              {!isOwner && !isCurrentUser && (
                <div className={styles['edit-org-modal__member-actions']}>
                  <button
                    className={styles['edit-org-modal__dots-btn']}
                    onClick={(e) => handleDotsClick(member.id, e)}
                    aria-label="Действия с участником"
                    type="button"
                  >
                    ⋮
                  </button>

                  {activeDropdown === member.id && (
                    <div
                      className={styles['edit-org-modal__dropdown-menu']}
                      data-dropdown-id={member.id}
                    >
                      <button
                        className={styles['edit-org-modal__dropdown-item']}
                        onClick={() => handleToggleAdmin(member.id)}
                        type="button"
                      >
                        {isAdmin ? 'Сделать участником' : 'Сделать модератором'}
                      </button>

                      <button
                        className={styles['edit-org-modal__dropdown-item']}
                        onClick={() => setShowRoleEditPanel(showRoleEditPanel === member.id ? null : member.id)}
                        type="button"
                      >
                        Добавить роль
                      </button>

                      <button
                        className={`${styles['edit-org-modal__dropdown-item']} button--danger`}
                        onClick={() => handleRemoveMember(member.id)}
                        type="button"
                      >
                        Удалить участника
                      </button>
                    </div>
                  )}

                  {showRoleEditPanel === member.id && (
                    <div
                      className={styles['edit-org-modal__role-edit-panel']}
                      data-role-panel-id={member.id}
                    >
                      <div className={styles['edit-org-modal__role-edit-header']}>
                        <h4>Выберите роли</h4>
                      </div>
                      <div className={styles['edit-org-modal__role-edit-content']}>
                        {roles.map((role) => (
                          <Button
                            key={role.name}
                            variant="secondary"
                            size="small"
                            onClick={() => handleRoleToggle(member.id, role.name)}
                            className={`${styles['edit-org-modal__role-badge']} ${
                              selectedRoles[member.id]?.includes(role.name)
                                ? styles['edit-org-modal__role--highlighted']
                                : ''
                            }`}
                            style={{ backgroundColor: role.color }}
                          >
                            {role.name}
                          </Button>
                        ))}
                      </div>
                      <div className={styles['edit-org-modal__role-actions']}>
                        <Button variant="secondary" size="small" onClick={() => setShowRoleEditPanel(null)}>
                          Отмена
                        </Button>
                        <Button variant="primary" size="small" onClick={() => handleSaveRoles(member.id)}>
                          Сохранить
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
    </Modal>
  );
};

export default EditOrganizationModal;
