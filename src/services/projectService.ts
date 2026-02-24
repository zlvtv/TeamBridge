import { 
  getCollection, 
  createDoc, 
  updateDocById, 
  deleteDocById,
  subscribeToCollection,
  getDocById
} from './firestore/firestoreService';
import { ProjectMember, Task } from '../types/project.types';

export interface CreateProjectData {
  name: string;
  description?: string | null;
  organization_id: string;
  created_by: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string | null;
}

export interface ProjectWithDetails {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
  members: ProjectMember[];
  tasks: Task[];
  hasUnreadMessages?: boolean;
}

export const projectService = {
  async getProjectsByOrganization(orgId: string): Promise<ProjectWithDetails[]> {
    try {
      const projects = await getCollection('projects', {
        whereClauses: [{ field: 'organization_id', operator: '==', value: orgId }]
      });

      const projectsWithDetails = await Promise.all(
        projects.map(async (proj: any) => {
          const members = await this.getProjectMembers(proj.id);
          const tasks = await this.getTasks(proj.id);
          return { ...proj, members, tasks };
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
    };

    return await createDoc('projects', projectData);
  },

  async updateProject(projectId: string, data: UpdateProjectData): Promise<void> {
    if (data.name && !data.name.trim()) {
      throw new Error('Название проекта не может быть пустым');
    }

    const updateData = {
      ...data,
      name: data.name?.trim(),
    };

    await updateDocById('projects', projectId, updateData);
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
          profile: {
            id: m.user_id,
            username: userData?.username || 'user',
            full_name: userData?.full_name || 'Пользователь',
            avatar_url: userData?.avatar_url || null,
          }
        };
      })
    );

    return membersWithProfiles;
  },

  async addMember(projectId: string, userId: string, status: 'member' | 'admin' | 'owner' = 'member'): Promise<void> {
    await createDoc('project_members', {
      project_id: projectId,
      user_id: userId,
      status,
      joined_at: new Date().toISOString()
    });
  },

  async removeMember(projectId: string, memberId: string): Promise<void> {
    await deleteDocById('project_members', memberId);
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
