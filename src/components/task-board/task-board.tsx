import React from 'react';
import { useProject } from '../../contexts/ProjectContext';
import TaskColumn from '../task-column/task-column';
import styles from './task-board.module.css';

const TaskBoard: React.FC = () => {
  const { projectStatuses, currentProject } = useProject();

  if (!projectStatuses.length) {
    return (
      <div className={styles.board}>
        <div className={styles.board__empty}>
          <h3>Нет статусов</h3>
          <p>Статусы задач появятся после создания проекта</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.board} aria-label="Доска задач">
      {/* Шапка с названием проекта */}
      {currentProject && (
        <div className={styles.board__header}>
          <div className={styles.board__projectInfo}>
            <span
              className={styles.board__colorDot}
              style={{ backgroundColor: currentProject.color }}
            />
            <h2 className={styles.board__title}>{currentProject.name}</h2>
          </div>
          {currentProject.description && (
            <p className={styles.board__description}>{currentProject.description}</p>
          )}
        </div>
      )}

      <div className={styles.board__columns} role="list">
        {projectStatuses.map((status) => (
          <div key={status.id} role="listitem">
            <TaskColumn
              status={status}
              onAddTask={() => console.log(`Добавление задачи в статус: ${status.name}`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskBoard;
