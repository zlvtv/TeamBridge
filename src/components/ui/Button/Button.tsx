import React from 'react';
import styles from './Button.module.css'; // Импорт стилей как объекта

// Описываем интерфейс пропсов для кнопки
interface ButtonProps {
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  children,
  type = 'button',
  variant = 'primary',
  onClick,
}) => {
  // Формируем className по БЭМ. `styles.button` - это блок.
  // `styles[`button--${variant}`]` - это модификатор.
  const buttonClass = `${styles.button} ${styles[`button--${variant}`]}`;

  return (
    <button type={type} className={buttonClass} onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;