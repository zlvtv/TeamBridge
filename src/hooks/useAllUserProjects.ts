import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCollection } from '../services/firestore/firestoreService';

export const useAllUserProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const members = await getCollection('organization_members', {
          whereClauses: [{ field: 'user_id', operator: '==', value: user.id }]
        });

        const orgIds = [...new Set(members.map(m => m.organization_id))].slice(0, 10);
        if (orgIds.length === 0) {
          setProjects([]);
          return;
        }

        const projs = await getCollection('projects', {
          whereClauses: [{ field: 'organization_id', operator: 'in', value: orgIds }]
        });

        const projectsWithTasks = await Promise.all(projs.map(async (p: any) => {
          const tasks = await getCollection('tasks', {
            whereClauses: [{ field: 'project_id', operator: '==', value: p.id }]
          });
          return { ...p, tasks };
        }));

        setProjects(projectsWithTasks);
      } catch (err) {
        console.error('Error fetching user projects:', err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user?.id]);

  return { projects, loading };
};
