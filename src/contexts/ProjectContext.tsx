import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useOrganization } from './OrganizationContext';
import { useAuth } from './AuthContext';
import { projectService } from '../services/projectService';
import { messageService } from '../services/messageService';
import { subscribeToDoc } from '../services/firestore/firestoreService';
import type { Project, ProjectMember } from '../types/project.types';
import type { Task } from '../types/task.types';
import {
  canCreateOrganizationProjects,
  canManageProject,
  canManageProjectMembers,
} from '../utils/permissions';

const isPinnedGeneralProject = (project?: { name?: string | null }) =>
  (project?.name || '').trim().toLocaleLowerCase('ru') === 'общий';

const sortProjectsWithPinnedGeneral = <T extends { name?: string | null }>(items: T[]) =>
  [...items].sort((a, b) => {
    const aPinned = isPinnedGeneralProject(a);
    const bPinned = isPinnedGeneralProject(b);

    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  });

const getPendingProjectSelection = (): { organizationId: string; projectId: string } | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem('pendingProjectSelection');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.organizationId || !parsed?.projectId) return null;
    return {
      organizationId: String(parsed.organizationId),
      projectId: String(parsed.projectId),
    };
  } catch {
    return null;
  }
};

const clearPendingProjectSelection = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('pendingProjectSelection');
};

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

const projectContextFallback: ProjectContextType = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  setCurrentProject: () => undefined,
  createProject: async () => {
    throw new Error('Project context is unavailable');
  },
  deleteProject: async () => undefined,
  addMember: async () => undefined,
  removeMember: async () => undefined,
  updateTask: async () => undefined,
  sendProjectEvent: async () => undefined,
  refreshProjects: async () => [],
  isMember: () => false,
  canManageTasks: () => false,
  canCreateProjects: () => false,
  canRemoveMembers: () => false,
  markProjectAsRead: () => undefined,
};

const ProjectContext = createContext<ProjectContextType>(projectContextFallback);

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
      setCurrentProject(null);
      setIsLoading(false);
      return [];
    }

    try {
      setIsLoading(true);
      await projectService.syncGeneralProjectMembers(
        currentOrganization.id,
        currentOrganization.organization_members || []
      );
      const baseProjectsRaw = await projectService.getProjectsBaseByOrganization(currentOrganization.id);
      const baseProjects = baseProjectsRaw.map(proj => ({
        ...proj,
        tasks: Array.isArray(proj.tasks) ? proj.tasks : [],
      }));
      const projectsWithMembers = await Promise.all(
        baseProjects.map(async (proj) => ({
          ...proj,
          members: await projectService.getProjectMembers(proj.id),
        }))
      );
      const accessibleProjects = projectsWithMembers.filter((project) =>
        project.members.some((member) => member.user_id === user.id)
      );
      const sortedProjects = sortProjectsWithPinnedGeneral(accessibleProjects);

      setProjects(prev => {
        const unreadMap = new Map(prev.map(p => [p.id, !!p.hasUnreadMessages]));
        return sortedProjects.map(proj => ({
          ...proj,
          hasUnreadMessages: unreadMap.get(proj.id) || false,
        }));
      });

      if (sortedProjects.length === 0) {
        setCurrentProject(null);
        localStorage.removeItem('currentProjectId');
      } else {
        const savedId = localStorage.getItem('currentProjectId');
        const pendingSelection = getPendingProjectSelection();
        const pendingProject =
          pendingSelection?.organizationId === currentOrganization.id
            ? sortedProjects.find((project) => project.id === pendingSelection.projectId) || null
            : null;
        const targetProject =
          pendingProject ||
          (savedId ? sortedProjects.find(project => project.id === savedId) : null) ||
          sortedProjects[0];
        setCurrentProject(targetProject);
        localStorage.setItem('currentProjectId', targetProject.id);
        if (pendingProject) {
          clearPendingProjectSelection();
        }
      }

      setIsLoading(false);

      Promise.all(
        sortedProjects.map(async (proj) => ({
          id: proj.id,
          hasUnreadMessages: await messageService.hasUnreadProjectMessages(proj.id, user.id),
        }))
      )
        .then((unreadByProject) => {
          setProjects(prev => {
            const unreadMap = new Map(unreadByProject.map(item => [item.id, item.hasUnreadMessages]));
            return prev.map(project => ({
              ...project,
              hasUnreadMessages: unreadMap.get(project.id) ?? project.hasUnreadMessages,
            }));
          });
        })
        .catch(() => undefined);

      return sortedProjects as Project[];
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
      lead_user_id: user.id,
      roles: [],
      auto_add_org_roles: [],
      members: [{
        id: 'temp',
        project_id: projectId,
        user_id: user.id,
        status: 'owner',
        joined_at: new Date().toISOString(),
        profile: { id: user.id, username: user.username, full_name: user.full_name, avatar_url: user.avatar_url }
      }],
      tasks: [],
      hasUnreadMessages: false
    };

    setProjects(prev => sortProjectsWithPinnedGeneral([newProject, ...prev]));
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
    messageService.markProjectAsRead(id);
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
      return canManageProject(p, currentOrganization, user?.id);
    },
    canCreateProjects: () => canCreateOrganizationProjects(currentOrganization, user?.id),
    canRemoveMembers: () => canManageProjectMembers(currentProject, currentOrganization, user?.id),
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
    if (!currentOrganization?.id || !user?.id) return;

    const unsubscribe = projectService.subscribeToProjects(
      currentOrganization.id,
      (projectDocs) => {
        setProjects((prev) => {
          const docsById = new Map(projectDocs.map((project) => [project.id, project] as const));
          const nextProjects = prev
            .filter((project) => docsById.has(project.id))
            .map((project) => {
              const incoming = docsById.get(project.id);
              if (!incoming) return project;

              return {
                ...project,
                name: incoming.name ?? project.name,
                description: incoming.description ?? project.description,
                created_by: incoming.created_by ?? project.created_by,
                lead_user_id: incoming.lead_user_id ?? project.lead_user_id,
                roles: Array.isArray(incoming.roles) ? incoming.roles : project.roles,
                auto_add_org_roles: Array.isArray(incoming.auto_add_org_roles)
                  ? incoming.auto_add_org_roles
                  : project.auto_add_org_roles,
                created_at: incoming.created_at ?? project.created_at,
              };
            });

          return sortProjectsWithPinnedGeneral(nextProjects);
        });

        setCurrentProject((prev) => {
          if (!prev) return prev;
          const incoming = projectDocs.find((project) => project.id === prev.id);
          if (!incoming) return prev;

          return {
            ...prev,
            name: incoming.name ?? prev.name,
            description: incoming.description ?? prev.description,
            created_by: incoming.created_by ?? prev.created_by,
            lead_user_id: incoming.lead_user_id ?? prev.lead_user_id,
            roles: Array.isArray(incoming.roles) ? incoming.roles : prev.roles,
            auto_add_org_roles: Array.isArray(incoming.auto_add_org_roles)
              ? incoming.auto_add_org_roles
              : prev.auto_add_org_roles,
            created_at: incoming.created_at ?? prev.created_at,
          };
        });
      },
      () => {
        refreshProjects().catch(() => undefined);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [currentOrganization?.id, refreshProjects, user?.id]);

  useEffect(() => {
    if (currentOrganization) return;
    setProjects([]);
    setCurrentProject(null);
    localStorage.removeItem('currentProjectId');
  }, [currentOrganization?.id]);

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

  useEffect(() => {
    if (!currentProject?.id) return;

    const unsubscribe = subscribeToDoc(
      'projects',
      currentProject.id,
      (projectDoc) => {
        if (!projectDoc) return;

        setCurrentProject((prev) => {
          if (!prev || prev.id !== currentProject.id) return prev;
          return {
            ...prev,
            name: projectDoc.name ?? prev.name,
            description: projectDoc.description ?? prev.description,
            created_by: projectDoc.created_by ?? prev.created_by,
            lead_user_id: projectDoc.lead_user_id ?? prev.lead_user_id,
            roles: Array.isArray(projectDoc.roles) ? projectDoc.roles : prev.roles,
            auto_add_org_roles: Array.isArray(projectDoc.auto_add_org_roles)
              ? projectDoc.auto_add_org_roles
              : prev.auto_add_org_roles,
            created_at: projectDoc.created_at ?? prev.created_at,
          };
        });

        setProjects((prev) =>
          sortProjectsWithPinnedGeneral(
            prev.map((project) =>
              project.id === currentProject.id
                ? {
                    ...project,
                    name: projectDoc.name ?? project.name,
                    description: projectDoc.description ?? project.description,
                    created_by: projectDoc.created_by ?? project.created_by,
                    lead_user_id: projectDoc.lead_user_id ?? project.lead_user_id,
                    roles: Array.isArray(projectDoc.roles) ? projectDoc.roles : project.roles,
                    auto_add_org_roles: Array.isArray(projectDoc.auto_add_org_roles)
                      ? projectDoc.auto_add_org_roles
                      : project.auto_add_org_roles,
                    created_at: projectDoc.created_at ?? project.created_at,
                  }
                : project
            )
          )
        );
      },
      () => undefined
    );

    return () => {
      unsubscribe?.();
    };
  }, [currentProject?.id]);

  useEffect(() => {
    if (!currentProject?.id) return;

    let cancelled = false;
    const loadCurrentProjectTasks = async () => {
      try {
        const tasks = await projectService.getTasks(currentProject.id);
        if (cancelled) return;
        setProjects(prev =>
          prev.map(project =>
            project.id === currentProject.id
              ? { ...project, tasks: tasks as Task[] }
              : project
          )
        );
      } catch {
      }
    };

    loadCurrentProjectTasks();
    return () => {
      cancelled = true;
    };
  }, [currentProject?.id]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  return context;
};
