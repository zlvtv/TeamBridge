import React from 'react';
import styles from './task-board.module.css';

interface ColumnProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onDrop?: (e: React.DragEvent, columnId: string) => void;
  onDragOver?: (e: React.DragEvent, columnId: string) => void;
}

const Column: React.FC<ColumnProps> = ({ id, title, children, onDrop, onDragOver }) => {
  return (
    <div
      className={styles.column}
      onDrop={(e) => onDrop?.(e, id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e, id);
      }}
    >
      <div className={styles.columnHeader}>
        <h3>{title}</h3>
      </div>
      <div className={styles.taskList}>
        {children}
      </div>
    </div>
  );
};

export default Column;