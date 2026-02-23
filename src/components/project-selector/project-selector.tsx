import React, { useCallback, useEffect, useState } from 'react';
import styles from './project-selector.module.css';
import '@/components/ui/modal/Modal.module.css';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';

interface Project {
  id: string;
  name: string;
  organization_id: string;
}

interface ProjectSelectorProps {
  organizationId: string;
  onClose: () => void;
  anchorEl: HTMLElement;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ organizationId, onClose, anchorEl }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const q = query(
          collection(db, 'projects'),
          where('organization_id', '==', organizationId)
        );
        const snapshot = await getDocs(q);
        const projectList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          organization_id: doc.data().organization_id
        })) as Project[];
        setProjects(projectList);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [organizationId]);

  const { organizations, setCurrentOrganization } = useOrganization();
  const handleProjectClick = useCallback((projectId: string) => {
    localStorage.setItem('currentOrgId', organizationId);
    localStorage.setItem('currentProjectId', projectId);
    
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrganization(org);
    }
    
    navigate(`/dashboard/${organizationId}/${projectId}`);
    onClose();
  }, [navigate, organizationId, onClose, organizations, setCurrentOrganization]);

  if (!anchorEl) {
    console.error('ProjectSelector: anchorEl is null or undefined');
    return null;
  }

  const rect = anchorEl.getBoundingClientRect();
  const style = {
    top: `${rect.bottom + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`
  };

  return createPortal(
    <div className={styles['project-selector']} style={style} onClick={(e) => e.stopPropagation()}>
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
              className={styles['project-selector__project']}
              onClick={() => handleProjectClick(project.id)}
            >
              {project.name}
            </button>
          ))
        ) : (
          <div className={styles['project-selector__empty']}>Нет проектов</div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ProjectSelector;
