import type { OrganizationMember, OrganizationWithMembers } from '../types/organization.types';
import type { Project, ProjectMember } from '../types/project.types';
import type { Task } from '../types/task.types';

type MaybeOrganization = OrganizationWithMembers | null | undefined;
type MaybeProject = Project | null | undefined;

export const getOrganizationMember = (organization: MaybeOrganization, userId?: string | null): OrganizationMember | null => {
  if (!organization || !userId) return null;
  return organization.organization_members?.find((member) => member.user_id === userId) || null;
};

export const getProjectMember = (project: MaybeProject, userId?: string | null): ProjectMember | null => {
  if (!project || !userId) return null;
  return project.members?.find((member) => member.user_id === userId) || null;
};

export const isOrganizationOwner = (organization: MaybeOrganization, userId?: string | null) =>
  !!organization && !!userId && organization.created_by === userId;

export const isOrganizationAdmin = (organization: MaybeOrganization, userId?: string | null) =>
  getOrganizationMember(organization, userId)?.status === 'admin';

export const canManageOrganization = (organization: MaybeOrganization, userId?: string | null) =>
  isOrganizationOwner(organization, userId) || isOrganizationAdmin(organization, userId);

export const canCreateOrganizationProjects = (organization: MaybeOrganization, userId?: string | null) =>
  isOrganizationOwner(organization, userId);

export const isProjectLead = (project: MaybeProject, userId?: string | null) =>
  !!project && !!userId && project.lead_user_id === userId;

export const isProjectOwner = (project: MaybeProject, userId?: string | null) =>
  getProjectMember(project, userId)?.status === 'owner';

export const isProjectAdmin = (project: MaybeProject, userId?: string | null) =>
  getProjectMember(project, userId)?.status === 'admin';

export const canManageProject = (
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) =>
  canManageOrganization(organization, userId) ||
  isProjectLead(project, userId) ||
  isProjectOwner(project, userId) ||
  isProjectAdmin(project, userId);

export const canManageProjectMembers = (
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) => canManageProject(project, organization, userId);

export const canManageProjectRoles = (
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) => canManageProject(project, organization, userId);

export const canDeleteProject = (
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) => canManageProject(project, organization, userId);

export const canCreateTaskFromProjectChat = (
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) => canManageProject(project, organization, userId);

export const canManageTaskStatus = (
  task: Pick<Task, 'assignees'> | null | undefined,
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) => {
  if (!task || !userId) return false;
  if (canManageProject(project, organization, userId)) return true;
  return Array.isArray(task.assignees) && task.assignees.includes(userId);
};

export const canEditTask = (
  task: Pick<Task, 'created_by'> | null | undefined,
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) => {
  if (!task || !userId) return false;
  if (canManageProject(project, organization, userId)) return true;
  return task.created_by === userId;
};

export const canEditTaskReport = (
  task: Pick<Task, 'assignees'> | null | undefined,
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) => {
  if (!task || !userId) return false;
  if (canManageProject(project, organization, userId)) return true;
  return Array.isArray(task.assignees) && task.assignees.includes(userId);
};

export const canDeleteProjectMessage = (
  params: {
    senderId?: string | null;
    type?: string | null;
  } | null | undefined,
  project: MaybeProject,
  organization: MaybeOrganization,
  userId?: string | null
) => {
  if (!params || !userId) return false;
  if (params.senderId === userId && params.type !== 'system') return true;
  return canManageProject(project, organization, userId);
};

export const canCreateThreadFromMessage = (message: { senderId?: string | null; type?: string | null } | null | undefined) =>
  !!message && message.senderId !== 'system' && message.type !== 'system';
