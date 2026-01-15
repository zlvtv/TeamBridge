import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useOrganization } from './OrganizationContext';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Типы
interface ProjectMember {
  id: string;
  user_id: string;
  role: 'member' | 'moderator' | 'owner';
  joined_at: string;
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface TaskAssignee {
  task_id: string;
  user_id: string;
  assigned_by: string;
  assigned_at: string;
}

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string;
  due_date: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  source_message_id: string | null;
  assignees: TaskAssignee[];
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
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string, description?: string) => Promise<Project>;
  refreshProjects: () => Promise<Project[]>;
  isMember: (projectId: string) => boolean;
  canManageTasks: (projectId: string) => boolean;
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
    if (!currentOrganization) return [];

    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          organization_id,
          name,
          description,
          created_at,
          created_by,
          project_members (
            user_id,
            role,
            joined_at,
            profiles (
              id,
              username,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((p: any) => ({
        ...p,
        members: p.project_members.map((m: any) => ({
          ...m,
          profile: m.profiles,
        })),
        tasks: [],
      }));

      setProjects(formatted);

      // Восстановить текущий проект
      const savedId = localStorage.getItem('currentProjectId');
      const savedProject = formatted.find(p => p.id === savedId) || formatted[0] || null;
      setCurrentProject(savedProject);

      return formatted;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки проектов');
      return [];
    }
  }, [currentOrganization?.id]);

  const refreshProjects = useCallback(async () => {
    const projects = await fetchProjects();
    return projects;
  }, [fetchProjects]);

  const createProject = async (name: string, description?: string): Promise<Project> => {
    if (!currentOrganization || !user) throw new Error('Нет доступа');

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description: description || null,
        organization_id: currentOrganization.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('project_members')
      .insert({
        project_id: data.id,
        user_id: user.id,
        role: 'owner',
      });

    await refreshProjects();
    return data;
  };

  const isMember = (projectId: string) => {
    return projects.some(p => p.id === projectId);
  };

  const canManageTasks = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const member = project?.members.find(m => m.user_id === user?.id);
    return member?.role === 'owner' || member?.role === 'moderator';
  };

  useEffect(() => {
    if (currentOrganization) {
      setIsLoading(true);
      fetchProjects().finally(() => setIsLoading(false));
    } else {
      setProjects([]);
      setCurrentProject(null);
      setIsLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('currentProjectId', currentProject.id);
    }
  }, [currentProject]);

  const value = {
    projects,
    currentProject,
    isLoading,
    error,
    setCurrentProject,
    createProject,
    refreshProjects,
    isMember,
    canManageTasks,
  };

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
