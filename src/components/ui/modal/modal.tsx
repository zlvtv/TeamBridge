import React, { useEffect, useRef } from 'react';
import styles from './modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  title?: string;
  disableEscape?: boolean;
  disableOutsideClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
  overlayClassName?: string;
  role?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = 500,
  title,
  disableEscape = false,
  disableOutsideClick = false,
  showCloseButton = true,
  className = '',
  overlayClassName = '',
  role = 'dialog',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscape) {
        onClose();
      }
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !disableOutsideClick) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleOutsideClick);

    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, disableEscape, disableOutsideClick]);

  if (!isOpen) return null;

  return (
    <div
      className={`${styles['modal__overlay']} ${overlayClassName}`}
      onClick={disableOutsideClick ? undefined : onClose}
      role="button"
      tabIndex={-1}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        className={`${styles.modal} ${className}`}
        style={{ '--modal-width': `${maxWidth}px` } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-label={title || 'Модальное окно'}
        tabIndex={-1}
      >
        {showCloseButton && (
          <button
            className={styles['modal__close']}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        )}
        {title && <h2 className={styles['modal__title']}>{title}</h2>}
        <div className={styles['modal__content']}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
