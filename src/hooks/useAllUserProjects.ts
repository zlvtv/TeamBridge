import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

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
  tasks: Task[];
}

export const useAllUserProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllUserProjects = async () => {
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const memberQuery = query(
          collection(db, 'organization_members'),
          where('user_id', '==', user.id)
        );
        const memberSnap = await getDocs(memberQuery);

        if (memberSnap.size === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        const orgIds = Array.from(new Set(memberSnap.docs.map(doc => doc.data().organization_id)));

        if (orgIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        const limitedOrgIds = orgIds.slice(0, 10);

        const projectsQuery = query(
          collection(db, 'projects'),
          where('organization_id', 'in', limitedOrgIds)
        );
        const projectsSnap = await getDocs(projectsQuery);

        const fetchedProjects: Project[] = [];

        for (const pDoc of projectsSnap.docs) {
          const projData = { id: pDoc.id, ...pDoc.data() } as Omit<Project, 'tasks'>;

          const tasksQuery = query(
            collection(db, 'tasks'),
            where('project_id', '==', pDoc.id)
          );
          const tasksSnap = await getDocs(tasksQuery);
          const tasks = tasksSnap.docs.map(t => ({ id: t.id, ...t.data() })) as Task[];

          fetchedProjects.push({
            ...projData,
            tasks,
          });
        }

        setProjects(fetchedProjects);
      } catch (err) {
        console.error('Ошибка загрузки всех проектов пользователя:', err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllUserProjects();
  }, [user?.id]);

  return { projects, loading };
};