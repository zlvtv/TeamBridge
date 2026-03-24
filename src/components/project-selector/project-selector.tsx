import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './project-selector.module.css';
import '@/components/ui/modal/modal.module.css';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { messageService } from '../../services/messageService';
import { useAuth } from '../../contexts/AuthContext';

interface Project {
  id: string;
  name: string;
  organization_id: string;
}

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

const projectCache = new Map<string, Project[]>();

interface ProjectSelectorProps {
  organizationId: string;
  onClose: () => void;
  anchorEl: HTMLElement;
  onProjectSelected?: () => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ organizationId, onClose, anchorEl, onProjectSelected }) => {
  const navigate = useNavigate();
  const { setCurrentProject } = useProject();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, boolean>>({});
  const selectorRef = useRef<HTMLDivElement>(null);
  const isMobileLayout = typeof window !== 'undefined' ? window.innerWidth <= 760 : false;

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${organizationId}:${user?.id || 'anonymous'}`;
    const cached = projectCache.get(cacheKey);
    if (cached) {
      setProjects(cached);
      setLoading(false);
      return;
    }

    const loadProjects = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'projects'), where('organization_id', '==', organizationId));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          name: String(docItem.data().name || 'Проект'),
          organization_id: String(docItem.data().organization_id || organizationId),
        }));
        const accessibleProjectIds = user?.id
          ? new Set(
              (
                await getDocs(
                  query(collection(db, 'project_members'), where('user_id', '==', user.id))
                )
              ).docs
                .map((docItem) => String(docItem.data().project_id || ''))
                .filter(Boolean)
            )
          : new Set<string>();
        const accessibleItems = user?.id
          ? items.filter((item) => accessibleProjectIds.has(item.id))
          : items;
        const sortedItems = sortProjectsWithPinnedGeneral(accessibleItems);
        projectCache.set(cacheKey, sortedItems);
        if (!cancelled) {
          setProjects(sortedItems);
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [organizationId, user?.id]);

  useEffect(() => {
    if (!user?.id || projects.length === 0) return;
    Promise.all(
      projects.map(async (project) => ({
        id: project.id,
        unread: await messageService.hasUnreadProjectMessages(project.id, user.id),
      }))
    )
      .then((items) => {
        const next: Record<string, boolean> = {};
        items.forEach(item => {
          next[item.id] = item.unread;
        });
        setUnreadMap(next);
      })
      .catch(() => undefined);
  }, [projects, user?.id]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (selectorRef.current && !selectorRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose]);

  const { organizations, setCurrentOrganization } = useOrganization();
  const handleProjectClick = useCallback((projectId: string) => {
    localStorage.setItem('currentOrgId', organizationId);
    localStorage.setItem('currentProjectId', projectId);
    sessionStorage.setItem(
      'pendingProjectSelection',
      JSON.stringify({
        organizationId,
        projectId,
      })
    );
    
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrganization(org);
    }

    const project = projects.find(item => item.id === projectId);
    if (project) {
      setCurrentProject({
        ...project,
        description: null,
        created_at: new Date().toISOString(),
        created_by: '',
        members: [],
        tasks: [],
      } as any);
    }

    onProjectSelected?.();
    navigate('/dashboard');
    onClose();
  }, [navigate, onProjectSelected, organizationId, onClose, organizations, setCurrentOrganization, projects, setCurrentProject]);

  if (!anchorEl) {
    console.error('ProjectSelector: anchorEl is null or undefined');
    return null;
  }

  return createPortal(
    <div
      className={styles['project-selector__overlay']}
      onClick={onClose}
    >
      <div
        ref={selectorRef}
        className={`${styles['project-selector']} ${isMobileLayout ? styles['project-selector--mobile'] : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles['project-selector__header']}>
          <h3>Выберите проект</h3>
          <button 
            className={styles['project-selector__close']} 
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className={styles['project-selector__list']}>
          {loading ? (
            <div className={styles['project-selector__empty']}>Загрузка...</div>
          ) : projects.length > 0 ? (
            projects.map(project => (
              <button
                key={project.id}
                className={`${styles['project-selector__project']} ${unreadMap[project.id] ? styles['project-selector__project--unread'] : ''}`}
                onClick={() => handleProjectClick(project.id)}
              >
                {project.name}
              </button>
            ))
          ) : (
            <div className={styles['project-selector__empty']}>Нет проектов</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProjectSelector;
