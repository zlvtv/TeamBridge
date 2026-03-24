import { 
  getCollection, 
  createDoc, 
  updateDocById, 
  deleteDocById,
  subscribeToCollection,
  getDocById
} from './firestore/firestoreService';
import { Project, ProjectMember, ProjectRole, Task } from '../types/project.types';
import { messageService } from './messageService';
import { touchOrganizationActivity, touchOrganizationActivityByProject } from './activityService';
import { buildUserFromSnapshot, isDeletedUserProfile } from '../utils/user.utils';

export interface CreateProjectData {
  name: string;
  description?: string | null;
  organization_id: string;
  created_by: string;
  lead_user_id?: string | null;
  roles?: ProjectRole[];
  auto_add_org_roles?: string[];
}

export interface UpdateProjectData {
  name?: string;
  description?: string | null;
  lead_user_id?: string | null;
  roles?: ProjectRole[];
  auto_add_org_roles?: string[];
}

interface AddProjectMemberOptions {
  roles?: string[];
  displayName?: string | null;
  suppressSystemMessage?: boolean;
}

export interface ProjectWithDetails extends Project {}
const normalizeRoleKey = (role: string) => role.trim().toLocaleLowerCase('ru');

const assertProjectMemberIsNotDeleted = async (memberId: string) => {
  const member = await getDocById<ProjectMember>('project_members', memberId);
  if (!member?.user_id) {
    throw new Error('Участник проекта не найден');
  }

  const userSnap = await getDocById('users', member.user_id);
  const profile = buildUserFromSnapshot(userSnap, member.user_id);
  if (isDeletedUserProfile(profile)) {
    throw new Error('Нельзя назначать локальные роли удаленному пользователю');
  }
};

const assertUserIsNotDeleted = async (userId: string) => {
  const userSnap = await getDocById('users', userId);
  const profile = buildUserFromSnapshot(userSnap, userId);
  if (isDeletedUserProfile(profile)) {
    throw new Error('Нельзя добавлять удаленного пользователя в проект');
  }
};

export const projectService = {
  async syncGeneralProjectMembers(organizationId: string, organizationMembers: Array<{ user_id: string; status?: string }>): Promise<void> {
    const projects = await this.getProjectsBaseByOrganization(organizationId);
    const generalProject = projects.find(
      (project) => String(project.name || '').trim().toLocaleLowerCase('ru') === 'общий'
    );

    if (!generalProject) return;

    const projectMembers = await getCollection<ProjectMember>('project_members', {
      whereClauses: [{ field: 'project_id', operator: '==', value: generalProject.id }]
    });

    const expectedUsers = new Map(
      organizationMembers.map((member) => [
        member.user_id,
        member.status === 'owner' ? 'owner' : member.status === 'admin' ? 'admin' : 'member',
      ] as const)
    );

    const currentUsers = new Map(projectMembers.map((member) => [member.user_id, member] as const));

    await Promise.all(
      [...currentUsers.values()]
        .filter((member) => !expectedUsers.has(member.user_id))
        .map((member) => deleteDocById('project_members', member.id))
    );

    await Promise.all(
      [...expectedUsers.entries()]
        .filter(([userId]) => !currentUsers.has(userId))
        .map(([userId, status]) =>
          createDoc('project_members', {
            project_id: generalProject.id,
            user_id: userId,
            status,
            roles: [],
            joined_at: new Date().toISOString(),
          })
        )
    );
  },

  async getProjectsBaseByOrganization(orgId: string): Promise<ProjectWithDetails[]> {
    try {
      const projects = await getCollection('projects', {
        whereClauses: [{ field: 'organization_id', operator: '==', value: orgId }]
      });

      return projects.map((proj: any) => ({
        ...proj,
        members: [],
        tasks: [],
      })) as ProjectWithDetails[];
    } catch (error) {
      console.error('Error fetching base projects:', error);
      return [];
    }
  },

  async getProjectsByOrganization(orgId: string): Promise<ProjectWithDetails[]> {
    try {
      const projects = await this.getProjectsBaseByOrganization(orgId);

      const projectsWithDetails = await Promise.all(
        projects.map(async (proj: any) => {
          const members = await this.getProjectMembers(proj.id);
          return { ...proj, members, tasks: [] };
        })
      );

      return projectsWithDetails as ProjectWithDetails[];
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  },

  async createProject(data: CreateProjectData): Promise<string> {
    if (!data.name?.trim()) {
      throw new Error('Название проекта обязательно');
    }

    const projectData = {
      name: data.name.trim(),
      description: data.description || null,
      organization_id: data.organization_id,
      created_by: data.created_by,
      lead_user_id: data.lead_user_id || null,
      roles: data.roles || [],
      auto_add_org_roles: data.auto_add_org_roles || [],
    };

    const createdProject = await createDoc('projects', projectData);
    await touchOrganizationActivity(data.organization_id);
    return createdProject.id;
  },

  async updateProject(projectId: string, data: UpdateProjectData): Promise<void> {
    if (data.name && !data.name.trim()) {
      throw new Error('Название проекта не может быть пустым');
    }

    const updateData = {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.lead_user_id !== undefined ? { lead_user_id: data.lead_user_id } : {}),
      ...(data.roles !== undefined ? { roles: data.roles } : {}),
      ...(data.auto_add_org_roles !== undefined ? { auto_add_org_roles: data.auto_add_org_roles } : {}),
    };

    await updateDocById('projects', projectId, updateData);

    if (data.roles !== undefined) {
      const allowedRoleKeys = new Set(
        (data.roles || [])
          .map((role) => String(role?.name || '').trim())
          .filter(Boolean)
          .map(normalizeRoleKey)
      );

      const members = await getCollection<ProjectMember>('project_members', {
        whereClauses: [{ field: 'project_id', operator: '==', value: projectId }]
      });

      await Promise.all(
        members.map(async (member) => {
          const currentRoles = Array.isArray(member.roles)
            ? member.roles.filter(Boolean).map((role) => String(role))
            : [];
          const filteredRoles = currentRoles.filter((role) => allowedRoleKeys.has(normalizeRoleKey(role)));
          const rolesChanged =
            filteredRoles.length !== currentRoles.length ||
            filteredRoles.some((role, index) => role !== currentRoles[index]);

          if (!rolesChanged) return;

          await updateDocById('project_members', member.id, {
            roles: filteredRoles,
          });
        })
      );
    }

    await touchOrganizationActivityByProject(projectId);
    await messageService.sendSystemMessage(projectId, 'Проект обновлён');
  },

  async deleteProject(projectId: string): Promise<void> {
    await deleteDocById('projects', projectId);
    const members = await getCollection('project_members', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }]
    });
    await Promise.all(members.map(m => deleteDocById('project_members', m.id)));

    const tasks = await getCollection('tasks', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }]
    });
    await Promise.all(tasks.map(t => deleteDocById('tasks', t.id)));

    const messages = await getCollection('messages', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }]
    });
    await Promise.all(messages.map(message => deleteDocById('messages', message.id)));
  },

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const members = await getCollection<ProjectMember>('project_members', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }]
    });

    const membersWithProfiles = await Promise.all(
      members.map(async (m) => {
        const userData = await getDocById('users', m.user_id);
        return {
          ...m,
          roles: Array.isArray(m.roles) ? m.roles.filter(Boolean) : [],
          profile: {
            id: m.user_id,
            username: userData?.username || 'Удаленный пользователь',
            full_name: userData?.full_name || 'Удаленный пользователь',
            avatar_url: userData?.avatar_url || null,
            description: userData?.description || null,
            last_seen_at: userData?.last_seen_at || null,
          }
        };
      })
    );

    return membersWithProfiles;
  },

  async addMember(
    projectId: string,
    userId: string,
    status: 'member' | 'admin' | 'owner' = 'member',
    options: AddProjectMemberOptions = {}
  ): Promise<void> {
    await assertUserIsNotDeleted(userId);
    await createDoc('project_members', {
      project_id: projectId,
      user_id: userId,
      status,
      roles: options.roles || [],
      joined_at: new Date().toISOString()
    });
    if (status !== 'owner' && !options.suppressSystemMessage) {
      const userData = options.displayName ? null : await getDocById('users', userId);
      const resolvedName = options.displayName || userData?.full_name || userData?.username || 'новый участник';
      await messageService.sendSystemMessage(projectId, `В проект добавлен участник: ${resolvedName}`);
    }
    await touchOrganizationActivityByProject(projectId);
  },

  async removeMember(projectId: string, memberId: string): Promise<void> {
    await deleteDocById('project_members', memberId);
    const remainingMembers = await getCollection('project_members', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }]
    });

    if (remainingMembers.length === 0) {
      await this.deleteProject(projectId);
      return;
    }

    await messageService.sendSystemMessage(projectId, 'Участник удалён из проекта');
    await touchOrganizationActivityByProject(projectId);
  },

  async updateMemberRoles(projectId: string, memberId: string, roles: string[]): Promise<void> {
    await assertProjectMemberIsNotDeleted(memberId);
    const project = await getDocById<Project>('projects', projectId);
    const allowedRoleKeys = new Set(
      (Array.isArray(project?.roles) ? project.roles : [])
        .map((role) => String(role?.name || '').trim())
        .filter(Boolean)
        .map(normalizeRoleKey)
    );
    const filteredRoles = (Array.isArray(roles) ? roles : [])
      .map((role) => String(role || '').trim())
      .filter(Boolean)
      .filter((role) => allowedRoleKeys.has(normalizeRoleKey(role)));

    await updateDocById('project_members', memberId, {
      roles: filteredRoles,
    });
    await touchOrganizationActivityByProject(projectId);
  },

  async transferLead(projectId: string, nextLeadMemberId: string): Promise<void> {
    const project = await getDocById<Project>('projects', projectId);
    if (!project) {
      throw new Error('Проект не найден');
    }

    const members = await getCollection<ProjectMember>('project_members', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }]
    });

    const nextLeadMember = members.find((member) => member.id === nextLeadMemberId);
    if (!nextLeadMember) {
      throw new Error('Участник проекта не найден');
    }

    const currentLeadMember = members.find((member) => member.user_id === project.lead_user_id);

    await updateDocById('projects', projectId, {
      lead_user_id: nextLeadMember.user_id,
    });

    if (currentLeadMember && currentLeadMember.user_id !== project.created_by) {
      await updateDocById('project_members', currentLeadMember.id, {
        status: 'member',
      });
    }

    if (nextLeadMember.user_id !== project.created_by) {
      await updateDocById('project_members', nextLeadMember.id, {
        status: 'admin',
      });
    }

    const nextLeadProfile = await getDocById<any>('users', nextLeadMember.user_id);
    const nextLeadName =
      nextLeadProfile?.full_name ||
      nextLeadProfile?.username ||
      'новый куратор';

    await messageService.sendSystemMessage(projectId, `Куратор проекта изменен: ${nextLeadName}`);
    await touchOrganizationActivityByProject(projectId);
  },

  async getTasks(projectId: string): Promise<Task[]> {
    return await getCollection<Task>('tasks', {
      whereClauses: [{ field: 'project_id', operator: '==', value: projectId }],
      order: { field: 'created_at', direction: 'desc' }
    });
  },

  subscribeToProjects(
    orgId: string,
    onNext: (projects: any[]) => void,
    onError?: (error: Error) => void
  ) {
    return subscribeToCollection(
      'projects',
      (docs) => {
        onNext(docs);
      },
      {
        whereClauses: [{ field: 'organization_id', operator: '==', value: orgId }],
        order: { field: 'created_at', direction: 'desc' }
      },
      onError
    );
  },

  async isUserInProject(projectId: string, userId: string): Promise<boolean> {
    const members = await getCollection('project_members', {
      whereClauses: [
        { field: 'project_id', operator: '==', value: projectId },
        { field: 'user_id', operator: '==', value: userId }
      ]
    });
    return members.length > 0;
  },

  async searchProjects(orgId: string, query: string): Promise<any[]> {
    const allProjects = await this.getProjectsByOrganization(orgId);
    const q = query.toLowerCase();
    return allProjects.filter(p => p.name.toLowerCase().includes(q));
  },

  sortProjects(projects: any[], sortBy: 'name' | 'date', order: 'asc' | 'desc' = 'desc'): any[] {
    return [...projects].sort((a, b) => {
      if (sortBy === 'name') {
        return order === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return order === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });
  }
};
