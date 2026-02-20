import React, { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import SearchModal from '../../components/modals/search-modal/search-modal';
import CreateOrganizationModal from '../../components/modals/create-organization-modal/create-organization-modal';
import CreateProjectModal from '../../components/modals/create-project-modal/create-project-modal';
import styles from './org-icon-panel.module.css';
import { useUI } from '../../contexts/UIContext';

const OrgIconPanel: React.FC = () => {
  const {
    organizations,
    currentOrganization,
    setCurrentOrganization,
  } = useOrganization();
  const { 
    isCreateModalOpen, 
    openCreateModal, 
    closeCreateModal,
    isCreateProjectOpen,
    openCreateProject,
    isCreateOrgModalOpen,
    openCreateOrgModal
  } = useUI();

  const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const orgsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);

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
    localStorage.setItem('currentOrgId', org.id);
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

  const handleCreateClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    openCreateModal();
  };

  const handleCreateProject = () => {
    closeCreateModal();
    openCreateProject();
  };

  const handleCreateOrganization = () => {
    closeCreateModal();
    openCreateOrgModal();
  };

  return (
    <>
      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => {
          openCreateModal();
        }}
      />
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={closeCreateModal}
      />

      {isSearchModalOpen && searchAnchor && (
        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={handleSearchClose}
          anchorEl={searchAnchor}
          organizations={organizations}
        />
      )}

      {isCreateModalOpen && createBtnRef.current && (
        <div
          className={styles['create-dropdown']}
          style={{
            position: 'absolute',
            top: `${createBtnRef.current.getBoundingClientRect().bottom + 8}px`,
            left: `${createBtnRef.current.getBoundingClientRect().left}px`,
            zIndex: 10000,
          }}
        >
          <button onClick={handleCreateProject} className={styles['create-dropdown-item']}>Создать проект</button>
          <button onClick={handleCreateOrganization} className={styles['create-dropdown-item']}>Создать организацию</button>
        </div>
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
          ref={createBtnRef}
          className={styles['org-icon-panel__create-org-btn']}
          onClick={handleCreateClick}
          aria-label="Создать"
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
                } ${org.hasUnreadMessages ? 'unread' : ''}`}
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
