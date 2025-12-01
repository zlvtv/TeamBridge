// src/contexts/ProjectContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
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

  const loadProjects = async (organizationId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const organizationProjects = await projectService.getOrganizationProjects(organizationId);
      setProjects(organizationProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectStatuses = async (projectId: string) => {
    try {
      const statuses = await projectService.getProjectStatuses(projectId);
      setProjectStatuses(statuses);
    } catch (err) {
      console.error('Failed to load project statuses:', err);
      setProjectStatuses([]);
    }
  };

  const createProject = async (data: CreateProjectData) => {
    try {
      setError(null);
      await projectService.createProject(data);
      await loadProjects(data.organization_id); // Перезагружаем список проектов
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    if (currentProject) {
      loadProjectStatuses(currentProject.id);
    } else {
      setProjectStatuses([]);
    }
  }, [currentProject]);

  const value = {
    projects,
    currentProject,
    projectStatuses,
    isLoading,
    error,
    createProject,
    setCurrentProject,
    loadProjects,
    loadProjectStatuses,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};