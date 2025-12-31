// src/components/org-icon-panel/org-icon-panel.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import SearchModal from '../../components/modals/search-modal/search-modal';
import CreateOrganizationModal from '../../components/modals/create-organization-modal/create-organization-modal';
import { createPortal } from 'react-dom';
import styles from './org-icon-panel.module.css';

const OrgIconPanel: React.FC = () => {
  const {
    organizations,
    currentOrganization,
    setCurrentOrganization,
    lastCreatedOrgName,
    setLastCreatedOrgName,
  } = useOrganization();

  const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const orgsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // для контроля высоты

  const [maxHeight, setMaxHeight] = useState<number>(400);

  useEffect(() => {
    const updateHeight = () => {
      const totalHeight = window.innerHeight;
      const topOffset = 20;           // отступ сверху
      const bottomOffset = 20;        // снизу
      const settingsHeight = 120;      // высота SettingsPanel
      const gap = 16;                 // gap между панелями

      // Максимальная высота org-icon-panel
      const availableHeight = totalHeight - topOffset - settingsHeight - gap - bottomOffset;

      // Ограничиваем сверху
      const clampedHeight = Math.max(120, availableHeight);

      setMaxHeight(clampedHeight);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleSearchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setSearchAnchor(e.currentTarget);
  };

  const handleOrgClick = (org: (typeof organizations)[0]) => {
    setCurrentOrganization(org);
  };

  const handleWheel = (e: WheelEvent) => {
    if (orgsRef.current) {
      e.preventDefault();
      orgsRef.current.scrollTop += e.deltaY;
    }
  };

  const handleMouseEnter = () => {
    orgsRef.current?.addEventListener('wheel', handleWheel, { passive: false });
  };

  const handleMouseLeave = () => {
    orgsRef.current?.removeEventListener('wheel', handleWheel);
  };

  useEffect(() => {
    if (lastCreatedOrgName && organizations.length > 0) {
      const newOrg = organizations.find((org) => org.name === lastCreatedOrgName);
      if (newOrg && newOrg.id !== currentOrganization?.id) {
        setCurrentOrganization(newOrg);
        setTimeout(() => {
          const buttons = orgsRef.current?.querySelectorAll('button');
          const lastButton = buttons?.[buttons.length - 1];
          lastButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        setLastCreatedOrgName(null);
      }
    }
  }, [organizations, lastCreatedOrgName, currentOrganization, setCurrentOrganization, setLastCreatedOrgName]);

  return (
    <div
      ref={containerRef}
      className={styles['org-icon-panel']}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        height: `${maxHeight}px`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        className={styles['org-icon-panel__search-btn']}
        onClick={handleSearchClick}
        aria-label="Поиск по чатам"
      >
        🔍
      </button>

      <button
        className={styles['org-icon-panel__create-org-btn']}
        onClick={() => setIsCreateOrgModalOpen(true)}
        aria-label="Создать организацию"
      >
        +
      </button>

      {/* 🔥 Прокручиваемый контейнер с фиксированной высотой */}
      <div
        ref={orgsRef}
        className={styles['org-icon-panel__orgs']}
        role="region"
        aria-label="Список организаций"
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '100%',
        }}
      >
        {organizations.map((org) => {
          const firstLetter = org.name?.charAt(0).toUpperCase() || 'O';
          return (
            <button
              key={org.id}
              className={`${styles['org-icon-panel__org-btn']} ${
                currentOrganization?.id === org.id
                  ? styles['org-icon-panel__org-btn--active']
                  : ''
              }`}
              onClick={() => handleOrgClick(org)}
              aria-label={org.name}
              title={org.name}
            >
              {firstLetter}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OrgIconPanel;
