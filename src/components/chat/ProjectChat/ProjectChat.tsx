// src/components/chat/ProjectChat/ProjectChat.tsx
import React from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import styles from './ProjectChat.module.css';

const ProjectChat: React.FC = () => {
  const { currentProject } = useProject();

  if (!currentProject) return null;

  return (
    <div className={styles.chat}>
      <div className={styles.chat__header}>
        <h3>Project Chat</h3>
        <p className={styles.chat__subtitle}>
          Discuss {currentProject.name} with your team. 
          Messages can be linked to specific tasks.
        </p>
      </div>
      
      <div className={styles.chat__empty}>
        <div className={styles.chat__emptyIcon}>💬</div>
        <h4>Start a conversation</h4>
        <p>Messages sent here will appear in real-time for all project members.</p>
        <div className={styles.chat__features}>
          <div className={styles.feature}>
            <span className={styles.feature__icon}>🔗</span>
            <span>Link messages to tasks</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.feature__icon}>🤖</span>
            <span>Automatic status notifications</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.feature__icon}>📁</span>
            <span>Share files</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectChat;