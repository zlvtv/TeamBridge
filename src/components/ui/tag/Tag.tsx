import React from 'react';
import styles from './Tag.module.css';

interface TagProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'small' | 'medium';
  className?: string;
}

const Tag: React.FC<TagProps> = ({ 
  children, 
  variant = 'default', 
  size = 'medium', 
  className = '' 
}) => {
  return (
    <span 
      className={[
        styles['tag'],
        styles[`tag--${variant}`],
        styles[`tag--${size}`],
        className
      ].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  );
};

export default Tag;
