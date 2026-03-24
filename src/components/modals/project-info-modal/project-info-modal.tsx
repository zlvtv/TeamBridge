import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/modal/modal';
import Input from '../../ui/input/input';
import Button from '../../ui/button/button';
import styles from './project-info-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useProject } from '../../../contexts/ProjectContext';
import { projectService } from '../../../services/projectService';
import { useAuth } from '../../../contexts/AuthContext';
import { getPresenceStatus } from '../../../utils/presence.utils';
import { isDeletedUserProfile } from '../../../utils/user.utils';
import {
  canManageProject,
  canManageProjectMembers,
  canManageProjectRoles,
} from '../../../utils/permissions';

const normalizeRoleKey = (role: string) => role.trim().toLocaleLowerCase('ru');
const isGeneralProject = (project?: { name?: string | null }) =>
  (project?.name || '').trim().toLocaleLowerCase('ru') === 'общий';
const createDraftProjectRole = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  color: '#6366f1',
});

const areRoleSetsEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].map(normalizeRoleKey).sort();
  const rightSorted = [...right].map(normalizeRoleKey).sort();
  return leftSorted.every((role, index) => role === rightSorted[index]);
};

interface ProjectInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProjectInfoModal: React.FC<ProjectInfoModalProps> = ({ isOpen, onClose }) => {
  const { currentOrganization } = useOrganization();
  const { currentProject, projects, refreshProjects } = useProject();
  const { user } = useAuth();

  const resolvedProject = useMemo(
    () => projects.find((project) => project.id === currentProject?.id) || currentProject,
    [currentProject, projects]
  );

  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectRolesDraft, setProjectRolesDraft] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [memberActionInfo, setMemberActionInfo] = useState<string | null>(null);
  const [isMutatingMemberId, setIsMutatingMemberId] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [memberRolesState, setMemberRolesState] = useState<Record<string, string[]>>({});
  const [presenceTick, setPresenceTick] = useState(0);
  const [rolePickerMemberId, setRolePickerMemberId] = useState<string | null>(null);
  const [rolePickerMemberSnapshot, setRolePickerMemberSnapshot] = useState<any | null>(null);
  const wasOpenRef = useRef(false);
  const pendingMemberRolesRef = useRef<Record<string, string[]>>({});

  const projectMember = resolvedProject?.members?.find((member) => member.user_id === user?.id);
  const canEditProject = canManageProject(resolvedProject, currentOrganization, user?.id);
  const isDefaultGeneralProject = isGeneralProject(resolvedProject);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current || !resolvedProject) return;

    wasOpenRef.current = true;
    setActiveTab('overview');
    setName(resolvedProject.name || '');
    setDescription(resolvedProject.description || '');
    setProjectRolesDraft(
      Array.isArray(resolvedProject.roles)
        ? resolvedProject.roles.map((role, index) => ({
            id: `${index}-${role.name}-${role.color}`,
            name: role.name || '',
            color: role.color || '#6366f1',
          }))
        : []
    );
    setMemberSearch('');
    setSaveError(null);
    setMemberActionError(null);
    setMemberActionInfo(null);
    setRolePickerMemberId(null);
    setRolePickerMemberSnapshot(null);
    pendingMemberRolesRef.current = {};
  }, [isOpen, resolvedProject]);

  useEffect(() => {
    if (!isOpen || !resolvedProject?.id) return;
    let cancelled = false;

    const loadMembers = async (showLoader = true) => {
      if (showLoader) setIsLoadingMembers(true);
      try {
        const fetched = await projectService.getProjectMembers(resolvedProject.id);
        if (!cancelled) setMembers(Array.isArray(fetched) ? fetched : []);
      } finally {
        if (!cancelled && showLoader) setIsLoadingMembers(false);
      }
    };

    setMembers(Array.isArray(resolvedProject.members) ? resolvedProject.members : []);
    loadMembers();

    const refreshInterval = window.setInterval(() => {
      loadMembers(false);
    }, 45000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [isOpen, resolvedProject?.id, resolvedProject?.members]);

  useEffect(() => {
    if (!isOpen) return;
    const intervalId = window.setInterval(() => {
      setPresenceTick((value) => value + 1);
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setMemberRolesState(() => {
      const next: Record<string, string[]> = {};
      members.forEach((member) => {
        const backendRoles = Array.isArray(member.roles) ? member.roles.filter(Boolean) : [];
        const pendingRoles = pendingMemberRolesRef.current[member.id];

        if (pendingRoles) {
          const leftSorted = [...backendRoles].map(normalizeRoleKey).sort();
          const rightSorted = [...pendingRoles].map(normalizeRoleKey).sort();
          const isSynced =
            leftSorted.length === rightSorted.length &&
            leftSorted.every((role, index) => role === rightSorted[index]);

          if (isSynced) {
            delete pendingMemberRolesRef.current[member.id];
            next[member.id] = backendRoles;
          } else {
            next[member.id] = pendingRoles;
          }
        } else {
          next[member.id] = backendRoles;
        }
      });
      return next;
    });
  }, [isOpen, members]);

  const getDisplayName = (member: any) =>
    member?.profile?.full_name || member?.profile?.username || 'Пользователь';

  const getMemberPresence = (member: any) => {
    const organizationMember = currentOrganization?.organization_members?.find(
      (item) => item.user_id === member?.user_id
    );
    return getPresenceStatus(
      organizationMember?.user?.last_seen_at ||
      member?.profile?.last_seen_at ||
      null
    );
  };

  const getOrganizationMemberRoles = (member: any) => {
    const organizationMember = currentOrganization?.organization_members?.find(
      (item) => item.user_id === member?.user_id
    );
    const roles = Array.isArray(organizationMember?.roles)
      ? organizationMember.roles.filter(Boolean)
      : typeof organizationMember?.roles === 'string' && organizationMember.roles.trim()
      ? [organizationMember.roles]
      : [];

    return roles.map((roleName) => {
      const role = currentOrganization?.roles?.find(
        (item) => normalizeRoleKey(item.name) === normalizeRoleKey(roleName)
      );
      return {
        name: roleName,
        color: role?.color,
      };
    });
  };

  const projectRoles = resolvedProject?.roles || [];
  const visibleProjectRolesDraft = useMemo(
    () => projectRolesDraft.filter((role) => role.name.trim()),
    [projectRolesDraft]
  );
  const availableProjectRoleNames = useMemo(
    () => visibleProjectRolesDraft.map((role) => role.name.trim()).filter(Boolean),
    [visibleProjectRolesDraft]
  );

  const sortedMembers = useMemo(() => {
    const rank = (member: any) => {
      const value = String(member?.status || 'member').toLowerCase();
      if (value === 'owner') return 0;
      if (value === 'admin') return 1;
      return 2;
    };
    return [...members].sort((a, b) => {
      const byRole = rank(a) - rank(b);
      if (byRole !== 0) return byRole;
      return getDisplayName(a).localeCompare(getDisplayName(b), 'ru');
    });
  }, [members]);

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLocaleLowerCase('ru');
    if (!term) return sortedMembers;
    return sortedMembers.filter((member) => {
      const displayName = getDisplayName(member).toLocaleLowerCase('ru');
      const username = (member?.profile?.username || '').toLocaleLowerCase('ru');
      const roles = (memberRolesState[member.id] || []).map((role) => role.toLocaleLowerCase('ru'));
      return displayName.includes(term) || username.includes(term) || roles.some((role) => role.includes(term));
    });
  }, [memberRolesState, memberSearch, sortedMembers]);

  const availableOrgMembers = useMemo(() => {
    const projectUserIds = new Set(members.map((member) => member.user_id));
    return (currentOrganization?.organization_members || [])
      .filter((member) => !isDeletedUserProfile(member.user))
      .filter((member) => !projectUserIds.has(member.user_id))
      .sort((a, b) => {
        const nameA = a.user?.full_name || a.user?.username || a.user?.email || '';
        const nameB = b.user?.full_name || b.user?.username || b.user?.email || '';
        return nameA.localeCompare(nameB, 'ru');
      });
  }, [currentOrganization?.organization_members, members]);

  const rolePickerMember = useMemo(() => {
    if (!rolePickerMemberId) return null;
    return members.find((member) => member.id === rolePickerMemberId) || rolePickerMemberSnapshot;
  }, [members, rolePickerMemberId, rolePickerMemberSnapshot]);

  const canManageMember = (member: any) => {
    if (!resolvedProject) return false;
    if (member.user_id === resolvedProject.created_by) return false;
    return canManageProjectMembers(resolvedProject, currentOrganization, user?.id);
  };

  const canManageMemberRoles = (member: any) => {
    if (!resolvedProject) return false;
    if (isDeletedUserProfile(member?.profile)) return false;
    return canManageProjectRoles(resolvedProject, currentOrganization, user?.id);
  };

  const canTransferLead = (member: any) => {
    if (!resolvedProject || isDefaultGeneralProject) return false;
    if (resolvedProject.lead_user_id !== user?.id) return false;
    return member.user_id !== resolvedProject.lead_user_id;
  };

  const currentUserProjectMember = members.find((member) => member.user_id === user?.id);
  const canLeaveProject = !!currentUserProjectMember && !isDefaultGeneralProject;

  useEffect(() => {
    if (!rolePickerMemberId) {
      setRolePickerMemberSnapshot(null);
      return;
    }

    const nextMember = members.find((member) => member.id === rolePickerMemberId);
    if (nextMember) {
      setRolePickerMemberSnapshot(nextMember);
    }
  }, [members, rolePickerMemberId]);

  const openRolePicker = (memberId: string) => {
    const member = members.find((item) => item.id === memberId) || null;
    if (!member || isDeletedUserProfile(member?.profile)) return;
    setRolePickerMemberId(memberId);
    setRolePickerMemberSnapshot(member);
  };

  const closeRolePicker = () => {
    setRolePickerMemberId(null);
    setRolePickerMemberSnapshot(null);
  };

  const handleSave = async () => {
    if (!resolvedProject || !canEditProject) return;
    if (!name.trim()) {
      setSaveError('Введите название проекта');
      return;
    }

    const projectRoleNames = availableProjectRoleNames.map(normalizeRoleKey);
    if (new Set(projectRoleNames).size !== projectRoleNames.length) {
      setSaveError('Названия локальных ролей должны быть уникальными');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setMemberActionError(null);

    try {
      await projectService.updateProject(resolvedProject.id, {
        name: name.trim(),
        description: description.trim() || null,
        roles: visibleProjectRolesDraft.map((role) => ({
          name: role.name.trim(),
          color: role.color || '#6366f1',
        })),
      });

      const memberUpdates = members.filter((member) => {
        const backendRoles = Array.isArray(member.roles) ? member.roles.filter(Boolean) : [];
        const draftRoles = (memberRolesState[member.id] || []).filter((roleName) =>
          availableProjectRoleNames.some((item) => normalizeRoleKey(item) === normalizeRoleKey(roleName))
        );
        return !areRoleSetsEqual(backendRoles, draftRoles);
      });

      await Promise.all(
        memberUpdates.map((member) => {
          const draftRoles = (memberRolesState[member.id] || []).filter((roleName) =>
            availableProjectRoleNames.some((item) => normalizeRoleKey(item) === normalizeRoleKey(roleName))
          );
          return projectService.updateMemberRoles(resolvedProject.id, member.id, draftRoles);
        })
      );

      await refreshProjects();
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Не удалось обновить проект');
    } finally {
      setIsSaving(false);
    }
  };

  const addProjectRoleDraft = () => {
    setProjectRolesDraft((prev) => [...prev, createDraftProjectRole()]);
  };

  const updateProjectRoleDraft = (
    index: number,
    field: 'name' | 'color',
    value: string
  ) => {
    setProjectRolesDraft((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, [field]: value };
      return next;
    });
  };

  const removeProjectRoleDraft = (index: number) => {
    setProjectRolesDraft((prev) => {
      const roleToRemove = prev[index];
      if (!roleToRemove) return prev;

      const next = prev.filter((_, roleIndex) => roleIndex !== index);
      setMemberRolesState((current) => {
        const updated = Object.fromEntries(
          Object.entries(current).map(([memberId, roles]) => [
            memberId,
            roles.filter((roleName) => normalizeRoleKey(roleName) !== normalizeRoleKey(roleToRemove.name)),
          ])
        ) as Record<string, string[]>;
        return updated;
      });
      return next;
    });
  };

  const toggleMemberRole = (memberId: string, roleName: string) => {
    if (!resolvedProject || !canEditProject) return;
    const member = members.find((item) => item.id === memberId);
    if (!member) return;
    if (isDeletedUserProfile(member?.profile)) {
      setMemberActionError('Удаленному пользователю нельзя назначать локальные роли');
      return;
    }

    const currentRoles = memberRolesState[memberId] || [];
    const nextRoles = currentRoles.some((role) => normalizeRoleKey(role) === normalizeRoleKey(roleName))
      ? currentRoles.filter((role) => normalizeRoleKey(role) !== normalizeRoleKey(roleName))
      : [...currentRoles, roleName];

    setMemberRolesState((prev) => ({
      ...prev,
      [memberId]: nextRoles,
    }));
    pendingMemberRolesRef.current[memberId] = nextRoles;
    setRolePickerMemberSnapshot((prev) => {
      if (!prev || prev.id !== memberId) return prev;
      return { ...prev, roles: nextRoles };
    });
  };

  const handleAddMember = async (userId: string) => {
    if (!resolvedProject || !canEditProject) return;

    const sourceMember = currentOrganization?.organization_members?.find((member) => member.user_id === userId);
    if (!sourceMember || isDeletedUserProfile(sourceMember.user)) {
      setMemberActionError('Нельзя добавлять удаленного пользователя в проект');
      return;
    }
    const displayName = sourceMember?.user?.full_name || sourceMember?.user?.username || sourceMember?.user?.email || 'Участник';

    setIsMutatingMemberId(userId);
    setMemberActionError(null);
    setMemberActionInfo(null);

    try {
      await projectService.addMember(resolvedProject.id, userId, 'member', {
        displayName,
      });
      const refreshed = await projectService.getProjectMembers(resolvedProject.id);
      setMembers(Array.isArray(refreshed) ? refreshed : []);
      await refreshProjects();
    } catch (err: any) {
      setMemberActionError(err.message || 'Не удалось добавить участника');
    } finally {
      setIsMutatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!resolvedProject || !canEditProject) return;
    const member = members.find((item) => item.id === memberId);
    if (!member || member.user_id === resolvedProject.created_by) return;

    setIsMutatingMemberId(memberId);
    setMemberActionError(null);
    setMemberActionInfo(null);

    try {
      await projectService.removeMember(resolvedProject.id, memberId);
      const refreshed = await projectService.getProjectMembers(resolvedProject.id);
      setMembers(Array.isArray(refreshed) ? refreshed : []);
      await refreshProjects();
    } catch (err: any) {
      setMemberActionError(err.message || 'Не удалось удалить участника');
    } finally {
      setIsMutatingMemberId(null);
    }
  };

  const handleLeaveProject = async () => {
    if (!resolvedProject || !currentUserProjectMember || !canLeaveProject) return;

    setIsMutatingMemberId(currentUserProjectMember.id);
    setMemberActionError(null);
    setMemberActionInfo('Выходим из проекта...');

    try {
      await projectService.removeMember(resolvedProject.id, currentUserProjectMember.id);
      await refreshProjects();
      onClose();
    } catch (err: any) {
      setMemberActionError(err.message || 'Не удалось покинуть проект');
      setMemberActionInfo(null);
    } finally {
      setIsMutatingMemberId(null);
    }
  };

  const handleTransferLead = async (memberId: string) => {
    if (!resolvedProject) return;

    setIsMutatingMemberId(memberId);
    setMemberActionError(null);
    setMemberActionInfo('Передаем кураторство...');

    try {
      await projectService.transferLead(resolvedProject.id, memberId);
      const refreshed = await projectService.getProjectMembers(resolvedProject.id);
      setMembers(Array.isArray(refreshed) ? refreshed : []);
      await refreshProjects();
      setMemberActionInfo(null);
    } catch (err: any) {
      setMemberActionError(err.message || 'Не удалось передать кураторство');
      setMemberActionInfo(null);
    } finally {
      setIsMutatingMemberId(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!resolvedProject || !canEditProject || isDefaultGeneralProject) return;

    setSaveError(null);
    setMemberActionError(null);
    setMemberActionInfo('Удаляем проект...');
    setIsDeletingProject(true);

    try {
      await projectService.deleteProject(resolvedProject.id);
      await refreshProjects();
      onClose();
    } catch (err: any) {
      setMemberActionError(err.message || 'Не удалось удалить проект');
      setMemberActionInfo(null);
    } finally {
      setIsDeletingProject(false);
    }
  };

  if (!resolvedProject || !currentOrganization) return null;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="О проекте"
      maxWidth={760}
      disableOutsideClick={!!rolePickerMember}
      disableEscape={!!rolePickerMember}
    >
      <div className={styles['project-info-modal__content']}>
        <div className={styles['project-info-modal__title-block']}>
          <h3 className={styles['project-info-modal__title']}>{resolvedProject.name}</h3>
          {resolvedProject.description ? (
            <p className={styles['project-info-modal__title-description']}>{resolvedProject.description}</p>
          ) : null}
        </div>

        <div className={styles['project-info-modal__tabs']}>
          <button
            type="button"
            className={`${styles['project-info-modal__tab']} ${activeTab === 'overview' ? styles['project-info-modal__tab--active'] : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Обзор
          </button>
          {canEditProject ? (
            <button
              type="button"
              className={`${styles['project-info-modal__tab']} ${activeTab === 'settings' ? styles['project-info-modal__tab--active'] : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Настройки
            </button>
          ) : null}
        </div>

        {activeTab === 'overview' ? (
          <div className={styles['project-info-modal__section']}>
            {!isDefaultGeneralProject ? (
              <div className={styles['project-info-modal__overview-grid']}>
                <div className={styles['project-info-modal__info-card']}>
                  <span className={styles['project-info-modal__eyebrow']}>Куратор проекта</span>
                  <strong>
                    {members.find((member) => member.user_id === resolvedProject.lead_user_id)
                      ? getDisplayName(members.find((member) => member.user_id === resolvedProject.lead_user_id))
                      : 'Не назначен'}
                  </strong>
                </div>
                {canLeaveProject ? (
                  <div className={styles['project-info-modal__info-card']}>
                    <span className={styles['project-info-modal__eyebrow']}>Участие</span>
                    <strong>Можно покинуть проект</strong>
                    <div className={styles['project-info-modal__inline-actions']}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        loading={isMutatingMemberId === currentUserProjectMember?.id}
                        onClick={handleLeaveProject}
                      >
                        Покинуть проект
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {projectRoles.length > 0 ? (
              <div className={styles['project-info-modal__filter-group']}>
                <div className={styles['project-info-modal__filter-label']}>Локальные роли проекта</div>
                <div className={styles['project-info-modal__filter-row']}>
                  {projectRoles.map((role) => (
                    <span
                      key={role.name}
                      className={styles['project-info-modal__role-chip']}
                      style={{ backgroundColor: `${role.color}1f`, color: role.color, borderColor: `${role.color}4d` }}
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles['project-info-modal__members']}>
              {isLoadingMembers ? (
                <div className={styles['project-info-modal__empty']}>Загрузка участников...</div>
              ) : filteredMembers.length === 0 ? (
                <div className={styles['project-info-modal__empty']}>Участники не найдены</div>
              ) : (
                filteredMembers.map((member) => {
                  void presenceTick;
                  const presence = getMemberPresence(member);
                  const orgRoles = getOrganizationMemberRoles(member);
                  const statusLabel =
                    member.user_id === resolvedProject.created_by
                      ? 'Владелец'
                      : member.user_id === resolvedProject.lead_user_id || String(member.status).toLowerCase() === 'admin'
                      ? 'Куратор'
                      : 'Участник';
                  const deletedUser = isDeletedUserProfile(member?.profile);

                  return (
                    <div key={member.id || member.user_id} className={styles['project-info-modal__member']}>
                      <div className={styles['project-info-modal__avatar']}>
                        {member?.profile?.avatar_url ? (
                          <img
                            src={member.profile.avatar_url}
                            alt={getDisplayName(member)}
                            className={styles['project-info-modal__avatar-image']}
                          />
                        ) : (
                          getDisplayName(member).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className={styles['project-info-modal__member-info']}>
                        <div className={styles['project-info-modal__member-topline']}>
                          <span className={styles['project-info-modal__member-name']}>{getDisplayName(member)}</span>
                        </div>
                        {!deletedUser ? (
                          <div className={styles['project-info-modal__member-secondary']}>@{member?.profile?.username || 'unknown'}</div>
                        ) : null}
                        <div
                          className={`${styles['project-info-modal__member-presence']} ${styles[`project-info-modal__member-presence--${presence.tone}`]}`}
                        >
                          <span className={styles['project-info-modal__presence-dot']} />
                          {presence.label}
                        </div>
                        <div className={styles['project-info-modal__member-roles']}>
                          <span className={`${styles['project-info-modal__status-badge']} ${styles[`project-info-modal__status-badge--${statusLabel === 'Владелец' ? 'owner' : statusLabel === 'Куратор' ? 'admin' : 'member'}`]}`}>
                            {statusLabel}
                          </span>
                          {(Array.isArray(member.roles) ? member.roles : []).map((roleName: string) => {
                            const role = projectRoles.find(
                              (item) => normalizeRoleKey(item.name) === normalizeRoleKey(roleName)
                            );

                            return (
                              <span
                                key={`${member.id || member.user_id}-${roleName}`}
                                className={styles['project-info-modal__role-chip']}
                                style={role ? { backgroundColor: `${role.color}1f`, color: role.color, borderColor: `${role.color}4d` } : undefined}
                              >
                                {roleName}
                              </span>
                            );
                          })}
                          {orgRoles.map((role) => (
                            <span
                              key={`${member.id || member.user_id}-org-${role.name}`}
                              className={styles['project-info-modal__org-role-badge']}
                              style={role.color ? { backgroundColor: role.color } : undefined}
                            >
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className={styles['project-info-modal__section']}>
            <div className={styles['project-info-modal__settings-card']}>
              <div className={styles['project-info-modal__settings-copy']}>
                <strong>Настройки проекта</strong>
                <p className={styles['project-info-modal__settings-text']}>
                  Название и описание проекта может менять только куратор проекта.
                </p>
              </div>
              {memberActionInfo ? <div className={styles['project-info-modal__status']}>{memberActionInfo}</div> : null}
              <div className={styles['project-info-modal__form']}>
                <div className={styles['project-info-modal__field']}>
                  <label className={styles['project-info-modal__label']}>Название проекта</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                </div>
                <div className={styles['project-info-modal__field']}>
                  <label className={styles['project-info-modal__label']}>Описание</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    textarea
                    resize="none"
                    rows={4}
                  />
                </div>
                {saveError ? <div className={styles['project-info-modal__error']}>{saveError}</div> : null}
              </div>
            </div>

            {!isDefaultGeneralProject ? (
              <div className={`${styles['project-info-modal__settings-card']} ${styles['project-info-modal__danger-card']}`}>
                <div className={styles['project-info-modal__settings-copy']}>
                  <strong>Удаление проекта</strong>
                  <p className={styles['project-info-modal__settings-text']}>
                    Проект будет удален целиком вместе с участниками, задачами и всеми сообщениями.
                  </p>
                </div>
                <div className={styles['project-info-modal__actions']}>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDeleteProject}
                    loading={isDeletingProject}
                  >
                    Удалить проект
                  </Button>
                </div>
              </div>
            ) : null}

            <div className={styles['project-info-modal__settings-card']}>
              <div className={styles['project-info-modal__settings-copy']}>
                <strong>Участники проекта</strong>
                <p className={styles['project-info-modal__settings-text']}>
                  Здесь можно добавлять и удалять участников проекта, а также менять только локальные роли проекта.
                </p>
              </div>

              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Поиск по участникам проекта"
                size="small"
              />

              <div className={styles['project-info-modal__settings-card']}>
                <div className={styles['project-info-modal__settings-copy']}>
                  <strong>Локальные роли проекта</strong>
                  <p className={styles['project-info-modal__settings-text']}>
                    Эти роли действуют только внутри текущего проекта и доступны для назначения его участникам.
                  </p>
                </div>
                <div className={styles['project-info-modal__role-fields']}>
                  {projectRolesDraft.map((role, index) => (
                    <div key={role.id} className={styles['project-info-modal__role-field']}>
                      <div className={styles['project-info-modal__role-name']}>
                        <Input
                          value={role.name}
                          onChange={(e) => updateProjectRoleDraft(index, 'name', e.target.value.slice(0, 32))}
                          placeholder="Название роли"
                          size="small"
                        />
                      </div>
                      <label className={styles['project-info-modal__color-picker']} aria-label="Цвет роли">
                        <input
                          type="color"
                          value={role.color}
                          onChange={(e) => updateProjectRoleDraft(index, 'color', e.target.value)}
                        />
                        <span
                          className={styles['project-info-modal__color-preview']}
                          style={{ backgroundColor: role.color }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={() => removeProjectRoleDraft(index)}
                      >
                        Удалить
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    className={styles['project-info-modal__add-role-btn']}
                    onClick={addProjectRoleDraft}
                  >
                    Добавить роль
                  </Button>
                </div>
              </div>

              {memberActionError ? <div className={styles['project-info-modal__error']}>{memberActionError}</div> : null}

              <div className={styles['project-info-modal__members']}>
                {filteredMembers.map((member) => {
                  const isOwner = member.user_id === resolvedProject.created_by;
                  const localRoles = memberRolesState[member.id] || [];
                  const orgRoles = getOrganizationMemberRoles(member);
                  const deletedUser = isDeletedUserProfile(member?.profile);
                  const canOpenLocalRoles = availableProjectRoleNames.length > 0 && canManageMemberRoles(member);

                  return (
                    <div
                      key={`settings-${member.id}`}
                      className={`${styles['project-info-modal__member']} ${canOpenLocalRoles ? styles['project-info-modal__member--interactive'] : ''} ${deletedUser ? styles['project-info-modal__member--disabled'] : ''}`}
                      onClick={() => {
                        if (canOpenLocalRoles) {
                          openRolePicker(member.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && canOpenLocalRoles) {
                          e.preventDefault();
                          openRolePicker(member.id);
                        }
                      }}
                      role={canOpenLocalRoles ? 'button' : undefined}
                      tabIndex={canOpenLocalRoles ? 0 : -1}
                      aria-disabled={!canOpenLocalRoles}
                    >
                      <div className={styles['project-info-modal__avatar']}>
                        {member?.profile?.avatar_url ? (
                          <img
                            src={member.profile.avatar_url}
                            alt={getDisplayName(member)}
                            className={styles['project-info-modal__avatar-image']}
                          />
                        ) : (
                          getDisplayName(member).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className={styles['project-info-modal__member-info']}>
                        <div className={styles['project-info-modal__member-topline']}>
                          <span className={styles['project-info-modal__member-name']}>{getDisplayName(member)}</span>
                          <div className={styles['project-info-modal__member-actions']}>
                            {canTransferLead(member) ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleTransferLead(member.id);
                                }}
                                disabled={isMutatingMemberId === member.id}
                              >
                                Сделать куратором
                              </Button>
                            ) : null}
                            {!isOwner ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleRemoveMember(member.id);
                                }}
                                disabled={isMutatingMemberId === member.id || !canManageMember(member)}
                              >
                                Удалить
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {!deletedUser ? (
                          <div className={styles['project-info-modal__member-secondary']}>@{member?.profile?.username || 'unknown'}</div>
                        ) : null}
                        <div className={styles['project-info-modal__member-roles']}>
                          {localRoles.length > 0 ? (
                            localRoles.map((roleName) => {
                              const role = visibleProjectRolesDraft.find(
                                (item) => normalizeRoleKey(item.name) === normalizeRoleKey(roleName)
                              );
                              return (
                                <span
                                  key={`${member.id}-${roleName}`}
                                  className={styles['project-info-modal__role-chip']}
                                  style={role ? { backgroundColor: `${role.color}1f`, color: role.color, borderColor: `${role.color}4d` } : undefined}
                                >
                                  {roleName}
                                </span>
                              );
                            })
                          ) : (
                            <span className={styles['project-info-modal__member-role-placeholder']}>
                              {deletedUser
                                ? 'Для удаленного пользователя локальные роли недоступны'
                                : availableProjectRoleNames.length > 0 && canManageMemberRoles(member)
                                ? 'Нажмите, чтобы назначить роли'
                                : 'Локальные роли не назначены'}
                            </span>
                          )}
                          {orgRoles.map((role) => (
                            <span
                              key={`${member.id}-settings-org-${role.name}`}
                              className={styles['project-info-modal__org-role-badge']}
                              style={role.color ? { backgroundColor: role.color } : undefined}
                            >
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {availableOrgMembers.length > 0 ? (
                <div className={styles['project-info-modal__add-members']}>
                  <div className={styles['project-info-modal__filter-label']}>Добавить из организации</div>
                  <div className={styles['project-info-modal__add-members-list']}>
                    {availableOrgMembers.map((member) => {
                      const displayName = member.user?.full_name || member.user?.username || member.user?.email || 'Участник';
                      const deletedUser = isDeletedUserProfile(member.user);
                      return (
                        <div key={member.id} className={styles['project-info-modal__add-member-card']}>
                          <div className={styles['project-info-modal__member-mainline']}>
                            <strong>{displayName}</strong>
                            {!deletedUser ? <span>@{member.user?.username || 'unknown'}</span> : null}
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="small"
                            onClick={() => handleAddMember(member.user_id)}
                            disabled={isMutatingMemberId === member.user_id}
                          >
                            Добавить
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles['project-info-modal__actions']}>
              <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                Отмена
              </Button>
              <Button variant="primary" onClick={handleSave} loading={isSaving}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
      {rolePickerMember ? (
        <Modal
          isOpen={!!rolePickerMember}
          onClose={closeRolePicker}
          title={`Роли: ${getDisplayName(rolePickerMember)}`}
          maxWidth={560}
        >
          <div className={styles['project-info-modal__role-picker']}>
            <p className={styles['project-info-modal__role-picker-text']}>
              Нажмите на роль, чтобы назначить ее участнику. Повторное нажатие снимает роль.
            </p>
            <div className={styles['project-info-modal__role-picker-grid']}>
              {availableProjectRoleNames.length === 0 ? (
                <div className={styles['project-info-modal__empty']}>Сначала добавьте локальные роли проекту.</div>
              ) : (
                visibleProjectRolesDraft.map((role) => {
                  const activeRoles = memberRolesState[rolePickerMember.id] || [];
                  const isActive = activeRoles.some((item) => normalizeRoleKey(item) === normalizeRoleKey(role.name));
                  return (
                    <button
                      key={role.name}
                      type="button"
                      className={`${styles['project-info-modal__role-picker-chip']} ${isActive ? styles['project-info-modal__role-picker-chip--active'] : ''}`}
                      style={{
                        borderColor: role.color,
                        backgroundColor: isActive ? `${role.color}22` : undefined,
                        color: isActive ? role.color : undefined,
                      }}
                      disabled={isMutatingMemberId === rolePickerMember.id}
                      onClick={() => toggleMemberRole(rolePickerMember.id, role.name)}
                    >
                      <span className={styles['project-info-modal__role-picker-dot']} style={{ backgroundColor: role.color }} />
                      {role.name}
                    </button>
                  );
                })
              )}
            </div>
            <div className={styles['project-info-modal__role-picker-footer']}>
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

export default ProjectInfoModal;
