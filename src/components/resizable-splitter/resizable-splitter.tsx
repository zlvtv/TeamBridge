import React, { useRef, useEffect } from 'react';
import { useUI } from '../../contexts/UIContext';
import styles from './resizable-splitter.module.css';

const throttle = (fn: (width: number) => void, delay: number) => {
  let inThrottle: boolean;
  return (width: number) => {
    if (!inThrottle) {
      fn(width);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), delay);
    }
  };
};

const ResizableSplitter: React.FC = () => {
  const { setChatWidth } = useUI();
  const isDraggingRef = useRef(false);
  const lastX = useRef(0); 

  const throttledSetWidth = useRef(
    throttle((width: number) => {
      setChatWidth(width);
    }, 16)
  ).current;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const mainRect = document.querySelector('.dashboard__main')?.getBoundingClientRect();
      const leftOffset = mainRect?.left || 0;
      const newWidth = e.clientX - leftOffset;

      if (Math.abs(newWidth - lastX.current) < 1) return;
      lastX.current = newWidth;

      if (newWidth >= 300 && newWidth <= 800) {
        throttledSetWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setChatWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  return (
    <div
      className={styles['resizable-splitter']}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Разделитель панелей"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleMouseDown(e as any);
      }}
    />
  );
};

export default ResizableSplitter;
