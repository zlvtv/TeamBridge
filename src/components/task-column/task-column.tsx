import React from 'react';
import { TaskStatus } from '../../types/project.types';
import styles from './task-column.module.css';

interface TaskColumnProps {
  status: TaskStatus;
  onAddTask?: () => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({ status, onAddTask }) => {
  return (
    <div className={styles.column}>
      <header className={styles.column__header}>
        <div className={styles.column__title}>
          <span
            className={styles.column__colorDot}
            style={{ backgroundColor: status.color }}
            aria-label={`Color for ${status.name}`}
          />
          <span>{status.name}</span>
          <span className={styles.column__count}>0</span>
        </div>
      </header>

      <div className={styles.column__content}>
        <div className={styles.column__empty}>
          <p>Нет задач в «{status.name}»</p>
          <button
            className={styles.column__addButton}
            onClick={onAddTask}
            aria-label={`Добавить задачу в ${status.name}`}
          >
            + Добавить
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskColumn;