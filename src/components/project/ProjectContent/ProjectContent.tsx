// src/components/project/ProjectContent/ProjectContent.tsx
import React, { useState } from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import Button from '../../ui/Button/Button';
import TaskBoard from '../../task/TaskBoard/TaskBoard';
import ProjectChat from '../../chat/ProjectChat/ProjectChat';
import styles from './ProjectContent.module.css';

const ProjectContent: React.FC = () => {
  const { currentProject, projectStatuses } = useProject();
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat'>('tasks');

  if (!currentProject) {
    return null;
  }

  return (
    <div className={styles.content}>
      <div className={styles.content__header}>
        <div className={styles.content__headerInfo}>
          <div className={styles.content__titleRow}>
            <div 
              className={styles.content__colorDot}
              style={{ backgroundColor: currentProject.color }}
            />
            <h1 className={styles.content__title}>{currentProject.name}</h1>
          </div>
          {currentProject.description && (
            <p className={styles.content__description}>
              {currentProject.description}
            </p>
          )}
        </div>
        
        <div className={styles.content__tabs}>
          <button
            className={`${styles.tab} ${
              activeTab === 'tasks' ? styles['tab--active'] : ''
            }`}
            onClick={() => setActiveTab('tasks')}
          >
            <span className={styles.tab__icon}>✅</span>
            Tasks
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === 'chat' ? styles['tab--active'] : ''
            }`}
            onClick={() => setActiveTab('chat')}
          >
            <span className={styles.tab__icon}>💬</span>
            Chat
          </button>
        </div>
      </div>

      <div className={styles.content__body}>
        {activeTab === 'tasks' ? (
          <TaskBoard />
        ) : (
          <ProjectChat />
        )}
      </div>
    </div>
  );
};

export default ProjectContent;