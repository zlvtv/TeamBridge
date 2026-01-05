import React from 'react';
import styles from './button.module.css';

type ButtonVariant = 'primary' | 'secondary';
type ButtonType = 'button' | 'submit' | 'reset';

interface ButtonProps {
  children: React.ReactNode;
  type?: ButtonType;
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  role?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  type = 'button',
  variant = 'primary',
  onClick,
  disabled = false,
  className = '',
  ...props
}) => {
  const buttonClass = `${styles.button} ${styles[`button--${variant}`]} ${className}`.trim();

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || props['aria-disabled']}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
