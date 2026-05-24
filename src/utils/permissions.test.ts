import {
  canCreateTaskFromProjectChat,
  canDeleteProjectMessage,
  canEditTask,
  canEditTaskReport,
  canManageOrganization,
  canManageProject,
  canManageTaskStatus,
  canCreateThreadFromMessage,
} from './permissions';
import type { OrganizationWithMembers } from '../types/organization.types';
import type { Project } from '../types/project.types';
import type { Task } from '../types/task.types';

const buildOrganization = (): OrganizationWithMembers => ({
  id: 'org-1',
  name: 'TeamBridge',
  description: null,
  created_by: 'owner-1',
  created_at: '2026-03-24T10:00:00.000Z',
  updated_at: '2026-03-24T10:00:00.000Z',
  organization_members: [
    {
      id: 'member-1',
      organization_id: 'org-1',
      user_id: 'owner-1',
      status: 'owner',
      joined_at: '2026-03-24T10:00:00.000Z',
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        username: 'owner',
        full_name: 'Owner',
        avatar_url: null,
        description: null,
      },
    },
    {
      id: 'member-2',
      organization_id: 'org-1',
      user_id: 'admin-1',
      status: 'admin',
      joined_at: '2026-03-24T10:00:00.000Z',
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        full_name: 'Admin',
        avatar_url: null,
        description: null,
      },
    },
    {
      id: 'member-3',
      organization_id: 'org-1',
      user_id: 'member-1',
      status: 'member',
      joined_at: '2026-03-24T10:00:00.000Z',
      user: {
        id: 'member-1',
        email: 'member@example.com',
        username: 'member',
        full_name: 'Member',
        avatar_url: null,
        description: null,
      },
    },
  ],
});

const buildProject = (): Project => ({
  id: 'project-1',
  organization_id: 'org-1',
  name: 'Alpha',
  description: null,
  created_at: '2026-03-24T10:00:00.000Z',
  created_by: 'owner-1',
  lead_user_id: 'lead-1',
  members: [
    {
      id: 'pm-1',
      project_id: 'project-1',
      user_id: 'owner-1',
      status: 'owner',
      joined_at: '2026-03-24T10:00:00.000Z',
      profile: {
        id: 'owner-1',
        username: 'owner',
        full_name: 'Owner',
        avatar_url: null,
      },
    },
    {
      id: 'pm-2',
      project_id: 'project-1',
      user_id: 'lead-1',
      status: 'member',
      joined_at: '2026-03-24T10:00:00.000Z',
      profile: {
        id: 'lead-1',
        username: 'lead',
        full_name: 'Lead',
        avatar_url: null,
      },
    },
    {
      id: 'pm-3',
      project_id: 'project-1',
      user_id: 'admin-2',
      status: 'admin',
      joined_at: '2026-03-24T10:00:00.000Z',
      profile: {
        id: 'admin-2',
        username: 'project_admin',
        full_name: 'Project Admin',
        avatar_url: null,
      },
    },
    {
      id: 'pm-4',
      project_id: 'project-1',
      user_id: 'assignee-1',
      status: 'member',
      joined_at: '2026-03-24T10:00:00.000Z',
      profile: {
        id: 'assignee-1',
        username: 'assignee',
        full_name: 'Assignee',
        avatar_url: null,
      },
    },
  ],
  tasks: [],
});

const buildTask = (): Task => ({
  id: 'task-1',
  project_id: 'project-1',
  title: 'Task',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  created_by: 'creator-1',
  created_at: '2026-03-24T10:00:00.000Z',
  updated_at: '2026-03-24T10:00:00.000Z',
  assignees: ['assignee-1'],
});

describe('permissions', () => {
  const organization = buildOrganization();
  const project = buildProject();
  const task = buildTask();

  it('allows only owner and organization admin to manage an organization', () => {
    expect(canManageOrganization(organization, 'owner-1')).toBe(true);
    expect(canManageOrganization(organization, 'admin-1')).toBe(true);
    expect(canManageOrganization(organization, 'member-1')).toBe(false);
  });

  it('allows organization managers, project lead, owner and admin to manage a project', () => {
    expect(canManageProject(project, organization, 'owner-1')).toBe(true);
    expect(canManageProject(project, organization, 'admin-1')).toBe(true);
    expect(canManageProject(project, organization, 'lead-1')).toBe(true);
    expect(canManageProject(project, organization, 'admin-2')).toBe(true);
    expect(canManageProject(project, organization, 'assignee-1')).toBe(false);
  });

  it('allows assignees to change task status and report, but not edit the task body', () => {
    expect(canManageTaskStatus(task, project, organization, 'assignee-1')).toBe(true);
    expect(canEditTaskReport(task, project, organization, 'assignee-1')).toBe(true);
    expect(canEditTask(task, project, organization, 'assignee-1')).toBe(false);
  });

  it('allows project managers to create tasks from chat and delete system messages', () => {
    expect(canCreateTaskFromProjectChat(project, organization, 'lead-1')).toBe(true);
    expect(canDeleteProjectMessage({ senderId: 'system', type: 'system' }, project, organization, 'lead-1')).toBe(true);
    expect(canDeleteProjectMessage({ senderId: 'member-1', type: 'text' }, project, organization, 'member-1')).toBe(true);
  });

  it('prevents threads for system messages', () => {
    expect(canCreateThreadFromMessage({ senderId: 'system', type: 'system' })).toBe(false);
    expect(canCreateThreadFromMessage({ senderId: 'user-1', type: 'text' })).toBe(true);
  });
});
