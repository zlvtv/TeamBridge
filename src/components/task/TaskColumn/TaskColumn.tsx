// src/components/task/TaskColumn/TaskColumn.tsx
import React from 'react';
import { TaskStatus } from '../../../types/project.types';
import styles from './TaskColumn.module.css';

interface TaskColumnProps {
  status: TaskStatus;
}

const TaskColumn: React.FC<TaskColumnProps> = ({ status }) => {
  return (
    <div className={styles.column}>
      <div className={styles.column__header}>
        <div className={styles.column__title}>
          <span 
            className={styles.column__colorDot}
            style={{ backgroundColor: status.color }}
          />
          <span>{status.name}</span>
          <span className={styles.column__count}>0</span>
        </div>
      </div>
      
      <div className={styles.column__content}>
        <div className={styles.column__empty}>
          <p>No tasks in {status.name}</p>
          <button className={styles.column__addButton}>
            + Add Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskColumn;