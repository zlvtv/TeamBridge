import React from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      key={id}
      className={`${styles.toast} ${styles[type]}`}
      role="alert"
      aria-live="polite"
    >
      {message}
      <button
        className={styles['toast__close']}
        onClick={onClose}
        aria-label="Закрыть"
      >
        ✕
      </button>
    </div>
  );
};

export default Toast;
