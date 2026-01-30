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
  disableBlur?: boolean;
  showCloseButton?: boolean;
  className?: string;
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
  className = '',
  role = 'dialog',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !disableEscape) {
          onClose();
        }
      };

      const handleFocus = (e: FocusEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          }
        }
      };

      document.addEventListener('keydown', handleEsc);
      document.addEventListener('focus', handleFocus, true);

      if (modalRef.current) {
        modalRef.current.focus();
      }

      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEsc);
        document.removeEventListener('focus', handleFocus, true);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose, disableEscape]);

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.overlay} ${(function() { try { return disableBlur; } catch(e) { return false; } })() ? styles['overlay-no-blur'] : ''}`.trim()}
      onClick={disableOutsideClick ? undefined : onClose}
      role="button"
      tabIndex={-1}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        className={`${styles.modal} ${className}`.trim()}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-label={title || 'Модальное окно'}
        tabIndex={-1}
      >
        {typeof showCloseButton !== 'undefined' && showCloseButton !== false && (
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        )}
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
