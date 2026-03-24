import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/modal/modal';
import Button from '../../ui/button/button';
import Input from '../../ui/input/input';
import styles from './create-project-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useProject } from '../../../contexts/ProjectContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';
import { projectService } from '../../../services/projectService';
import { messageService } from '../../../services/messageService';
import { formatCount } from '../../../utils/formatCount';
import { isDeletedUserProfile } from '../../../utils/user.utils';
import { canCreateOrganizationProjects } from '../../../utils/permissions';

interface CreateProjectModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  refreshProjects?: () => Promise<any>;
}

interface DraftRole {
  id: string;
  name: string;
  color: string;
}

const PROJECT_NAME_MAX_LENGTH = 48;

const normalizeRoleKey = (role: string) => role.trim().toLocaleLowerCase('ru');
const createDraftRole = (): DraftRole => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  color: '#6366f1',
});

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, refreshProjects }) => {
  const { currentOrganization } = useOrganization();
  const projectContext = useProject();
  const { isModalOpen, closeModal } = useUI();
  const { user } = useAuth();

  const isCreateProjectOpen = typeof isOpen === 'boolean' ? isOpen : isModalOpen('createProject');
  const closeCreateProject = onClose || (() => closeModal('createProject'));

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includeCreator, setIncludeCreator] = useState(true);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [leadUserId, setLeadUserId] = useState('');
  const [projectRoles, setProjectRoles] = useState<DraftRole[]>([]);
  const [memberRoleMap, setMemberRoleMap] = useState<Record<string, string[]>>({});
  const [selectedOrgRoleKeys, setSelectedOrgRoleKeys] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCreateProjectOpen) return;
    setName('');
    setDescription('');
    setIncludeCreator(true);
    setSelectedMemberIds([]);
    setLeadUserId('');
    setProjectRoles([]);
    setMemberRoleMap({});
    setSelectedOrgRoleKeys([]);
    setMemberSearch('');
    setError(null);
  }, [isCreateProjectOpen]);

  const organizationMembers = currentOrganization?.organization_members || [];
  const activeOrganizationMembers = useMemo(
    () => organizationMembers.filter((member) => !isDeletedUserProfile(member.user)),
    [organizationMembers]
  );
  const canCreateProject = canCreateOrganizationProjects(currentOrganization, user?.id);
  const normalizedSearch = memberSearch.trim().toLocaleLowerCase('ru');

  const visibleMembers = useMemo(() => {
    return activeOrganizationMembers.filter((member) => {
      const fullName = (member.user?.full_name || '').toLocaleLowerCase('ru');
      const username = (member.user?.username || '').toLocaleLowerCase('ru');
      const email = (member.user?.email || '').toLocaleLowerCase('ru');
      return !normalizedSearch || fullName.includes(normalizedSearch) || username.includes(normalizedSearch) || email.includes(normalizedSearch);
    });
  }, [activeOrganizationMembers, normalizedSearch]);

  const assignableOrgRoles = useMemo(
    () => (currentOrganization?.roles || []).filter((role) => role.name.trim()),
    [currentOrganization?.roles]
  );

  const visibleProjectRoles = useMemo(
    () => projectRoles.filter((role) => role.name.trim()),
    [projectRoles]
  );

  const roleBasedUserIds = useMemo(
    () =>
      currentOrganization?.autoAddRoleMembersToChats && selectedOrgRoleKeys.length > 0
        ? organizationMembers
            .filter((member) => !isDeletedUserProfile(member.user))
            .filter((member) =>
              (member.roles || []).some((role) => selectedOrgRoleKeys.includes(normalizeRoleKey(role)))
            )
            .map((member) => member.user_id)
        : [],
    [currentOrganization?.autoAddRoleMembersToChats, organizationMembers, selectedOrgRoleKeys]
  );

  const memberLookup = useMemo(
    () =>
      new Map(
        organizationMembers.map((member) => [
          member.user_id,
          {
            displayName: member.user?.full_name || member.user?.username || member.user?.email || 'Участник',
            username: member.user?.username || 'unknown',
          },
        ])
      ),
    [organizationMembers]
  );

  const includedMemberIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            includeCreator ? user?.id : null,
            leadUserId || null,
            ...selectedMemberIds,
            ...roleBasedUserIds,
          ].filter(Boolean) as string[]
        )
      ),
    [includeCreator, leadUserId, roleBasedUserIds, selectedMemberIds, user?.id]
  );

  const includedMembers = useMemo(
    () =>
      includedMemberIds
        .map((memberId) => {
          const sourceMember = activeOrganizationMembers.find((member) => member.user_id === memberId);
          if (!sourceMember) return null;
          return sourceMember;
        })
        .filter(Boolean),
    [activeOrganizationMembers, includedMemberIds]
  );

  const toggleMemberSelection = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleOrgRoleSelection = (roleName: string) => {
    const key = normalizeRoleKey(roleName);
    setSelectedOrgRoleKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleIncludeCreatorChange = (checked: boolean) => {
    setIncludeCreator(checked);
    if (!checked && leadUserId === user?.id) {
      setLeadUserId('');
    }
  };

  useEffect(() => {
    if (!projectRoles.length) {
      setMemberRoleMap({});
      return;
    }

    const validRoleIds = new Set(projectRoles.filter((role) => role.name.trim()).map((role) => role.id));
    setMemberRoleMap((prev) => {
      const nextEntries = Object.entries(prev)
        .map(([memberId, roleIds]) => [memberId, roleIds.filter((roleId) => validRoleIds.has(roleId))] as const)
        .filter(([, roleIds]) => roleIds.length > 0);
      return Object.fromEntries(nextEntries);
    });
  }, [projectRoles]);

  const addProjectRole = () => {
    setProjectRoles((prev) => [...prev, createDraftRole()]);
  };

  const updateProjectRole = (index: number, field: keyof DraftRole, value: string) => {
    setProjectRoles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeProjectRole = (index: number) => {
    setProjectRoles((prev) => {
      const roleToRemove = prev[index];
      if (!roleToRemove) return prev;
      setMemberRoleMap((current) => {
        const nextEntries = Object.entries(current)
          .map(([memberId, roleIds]) => [memberId, roleIds.filter((roleId) => roleId !== roleToRemove.id)] as const)
          .filter(([, roleIds]) => roleIds.length > 0);
        return Object.fromEntries(nextEntries);
      });
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const toggleMemberProjectRole = (memberId: string, roleId: string) => {
    setMemberRoleMap((prev) => {
      const current = prev[memberId] || [];
      const nextRoles = current.includes(roleId)
        ? current.filter((item) => item !== roleId)
        : [...current, roleId];

      if (nextRoles.length === 0) {
        const next = { ...prev };
        delete next[memberId];
        return next;
      }

      return {
        ...prev,
        [memberId]: nextRoles,
      };
    });
  };

  const handleSubmit = async () => {
    if (!currentOrganization || !user) {
      setError('Сначала выберите организацию');
      return;
    }

    if (!canCreateProject) {
      setError('Создавать проекты может только владелец организации');
      return;
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const normalizedLeadId = leadUserId.trim();
    const filteredProjectRoles = visibleProjectRoles.map((role) => ({
      name: role.name.trim(),
      color: role.color,
    }));
    const roleNameById = new Map(
      visibleProjectRoles.map((role) => [role.id, role.name.trim()] as const)
    );

    if (!trimmedName) {
      setError('Введите название проекта');
      return;
    }

    if (!normalizedLeadId) {
      setError('Выберите куратора проекта');
      return;
    }

    const projectRoleNames = filteredProjectRoles.map((role) => normalizeRoleKey(role.name));
    if (new Set(projectRoleNames).size !== projectRoleNames.length) {
      setError('Локальные роли проекта должны быть уникальными');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const uniqueMemberIds = Array.from(
        new Set([
          includeCreator ? user.id : null,
          normalizedLeadId,
          ...selectedMemberIds,
          ...roleBasedUserIds,
        ].filter(Boolean))
      );

      const projectId = await projectService.createProject({
        name: trimmedName,
        description: trimmedDescription || null,
        organization_id: currentOrganization.id,
        created_by: user.id,
        lead_user_id: normalizedLeadId || null,
        roles: filteredProjectRoles,
        auto_add_org_roles: selectedOrgRoleKeys,
      });

      for (const memberId of uniqueMemberIds) {
        const status =
          memberId === user.id
            ? 'owner'
            : memberId === normalizedLeadId
            ? 'admin'
            : 'member';
        await projectService.addMember(projectId, memberId, status, {
          roles: (memberRoleMap[memberId] || []).map((roleId) => roleNameById.get(roleId)).filter(Boolean) as string[],
          displayName: memberLookup.get(memberId)?.displayName || null,
        });
      }

      await messageService.sendSystemMessage(projectId, `Создан проект: ${trimmedName}`);

      localStorage.setItem('currentProjectId', projectId);

      let refreshedProjects;
      if (refreshProjects) {
        refreshedProjects = await refreshProjects();
      } else {
        refreshedProjects = await projectContext.refreshProjects();
      }

      const nextProject =
        Array.isArray(refreshedProjects)
          ? refreshedProjects.find((project) => project.id === projectId) || null
          : null;

      if (nextProject) {
        projectContext.setCurrentProject(nextProject);
      }

      closeCreateProject();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать проект');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isCreateProjectOpen} onClose={closeCreateProject} title="Создать проект" maxWidth={780}>
      {currentOrganization && user ? (
        canCreateProject ? (
        <div className={styles['create-project-modal__form']}>
          <div className={styles['create-project-modal__section']}>
            <div className={styles['create-project-modal__field']}>
              <label className={styles['create-project-modal__label']}>Название проекта</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, PROJECT_NAME_MAX_LENGTH))}
                placeholder="Например: Product launch workspace"
                maxLength={PROJECT_NAME_MAX_LENGTH}
              />
            </div>

            <div className={styles['create-project-modal__field']}>
              <label className={styles['create-project-modal__label']}>Описание</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 280))}
                placeholder="Коротко опишите цель и контекст проекта"
                textarea
                resize="none"
                rows={4}
              />
            </div>
          </div>

          <div className={styles['create-project-modal__section']}>
            <div className={styles['create-project-modal__section-header']}>
              <div>
                <h4 className={styles['create-project-modal__section-title']}>Куратор проекта</h4>
                <p className={styles['create-project-modal__section-copy']}>
                  Это человек, который ведет проект и получает уровень модератора проекта.
                </p>
              </div>
            </div>
            <div className={styles['create-project-modal__lead-grid']}>
              {activeOrganizationMembers.map((member) => {
                const displayName = member.user?.full_name || member.user?.username || member.user?.email || 'Участник';
                const isActive = leadUserId === member.user_id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    className={`${styles['create-project-modal__lead-card']} ${isActive ? styles['create-project-modal__lead-card--active'] : ''}`}
                    onClick={() => setLeadUserId(member.user_id)}
                  >
                    <span className={styles['create-project-modal__lead-name']}>{displayName}</span>
                    <span className={styles['create-project-modal__lead-meta']}>@{member.user?.username || 'unknown'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles['create-project-modal__section']}>
            <div className={styles['create-project-modal__section-header']}>
              <div>
                <h4 className={styles['create-project-modal__section-title']}>Участники проекта</h4>
                <p className={styles['create-project-modal__section-copy']}>
                  Выберите конкретных участников из организации. Куратор и участники по выбранным ролям будут добавлены автоматически.
                </p>
              </div>
              <div className={styles['create-project-modal__counter']}>
                {formatCount(includedMemberIds.length, 'участник', 'участника', 'участников')}
              </div>
            </div>
            <div className={styles['create-project-modal__toggle-row']}>
              <div>
                <strong>Добавить меня в проект</strong>
                <span>Можно создать проект только для других участников, если ты владелец организации.</span>
              </div>
              <label className={styles['create-project-modal__switch']}>
                <input
                  type="checkbox"
                  checked={includeCreator}
                  onChange={(e) => handleIncludeCreatorChange(e.target.checked)}
                />
                <span />
              </label>
            </div>
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Поиск по участникам организации"
              size="small"
            />
            <div className={styles['create-project-modal__members-list']}>
              {visibleMembers.map((member) => {
                const displayName = member.user?.full_name || member.user?.username || member.user?.email || 'Участник';
                const isSelected =
                  (includeCreator && member.user_id === user.id) ||
                  member.user_id === leadUserId ||
                  selectedMemberIds.includes(member.user_id);
                const locked = (includeCreator && member.user_id === user.id) || member.user_id === leadUserId;
                return (
                  <button
                    key={member.id}
                    type="button"
                    className={`${styles['create-project-modal__member-card']} ${isSelected ? styles['create-project-modal__member-card--active'] : ''}`}
                    onClick={() => {
                      if (!locked) toggleMemberSelection(member.user_id);
                    }}
                    >
                      <div className={styles['create-project-modal__member-main']}>
                        <strong>{displayName}</strong>
                        <span>@{member.user?.username || 'unknown'}</span>
                      </div>
                    <span className={styles['create-project-modal__member-state']}>
                      {includeCreator && member.user_id === user.id ? 'Создатель' : member.user_id === leadUserId ? 'Куратор' : isSelected ? 'В проекте' : 'Добавить'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {currentOrganization.autoAddRoleMembersToChats && assignableOrgRoles.length > 0 ? (
            <div className={styles['create-project-modal__section']}>
              <div className={styles['create-project-modal__section-header']}>
                <div>
                  <h4 className={styles['create-project-modal__section-title']}>Автодобавление по ролям организации</h4>
                  <p className={styles['create-project-modal__section-copy']}>
                    Все участники организации с выбранными ролями будут автоматически добавлены в проект.
                  </p>
                </div>
              </div>
              <div className={styles['create-project-modal__role-chips']}>
                {assignableOrgRoles.map((role) => {
                  const isActive = selectedOrgRoleKeys.includes(normalizeRoleKey(role.name));
                  return (
                    <button
                      key={role.name}
                      type="button"
                      className={`${styles['create-project-modal__role-chip']} ${isActive ? styles['create-project-modal__role-chip--active'] : ''}`}
                      style={isActive ? { borderColor: role.color, color: role.color, backgroundColor: `${role.color}1f` } : undefined}
                      onClick={() => toggleOrgRoleSelection(role.name)}
                    >
                      <span className={styles['create-project-modal__role-dot']} style={{ backgroundColor: role.color }} />
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={styles['create-project-modal__section']}>
            <div className={styles['create-project-modal__section-header']}>
              <div>
                <h4 className={styles['create-project-modal__section-title']}>Локальные роли проекта</h4>
              </div>
            </div>
              <div className={styles['create-project-modal__role-fields']}>
              {projectRoles.map((role, index) => (
                <div key={role.id} className={styles['create-project-modal__role-field']}>
                  <Input
                    className={styles['create-project-modal__role-name']}
                    value={role.name}
                    onChange={(e) => updateProjectRole(index, 'name', e.target.value.slice(0, 30))}
                    placeholder="Например: QA lead"
                  />
                  <label className={styles['create-project-modal__color-picker']}>
                    <span className={styles['create-project-modal__color-preview']} style={{ backgroundColor: role.color }} />
                    <input
                      type="color"
                      value={role.color}
                      onChange={(e) => updateProjectRole(index, 'color', e.target.value)}
                    />
                  </label>
                  <Button type="button" variant="secondary" size="small" onClick={() => removeProjectRole(index)}>
                    Удалить
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="small"
                className={styles['create-project-modal__add-role-btn']}
                onClick={addProjectRole}
              >
                Добавить роль
              </Button>
            </div>
          </div>

          {visibleProjectRoles.length > 0 && includedMembers.length > 0 ? (
            <div className={styles['create-project-modal__section']}>
              <div className={styles['create-project-modal__section-header']}>
                <div>
                  <h4 className={styles['create-project-modal__section-title']}>Роли участников проекта</h4>
                  <p className={styles['create-project-modal__section-copy']}>
                    Выберите локальные роли для участников, которых добавляете в проект.
                  </p>
                </div>
              </div>

              <div className={styles['create-project-modal__member-role-list']}>
                {includedMembers.map((member) => {
                  const displayName = member.user?.full_name || member.user?.username || member.user?.email || 'Участник';
                  const roleIds = memberRoleMap[member.user_id] || [];

                  return (
                    <div key={member.id} className={styles['create-project-modal__member-role-card']}>
                      <div className={styles['create-project-modal__member-role-header']}>
                        <div className={styles['create-project-modal__member-main']}>
                          <strong>{displayName}</strong>
                          <span>@{member.user?.username || 'unknown'}</span>
                        </div>
                      </div>

                      <div className={styles['create-project-modal__role-chips']}>
                        {visibleProjectRoles.map((role) => {
                          const isActive = roleIds.includes(role.id);
                          return (
                            <button
                              key={`${member.id}-${role.id}`}
                              type="button"
                              className={`${styles['create-project-modal__role-chip']} ${isActive ? styles['create-project-modal__role-chip--active'] : ''}`}
                              style={isActive ? { borderColor: role.color, color: role.color, backgroundColor: `${role.color}1f` } : undefined}
                              onClick={() => toggleMemberProjectRole(member.user_id, role.id)}
                            >
                              <span className={styles['create-project-modal__role-dot']} style={{ backgroundColor: role.color }} />
                              {role.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {error ? <div className={styles['create-project-modal__error-message']}>{error}</div> : null}

          <div className={styles['create-project-modal__actions']}>
            <Button variant="secondary" onClick={closeCreateProject} disabled={isSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="primary" loading={isSubmitting} onClick={handleSubmit}>
              Создать проект
            </Button>
          </div>
        </div>
        ) : (
          <>
            <div className={styles['create-project-modal__error-message']}>
              Создавать проекты может только владелец организации.
            </div>
            <div className={styles['create-project-modal__actions']}>
              <Button variant="secondary" onClick={closeCreateProject}>
                Закрыть
              </Button>
            </div>
          </>
        )
      ) : (
        <>
          <div className={styles['create-project-modal__error-message']}>
            Сначала выберите организацию, в которой нужно создать проект.
          </div>
          <div className={styles['create-project-modal__actions']}>
            <Button variant="secondary" onClick={closeCreateProject}>
              Закрыть
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default CreateProjectModal;
