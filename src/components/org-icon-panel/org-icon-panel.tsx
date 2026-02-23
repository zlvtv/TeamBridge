import React, { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import SearchModal from '../../components/modals/search-modal/search-modal';
import CreateOrganizationModal from '../../components/modals/create-organization-modal/create-organization-modal';
import CreateProjectModal from '../../components/modals/create-project-modal/create-project-modal';
import CreateTaskModal from '../../components/modals/create-task-modal/create-task-modal';
import styles from './org-icon-panel.module.css';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import ProjectSelector from '../../components/project-selector/project-selector';

const OrgIconPanel: React.FC = () => {
  const {
    organizations: rawOrganizations,
    currentOrganization,
  } = useOrganization();

  const {
    isModalOpen,
    openModal,
    closeModal,
  } = useUI();

  const organizations = rawOrganizations.slice().sort((a, b) => {
  // 1. Непрочитанные — вверх
  if (a.hasUnreadMessages !== b.hasUnreadMessages) {
    return a.hasUnreadMessages ? -1 : 1;
  }

  // 2. По updated_at (уже Date)
  const timeA = a.updated_at?.getTime() ?? 0;
  const timeB = b.updated_at?.getTime() ?? 0;

  if (timeA !== timeB) {
    return timeB - timeA;
  }

  // 3. Резерв — по имени
  return a.name.localeCompare(b.name, 'ru');
});

  const { currentProject } = useProject();
  const { refreshProjects } = useProject(); 

  const { user: currentUser } = useAuth();

  const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const orgsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [availableHeight, setAvailableHeight] = useState<number>(400);

  useEffect(() => {
    const panelContainer = containerRef.current?.parentElement;
    if (!panelContainer) return;

    const updateHeight = () => {
      const rect = panelContainer.getBoundingClientRect();
      setAvailableHeight(rect.height);
    };

    const observer = new ResizeObserver(updateHeight);
    observer.observe(panelContainer);

    updateHeight();

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isModalOpen('create') &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        closeModal('create');
      }
    };

    document.addEventListener('mouseup', handleClickOutside);
    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
    };
  }, [isModalOpen, closeModal]);

  useEffect(() => {
  console.log('Sorted orgs:', organizations.map(o => ({
    name: o.name,
    updated_at: o.updated_at,
    hasUnreadMessages: o.hasUnreadMessages,
    dateValue: o.updated_at?.toDate 
      ? o.updated_at.toDate().toISOString() 
      : o.updated_at?.toISOString?.() || 'invalid'
  })));
}, [organizations]);
 
  const handleSearchClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setSearchAnchor(e.currentTarget);
    setIsSearchModalOpen(true);
  };

  const handleSearchClose = () => {
    setIsSearchModalOpen(false);
    setSearchAnchor(null);
  };

  const [projectSelectorAnchor, setProjectSelectorAnchor] = useState<HTMLElement | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const handleProjectSelectorClose = () => {
    setProjectSelectorAnchor(null);
    setSelectedOrgId(null);
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
    if (isModalOpen('create')) {
      closeModal('create');
    } else {
      openModal('create');
    }
  };

  const handleCreateProject = () => {
    closeModal('create');
    openModal('createProject');
  };

  const handleCreateOrganization = () => {
    closeModal('create');
    openModal('createOrg');
  };

  const handleCreateTask = () => {
    closeModal('create');
    openModal('createTask');
  };

  const isCreateModalOpen = isModalOpen('create');
  const isCreateProjectOpen = isModalOpen('createProject');
  const isCreateOrgModalOpen = isModalOpen('createOrg');
  const isCreateTaskOpen = isModalOpen('createTask');

  return (
    <>
      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => closeModal('createOrg')}
      />
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => closeModal('createProject')}
        refreshProjects={refreshProjects}
      />
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => closeModal('createTask')}
        refreshProjects={refreshProjects} 
      />

      {isSearchModalOpen && (
        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={handleSearchClose}
        />
      )}

      {isCreateModalOpen && (
        <div
          ref={dropdownRef}
          className={styles['create-dropdown']}
          style={{
            position: 'absolute',
            top: `${document.querySelector('button[aria-label="Создать"]')?.getBoundingClientRect().top || 0}px`,
            left: `${(document.querySelector('button[aria-label="Создать"]')?.getBoundingClientRect().left || 0) + 8}px`,
            zIndex: 10000,
          }}
        >
          <button onClick={handleCreateOrganization} className={styles['create-dropdown-item']}>
            Создать организацию
          </button>
          <button onClick={handleCreateProject} className={styles['create-dropdown-item']}>
            Создать проект
          </button>
          <button onClick={handleCreateTask} className={styles['create-dropdown-item']}>
            Создать задачу
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={styles['org-icon-panel']}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ height: availableHeight }}
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
          onClick={handleCreateClick}
          aria-label="Создать"
        >
          +
        </button>

        <div ref={orgsRef} className={styles['org-icon-panel__orgs']}>
          {organizations.map((org) => {
            const firstLetter = org.name?.charAt(0).toUpperCase() || 'O';
            return (
              <button
                key={org.id}
                className={`${styles['org-icon-panel__org-btn']} ${
                  currentOrganization?.id === org.id
                    ? styles['org-icon-panel__org-btn--active']
                    : ''
                } ${org.hasUnreadMessages ? 'unread' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setProjectSelectorAnchor(e.currentTarget);
                  setSelectedOrgId(org.id);
                }}
                aria-label={org.name}
                title={org.name}
              >
                {firstLetter}
              </button>
            );
          })}
        </div>
      </div>

      {projectSelectorAnchor && selectedOrgId && (
        <ProjectSelector
          organizationId={selectedOrgId}
          onClose={handleProjectSelectorClose}
          anchorEl={projectSelectorAnchor}
        />
      )}
    </>
  );
};

export default OrgIconPanel;
