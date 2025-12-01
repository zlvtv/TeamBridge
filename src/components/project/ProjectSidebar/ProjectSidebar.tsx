// src/components/project/ProjectSidebar/ProjectSidebar.tsx
import React from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import Button from '../../ui/Button/Button';
import styles from './ProjectSidebar.module.css';

interface ProjectSidebarProps {
  onOpenCreateProjectModal: () => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  onOpenCreateProjectModal,
}) => {
  const { projects, currentProject, setCurrentProject, isLoading } = useProject();

  if (isLoading) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.sidebar__loading}>Loading projects...</div>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebar__header}>
        <h2 className={styles.sidebar__title}>Projects</h2>
        <Button
          variant="primary"
          onClick={onOpenCreateProjectModal}
          className={styles.sidebar__button}
          size="small"
        >
          New
        </Button>
      </div>

      <div className={styles.sidebar__content}>
        {projects.length === 0 ? (
          <div className={styles.sidebar__empty}>
            <p>No projects yet</p>
            <p className={styles.sidebar__emptyHint}>
              Create your first project
            </p>
          </div>
        ) : (
          <div className={styles.projectList}>
            {projects.map((project) => (
              <div
                key={project.id}
                className={`${styles.projectItem} ${
                  currentProject?.id === project.id ? styles['projectItem--active'] : ''
                }`}
                onClick={() => setCurrentProject(project)}
              >
                <div 
                  className={styles.projectItem__color}
                  style={{ backgroundColor: project.color }}
                />
                <div className={styles.projectItem__info}>
                  <div className={styles.projectItem__name}>
                    {project.name}
                  </div>
                  {project.description && (
                    <div className={styles.projectItem__description}>
                      {project.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSidebar;