import React from 'react';
import styles from './input.module.css';

type InputType = 'text' | 'email' | 'password' | 'number';
type InputSize = 'small' | 'medium';

interface InputProps {
  type?: InputType;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  error?: string;
  size?: InputSize;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  name,
  autoComplete,
  autoFocus = false,
  error,
  size = 'medium',
  ...props
}) => {
  return (
    <>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`${styles.input} ${size === 'small' ? styles['input--small'] : ''} ${
          error ? styles['input--error'] : ''
        } ${className}`.trim()}
        name={name}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {error && (
        <div id={`${name}-error`} className={styles['error-message']} role="alert">
          {error}
        </div>
      )}
    </>
  );
};

export default Input;
