import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useOrganization } from './OrganizationContext';
import { useAuth } from './AuthContext';
import { projectService } from '../services/projectService';
import { messageService } from '../services/messageService';
import { buildUserFromSnapshot } from '../utils/user.utils';

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_by: string;
  created_at: string;
  assignees: string[];
}

interface ProjectMember {
  id: string;
  user_id: string;
  status: 'member' | 'admin' | 'owner';
  joined_at: string;
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    description: string | null;
  };
}

interface Project {
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

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  addMember: (projectId: string, userId: string) => Promise<void>;
  removeMember: (projectId: string, userId: string) => Promise<void>;
  updateTask: (taskId: string, data: any) => Promise<void>;
  sendProjectEvent: (projectId: string, action: string, details: string) => Promise<void>;
  refreshProjects: () => Promise<Project[]>;
  isMember: (projectId: string) => boolean;
  canManageTasks: (projectId: string) => boolean;
  canCreateProjects: () => boolean;
  canRemoveMembers: () => boolean;
  markProjectAsRead: (projectId: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    if (!currentOrganization || !user) {
      setProjects([]);
      setIsLoading(false);
      return [];
    }

    try {
      setIsLoading(true);
      const projectsWithDetails = await projectService.getProjectsByOrganization(currentOrganization.id);

      const projectsWithReadStatus = await Promise.all(
        projectsWithDetails.map(async (proj) => {
          const hasUnread = await messageService.hasUnreadMessages(proj.id, user.id);
          return { ...proj, hasUnreadMessages: hasUnread };
        })
      );

      setProjects(projectsWithReadStatus);
      return projectsWithReadStatus;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id, user?.id]);

  const refreshProjects = useCallback(() => fetchProjects(), [fetchProjects]);

  const createProject = async (name: string, description?: string): Promise<Project> => {
    if (!currentOrganization || !user) throw new Error('No access');

    const projectId = await projectService.createProject({
      name,
      description,
      organization_id: currentOrganization.id,
      created_by: user.id
    });

    await projectService.addMember(projectId, user.id, 'owner');

    const newProject: Project = {
      id: projectId,
      organization_id: currentOrganization.id,
      name,
      description: description || null,
      created_at: new Date().toISOString(),
      created_by: user.id,
      members: [{
        id: 'temp',
        user_id: user.id,
        status: 'owner',
        joined_at: new Date().toISOString(),
        profile: { id: user.id, username: user.username, full_name: user.full_name, avatar_url: user.avatar_url }
      }],
      tasks: [],
      hasUnreadMessages: false
    };

    setProjects(prev => [newProject, ...prev]);
    setCurrentProject(newProject);
    localStorage.setItem('currentProjectId', projectId);

    await messageService.sendSystemMessage(projectId, `Создан проект: **${name}**`);

    return newProject;
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    if (!currentOrganization || !user) throw new Error('Нет доступа');

    const projectToDelete = projects.find(p => p.id === projectId);
    if (!projectToDelete) throw new Error('Проект не найден');

    try {
      await projectService.deleteProject(projectId);
      await messageService.sendSystemMessage(projectId, `Проект **${projectToDelete.name}** был удалён`);

      setProjects(prev => prev.filter(p => p.id !== projectId));

      if (currentProject?.id === projectId) {
        const remaining = projects.filter(p => p.id !== projectId);
        const newCurrent = remaining[0] || null;
        setCurrentProject(newCurrent);
        if (newCurrent) {
          localStorage.setItem('currentProjectId', newCurrent.id);
        } else {
          localStorage.removeItem('currentProjectId');
        }
      }
    } catch (err: any) {
      throw new Error(`Не удалось удалить проект: ${err.message}`);
    }
  };

  const addMember = async (projectId: string, userId: string): Promise<void> => {
    await projectService.addMember(projectId, userId);
    await refreshProjects();
  };

  const removeMember = async (projectId: string, userId: string): Promise<void> => {
    const member = projects
      .find(p => p.id === projectId)
      ?.members.find(m => m.user_id === userId);

    if (!member) throw new Error('Участник не найден');

    await projectService.removeMember(projectId, member.id);
    await refreshProjects();
  };

  const updateTask = async (taskId: string, data: any): Promise<void> => {
    console.log('updateTask', taskId, data);
  };

  const sendProjectEvent = async (projectId: string, action: string, details: string): Promise<void> => {
    await messageService.sendSystemMessage(projectId, `**${action}**: ${details}`);
  };

  const markProjectAsRead = useCallback((id: string) => {
    messageService.markAsRead(id);
    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, hasUnreadMessages: false } : p))
    );
  }, []);

  const value = useMemo(() => ({
    projects,
    currentProject,
    isLoading,
    error,
    setCurrentProject,
    createProject,
    deleteProject,
    addMember,
    removeMember,
    updateTask,
    sendProjectEvent,
    refreshProjects,
    isMember: (id) => !!projects.find(p => p.id === id),
    canManageTasks: (id) => {
      const p = projects.find(p => p.id === id);
      const m = p?.members.find(m => m.user_id === user?.id);
      return m?.status === 'owner' || m?.status === 'admin';
    },
    canCreateProjects: () => !!user && currentOrganization?.created_by === user.id,
    canRemoveMembers: () => !!user && currentOrganization?.created_by === user.id,
    markProjectAsRead,
  }), [
    projects,
    currentProject,
    isLoading,
    error,
    user,
    currentOrganization,
    markProjectAsRead, 
  ]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (projects.length === 0) {
      setCurrentProject(null);
      localStorage.removeItem('currentProjectId');
      return;
    }

    const savedId = localStorage.getItem('currentProjectId');
    if (savedId) {
      const saved = projects.find(p => p.id === savedId);
      if (saved) {
        setCurrentProject(saved);
        return;
      }
    }

    const firstProject = projects[0];
    setCurrentProject(firstProject);
    localStorage.setItem('currentProjectId', firstProject.id);
  }, [projects]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
};
