import React from 'react';
import { useProject } from '../../contexts/ProjectContext';
import styles from './project-chat.module.css';

const ProjectChat: React.FC = () => {
  const { currentProject } = useProject();

  if (!currentProject) {
    return (
      <div className={styles.chat} aria-label="Чат">
        <div className={styles.chat__empty}>
          <h4>Нет активного проекта</h4>
          <p>Выберите проект или создайте новый, чтобы начать обсуждение.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chat} role="region" aria-label={`Чат проекта ${currentProject.name}`}>
      <header className={styles.chat__header}>
        <h3>Проект: {currentProject.name}</h3>
        {currentProject.description && (
          <p className={styles.chat__subtitle}>{currentProject.description}</p>
        )}
      </header>

      <div className={styles.chat__empty}>
        <div className={styles.chat__emptyIcon}>💬</div>
        <h4>Начать беседу</h4>
        <p>Сообщения видны всем участникам проекта. Можно ссылаться на задачи — #123.</p>

        <div className={styles.chat__features}>
          <div className={styles.feature}>
            <span className={styles.feature__icon}>🔗</span>
            <span>Ссылки на задачи</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.feature__icon}>🤖</span>
            <span>Уведомления об изменениях</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.feature__icon}>📁</span>
            <span>Обмен файлами</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectChat;
