import React from 'react';
import styles from './LoadingState.module.css';

const LoadingState: React.FC<{ message?: string }> = ({ message = 'Загрузка...' }) => {
  return (
    <div className={styles.container}>
      <div className={styles.spinner}></div>
      <div className={styles.message}>{message}</div>
    </div>
  );
};

export default LoadingState;
