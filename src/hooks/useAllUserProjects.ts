import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCollection } from '../services/firestore/firestoreService';
import { projectService } from '../services/projectService';

const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

export const useAllUserProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const orgMembers = await getCollection('organization_members', {
          whereClauses: [{ field: 'user_id', operator: '==', value: user.id }]
        });

        const orgIds = [...new Set(orgMembers.map(m => m.organization_id))].slice(0, 10);
        const projectMemberships = await getCollection('project_members', {
          whereClauses: [{ field: 'user_id', operator: '==', value: user.id }]
        });

        const accessibleProjectIds = [...new Set(projectMemberships.map((member) => member.project_id))];

        if (orgIds.length === 0 || accessibleProjectIds.length === 0) {
          setProjects([]);
          return;
        }

        const orgChunks = chunk(orgIds, 10);
        const projectCollections = await Promise.all(
          orgChunks.map((organizationIds) =>
            getCollection('projects', {
              whereClauses: [{ field: 'organization_id', operator: 'in', value: organizationIds }]
            }).catch(() => [])
          )
        );

        const accessibleProjectIdSet = new Set(accessibleProjectIds);
        const accessibleProjects = projectCollections
          .flat()
          .filter((project: any) => accessibleProjectIdSet.has(project.id));

        const projectsWithTasks = await Promise.all(accessibleProjects.map(async (p: any) => {
          const tasks = await getCollection('tasks', {
            whereClauses: [{ field: 'project_id', operator: '==', value: p.id }]
          });
          const members = await projectService.getProjectMembers(p.id);
          const currentMembership = projectMemberships.find((member) => member.project_id === p.id);
          return {
            ...p,
            tasks,
            members,
            current_user_status: currentMembership?.status || 'member',
          };
        }));

        setProjects(projectsWithTasks);
      } catch (err) {
        console.error('Error fetching user projects:', err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }, [user?.id]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { projects, loading, refresh: fetchAll };
};
