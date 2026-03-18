import React, { useRef, useEffect } from 'react';
import { useUI } from '../../contexts/UIContext';
import styles from './resizable-splitter.module.css';

const ResizableSplitter: React.FC = () => {
  const { chatWidth, setChatWidth } = useUI();
  const splitterRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const containerLeftRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);

  useEffect(() => {
    const flushWidth = () => {
      frameRef.current = null;
      if (pendingWidthRef.current !== null) {
        setChatWidth(pendingWidthRef.current);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const newWidth = e.clientX - containerLeftRef.current;
      const clampedWidth = Math.max(300, Math.min(newWidth, 800));
      pendingWidthRef.current = clampedWidth;

      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(flushWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';

        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        if (pendingWidthRef.current !== null) {
          setChatWidth(pendingWidthRef.current);
          pendingWidthRef.current = null;
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [setChatWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const container = splitterRef.current?.parentElement;
    const rect = container?.getBoundingClientRect();
    containerLeftRef.current = rect?.left || 0;
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
      role="separator"
      aria-orientation="vertical"
      aria-label="Разделитель панелей"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setChatWidth(chatWidth - 16);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setChatWidth(chatWidth + 16);
        }
      }}
    />
  );
};

export default ResizableSplitter;
