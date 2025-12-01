// src/components/task/TaskBoard/TaskBoard.tsx
import React from 'react';
import { useProject } from '../../../contexts/ProjectContext';
import TaskColumn from '../TaskColumn/TaskColumn';
import styles from './TaskBoard.module.css';

const TaskBoard: React.FC = () => {
  const { projectStatuses } = useProject();

  if (projectStatuses.length === 0) {
    return (
      <div className={styles.board}>
        <div className={styles.board__empty}>
          <h3>No statuses found</h3>
          <p>Task statuses will appear here once created</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.board__columns}>
        {projectStatuses.map((status) => (
          <TaskColumn
            key={status.id}
            status={status}
          />
        ))}
      </div>
    </div>
  );
};

export default TaskBoard;