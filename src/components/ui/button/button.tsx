import React from 'react';
import styles from './button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'text';
type ButtonSize = 'small' | 'medium' | 'large';
type ButtonIconPosition = 'left' | 'right';

interface ButtonProps {
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: ButtonIconPosition;
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
  role?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'medium',
  onClick,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const buttonClass = [
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    loading ? styles['button--loading'] : '',
    fullWidth ? styles['button--full-width'] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={!loading ? onClick : undefined}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className={styles.loader}></span>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className={styles['button__icon']}>{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className={styles['button__icon']}>{icon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
