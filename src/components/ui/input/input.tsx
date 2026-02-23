import React from 'react';
import styles from './input.module.css';

type InputType = 'text' | 'email' | 'password' | 'number';
type InputSize = 'small' | 'medium';
type InputVariant = 'outlined' | 'filled';

interface InputProps {
  type?: InputType;
  placeholder?: string;
  fullWidth?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  error?: string;
  size?: InputSize;
  variant?: InputVariant;
  'aria-label'?: string;
  'aria-describedby'?: string;

  textarea?: boolean;
  rows?: number;
  cols?: number;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  fullWidth = false,
  disabled = false,
  className = '',
  name,
  autoComplete,
  autoFocus = false,
  error,
  size = 'medium',
  variant = 'outlined',
  textarea = false,
  rows = 3,
  cols = 30,
  resize = 'vertical',
  ...props
}) => {
  const inputClass = [
    styles.input,
    styles[`input--${variant}`],
    size === 'small' ? styles['input--small'] : '',
    error ? styles['input--error'] : '',
    fullWidth ? styles['input--full-width'] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const textareaStyle: React.CSSProperties = {
    resize,
  };

  return (
    <div className={styles['input-group']}>
      {textarea ? (
        <textarea
          {...props}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={inputClass}
          name={name}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          rows={rows}
          cols={cols}
          style={textareaStyle}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={inputClass}
          name={name}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          {...props}
        />
      )}
      {error && (
        <div id={`${name}-error`} className={styles['error-message']} role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default Input;
