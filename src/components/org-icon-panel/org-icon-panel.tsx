import React, { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import SearchModal from '../../components/modals/search-modal/search-modal';
import CreateOrganizationModal from '../../components/modals/create-organization-modal/create-organization-modal';
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
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const orgsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [maxHeight, setMaxHeight] = useState(400);

  useEffect(() => {
    const updateHeight = () => {
      const totalHeight = window.innerHeight;
      const topOffset = 20;
      const bottomOffset = 20;
      const settingsHeight = 120;
      const gap = 16;

      const availableHeight = totalHeight - topOffset - settingsHeight - gap - bottomOffset;
      const clampedHeight = Math.max(120, availableHeight);

      setMaxHeight(clampedHeight);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleSearchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setSearchAnchor(e.currentTarget);
    setIsSearchModalOpen(true);
  };

  const handleSearchClose = () => {
    setIsSearchModalOpen(false);
    setSearchAnchor(null);
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
        setLastCreatedOrgName(null);
      }
    }
  }, [organizations, lastCreatedOrgName, currentOrganization, setCurrentOrganization, setLastCreatedOrgName]);

  return (
    <>
      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => setIsCreateOrgModalOpen(false)}
      />

      {isSearchModalOpen && searchAnchor && (
        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={handleSearchClose}
          anchorEl={searchAnchor}
          organizations={organizations}
        />
      )}

      <div
        ref={containerRef}
        className={styles['org-icon-panel']}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ height: `${maxHeight}px`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
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

        <div
          ref={orgsRef}
          className={styles['org-icon-panel__orgs']}
          role="region"
          aria-label="Список организаций"
          style={{ flex: 1, overflowY: 'auto', maxHeight: '100%' }}
        >
          {organizations.map((org) => {
            const firstLetter = org.name?.charAt(0).toUpperCase() || 'O';
            return (
              <button
                key={org.id}
                className={`${styles['org-icon-panel__org-btn']} ${
                  currentOrganization?.id === org.id ? styles['org-icon-panel__org-btn--active'] : ''
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
    </>
  );
};

export default OrgIconPanel;
