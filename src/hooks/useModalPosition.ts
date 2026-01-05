// src/hooks/useModalPosition.ts
import { useState, useEffect, useRef } from 'react';

interface UseModalPositionProps {
  referenceRef: React.RefObject<HTMLElement>;
  modalWidth?: number;
}

export const useModalPosition = ({ referenceRef, modalWidth = 320 }: UseModalPositionProps) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const button = referenceRef.current;
      if (!button) return;

      if (!button.contains(e.target as Node)) {
        setIsVisible(false);
        return;
      }

      const rect = button.getBoundingClientRect();
      const scrollTop = window.pageYOffset;
      const scrollLeft = window.pageXOffset;

      let left = rect.left + scrollLeft;
      if (left + modalWidth > window.innerWidth) {
        left = window.innerWidth - modalWidth - 20;
      }
      if (left < 20) {
        left = 20;
      }

      setPosition({
        top: rect.bottom + 8 + scrollTop,
        left,
      });

      setIsVisible(true);
    };

    const button = referenceRef.current;
    if (button) {
      button.addEventListener('click', handleClick as any);
    }

    return () => {
      if (button) {
        button.removeEventListener('click', handleClick as any);
      }
    };
  }, [referenceRef, modalWidth]);

  return { position, isVisible, setIsVisible };
};
