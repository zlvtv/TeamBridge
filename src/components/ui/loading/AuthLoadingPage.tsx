import React from 'react';
import styles from './AuthLoadingPage.module.css';

const AuthLoadingPage: React.FC<{ message?: string }> = ({ message = 'Обработка запроса...' }) => {
  return (
    <div className={styles['auth-loading']}>
      <div className={styles['auth-loading__card']}>
        <div className={styles['auth-loading__spinner']}></div>
        <p className={styles['auth-loading__message']}>{message}</p>
      </div>
    </div>
  );
};

export default AuthLoadingPage;
