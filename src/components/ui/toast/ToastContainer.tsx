import React from 'react';
import Toast from './Toast';
import styles from './ToastContainer.module.css';
import { useNotifications } from '../../../contexts/NotificationContext';

const ToastContainer: React.FC = () => {
  const { notifications, markAsRead } = useNotifications();

  const activeToasts = notifications.filter(
    (n) => !n.read && (n.type === 'success' || n.type === 'error')
  );

  return (
    <div className={styles.container}>
      {activeToasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => markAsRead(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
