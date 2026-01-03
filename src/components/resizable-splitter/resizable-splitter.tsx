import React, { useRef, useEffect } from 'react';
import { useUI } from '../../contexts/UIContext';
import styles from './resizable-splitter.module.css';

const ResizableSplitter: React.FC = () => {
  const { chatWidth, setChatWidth } = useUI();
  const splitterRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = e.clientX - 100; // 100 = отступ слева (org-icon-panel + отступ)
      if (newWidth >= 300 && newWidth <= 800) {
        setChatWidth(newWidth);
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
      ref={splitterRef}
      className={styles['resizable-splitter']}
      onMouseDown={handleMouseDown}
      title="Перетащите, чтобы изменить ширину"
    />
  );
};

export default ResizableSplitter;
