import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { projectService } from '../services/projectService';
import { Project, TaskStatus, CreateProjectData } from '../types/project.types';

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  projectStatuses: TaskStatus[];
  isLoading: boolean;
  error: string | null;
  createProject: (data: CreateProjectData) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  loadProjects: (organizationId: string) => Promise<void>;
  loadProjectStatuses: (projectId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectStatuses, setProjectStatuses] = useState<TaskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedOrgId, setLastLoadedOrgId] = useState<string | null>(null);

  const loadProjects = useCallback(async (organizationId: string) => {
    if (lastLoadedOrgId === organizationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const loadedProjects = await projectService.getOrganizationProjects(organizationId);
      setProjects(loadedProjects);
      setLastLoadedOrgId(organizationId);

      if (loadedProjects.length > 0 && !currentProject) {
        setCurrentProject(loadedProjects[0]);
      } else if (loadedProjects.length === 0) {
        setCurrentProject(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить проекты');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [lastLoadedOrgId, currentProject]);

  const loadProjectStatuses = useCallback(async (projectId: string) => {
    if (!projectId) return;

    try {
      const statuses = await projectService.getProjectStatuses(projectId);
      setProjectStatuses(statuses);
    } catch (err) {
      console.error('Ошибка загрузки статусов:', err);
      setProjectStatuses([]);
    }
  }, []);

  const createProject = async (data: CreateProjectData) => {
    try {
      setError(null);
      await projectService.createProject(data);
      await loadProjects(data.organization_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания проекта');
      throw err;
    }
  };

  useEffect(() => {
    const projectId = currentProject?.id;
    if (!projectId) return;

    const channel = supabase
      .channel(`project-changes-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        async (payload) => {
          console.log('Проект обновлён:', payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id]);

  useEffect(() => {
    const projectId = currentProject?.id;
    if (!projectId) return;

    const channel = supabase
      .channel(`status-changes-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_statuses',
          filter: `project_id=eq.${projectId}`,
        },
        () => loadProjectStatuses(projectId)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_statuses',
          filter: `project_id=eq.${projectId}`,
        },
        () => loadProjectStatuses(projectId)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_statuses',
          filter: `project_id=eq.${projectId}`,
        },
        () => loadProjectStatuses(projectId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id, loadProjectStatuses]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        projectStatuses,
        isLoading,
        error,
        createProject,
        setCurrentProject,
        loadProjects,
        loadProjectStatuses,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
};
