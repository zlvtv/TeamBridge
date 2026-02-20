import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useOrganization } from './OrganizationContext';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { messageService } from '../services/messageService';

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

  refreshProjects: () => Promise<Project[]>;
  isMember: (projectId: string) => boolean;
  canManageTasks: (projectId: string) => boolean;
  canCreateProjects: () => boolean;
  canRemoveMembers: () => boolean;
  markProjectAsRead: (projectId: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const getDocById = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  const docSnap = await getDocs(query(collection(db, collectionName), where('__name__', '==', id)));
  return docSnap.docs[0]?.data() || null;
};

const buildUserFromSnapshot = (userSnap: any, userId: string) => {
  if (!userSnap) {
    const fallbackUsername = `user_${userId.slice(-5)}`;
    return {
      id: userId,
      username: fallbackUsername,
      full_name: fallbackUsername,
      avatar_url: null,
    };
  }
  return {
    id: userId,
    username: userSnap.username || userSnap.email?.split('@')[0] || `user_${userId.slice(-5)}`,
    full_name: userSnap.full_name || userSnap.username || 'Пользователь',
    avatar_url: userSnap.avatar_url || null,
  };
};

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
      const q = query(
        collection(db, 'projects'),
        where('organization_id', '==', currentOrganization.id)
      );
      const snap = await getDocs(q);

      const fetchedProjects = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const projData = { id: docSnap.id, ...docSnap.data() } as Omit<Project, 'members' | 'tasks' | 'hasUnreadMessages'>;

          const membersQuery = query(
            collection(db, 'project_members'),
            where('project_id', '==', projData.id)
          );
          const membersSnap = await getDocs(membersQuery);
          const members = await Promise.all(
            membersSnap.docs.map(async (mDoc) => {
              const mData = mDoc.data();
              const userSnap = await getDocById('users', mData.user_id);
              const profile = buildUserFromSnapshot(userSnap, mData.user_id);
              return {
                id: mDoc.id,
                ...mData,
                user: profile,
              };
            })
          );

          const tasksQuery = query(
            collection(db, 'tasks'),
            where('project_id', '==', projData.id)
          );
          const tasksSnap = await getDocs(tasksQuery);
          const tasks = tasksSnap.docs.map(t => ({ id: t.id, ...t.data() })) as Task[];

          const hasUnread = await messageService.hasUnreadMessages(projData.id, user.id);

          return {
            ...projData,
            members,
            tasks,
            hasUnreadMessages: hasUnread,
          };
        })
      );

      setProjects(fetchedProjects);
      return fetchedProjects;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id, user?.id]);

  const refreshProjects = useCallback(() => fetchProjects(), [fetchProjects]);

  const createProject = async (name: string, description?: string): Promise<Project> => {
    if (!currentOrganization || !user) throw new Error('Нет доступа');

    const projRef = await addDoc(collection(db, 'projects'), {
      organization_id: currentOrganization.id,
      name,
      description: description || null,
      created_by: user.id,
      created_at: serverTimestamp(),
    });

    const memberRef = await addDoc(collection(db, 'project_members'), {
      project_id: projRef.id,
      user_id: user.id,
      role: 'owner',
      joined_at: serverTimestamp(),
    });

    const newProject: Project = {
      id: projRef.id,
      organization_id: currentOrganization.id,
      name,
      description: description || null,
      created_at: new Date().toISOString(),
      created_by: user.id,
      members: [
        {
          id: memberRef.id,
          user_id: user.id,
          role: 'owner',
          joined_at: new Date().toISOString(),
          profile: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
          },
        },
      ],
      tasks: [],
      hasUnreadMessages: false,
    };

    setProjects((prev) => [newProject, ...prev]);
    setCurrentProject(newProject);
    localStorage.setItem('currentProjectId', newProject.id);
    return newProject;
  };

  const setProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      localStorage.setItem('currentProjectId', project.id);
    }
  };

  const isMember = (projectId: string) => {
    return projects.some(p => p.id === projectId);
  };

  const canManageTasks = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const member = project?.members.find(m => m.user_id === user?.id);
    return member?.role === 'owner' || member?.role === 'moderator';
  };

  const canCreateProjects = () => {
    return !!user && (
      currentOrganization?.created_by === user.id ||
      currentOrganization?.moderators?.includes(user.id)
    );
  };

  const canRemoveMembers = () => {
    return canCreateProjects();
  };

  const markProjectAsRead = useCallback((projectId: string) => {
  messageService.markAsRead(projectId);
  setProjects(prev =>
    prev.map(project =>
      project.id === projectId
        ? { ...project, hasUnreadMessages: false }
        : project
    )
  );
}, []);

  useEffect(() => {
    if (!currentOrganization) return;

    const q = query(
      collection(db, 'projects'),
      where('organization_id', '==', currentOrganization.id)
    );

    const unsubscribe = onSnapshot(q, () => {
      fetchProjects();
    });

    return () => unsubscribe();
  }, [currentOrganization]);

  useEffect(() => {
  if (!currentProject) return;

  const updated = projects.find(p => p.id === currentProject.id);
  if (updated && updated.hasUnreadMessages !== currentProject.hasUnreadMessages) {
    setCurrentProject(updated);
  }
}, [projects, currentProject]);

  useEffect(() => {
    if (projects.length === 0) {
      setCurrentProject(null);
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
    if (firstProject) {
      setCurrentProject(firstProject);
      localStorage.setItem('currentProjectId', firstProject.id);
    }
  }, [projects]);

  const value = {
    projects,
    currentProject,
    isLoading,
    error,
    setCurrentProject: setProject,
    createProject,
    refreshProjects,
    isMember,
    canManageTasks,
    canCreateProjects,
    canRemoveMembers,
    markProjectAsRead,
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