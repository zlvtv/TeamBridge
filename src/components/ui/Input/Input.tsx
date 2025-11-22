import React from 'react';
import styles from './Input.module.css';

interface InputProps {
  type: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  autoComplete?: string;
}

/**
 * Компонент текстового поля ввода с базовой стилизацией и доступностью
 */
const Input: React.FC<InputProps> = ({
  type,
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  name,
  autoComplete,
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className={`${styles.input} ${className}`}
      name={name}
      autoComplete={autoComplete}
    />
  );
};

export default Input;