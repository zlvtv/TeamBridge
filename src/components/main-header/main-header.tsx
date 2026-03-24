import { useEffect, useRef, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import OrgInfoModal from '../../components/modals/org-info-modal/org-info-modal';
import EditOrganizationModal from '../../components/modals/edit-organization-modal/edit-organization-modal';
import styles from './main-header.module.css';
import type { Organization } from '../../types/organization.types';

const MainHeader: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const { isModalOpen, openModal, closeModal } = useUI();

  const isOrgInfoOpen = isModalOpen('orgInfo');
  const openOrgInfo = () => openModal('orgInfo');
  const closeOrgInfo = () => closeModal('orgInfo');

  const orgInfoAnchorRef = useRef<HTMLElement | null>(null);
  const [titleEl, setTitleEl] = useState<HTMLHeadingElement | null>(null);
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);


  const handleInfoClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isOrgInfoOpen) {
      closeOrgInfo();
      orgInfoAnchorRef.current = null;
    } else {
      orgInfoAnchorRef.current = e.currentTarget;
      openOrgInfo(); 
    }
  };

  const handleTitleClick = (e: React.MouseEvent<HTMLHeadingElement>) => {
    const target = e.currentTarget;

    if (isOrgInfoOpen) {
      closeOrgInfo();
      setTitleEl(null);
      return;
    }

    orgInfoAnchorRef.current = target;
    setTitleEl(target);
    openOrgInfo();
  };

  useEffect(() => {
    const handleOpenEditor = () => {
      if (!currentOrganization) return;
      closeOrgInfo();
      setEditingOrganization(currentOrganization);
      setIsEditOrgModalOpen(true);
    };

    window.addEventListener('open-edit-organization', handleOpenEditor);
    return () => window.removeEventListener('open-edit-organization', handleOpenEditor);
  }, [closeOrgInfo, currentOrganization]);

  useEffect(() => {
    if (isEditOrgModalOpen && currentOrganization) {
      setEditingOrganization(currentOrganization);
    }
  }, [currentOrganization, isEditOrgModalOpen]);

  useEffect(() => {
    const handleOpenOrgInfo = () => {
      if (!currentOrganization) return;
      orgInfoAnchorRef.current = titleEl;
      openOrgInfo();
    };

    window.addEventListener('open-org-info', handleOpenOrgInfo);
    return () => window.removeEventListener('open-org-info', handleOpenOrgInfo);
  }, [currentOrganization, openOrgInfo, titleEl]);

  return (
    <>
      <header className={styles['main-header']}>
        <h1
          ref={setTitleEl}
          className={styles['main-header__title']}
          onClick={handleTitleClick}
        >
          {currentOrganization ? currentOrganization.name : 'Выберите организацию'}
        </h1>

        {currentOrganization && (
          <button
            ref={(el) => {
              if (el) {
                orgInfoAnchorRef.current = el;
              }
            }}
            className={styles['main-header__info-btn']}
            onClick={handleInfoClick}
            aria-label="Информация об организации"
          >
            ℹ️
          </button>
        )}
      </header>

      {isOrgInfoOpen && orgInfoAnchorRef.current && (
        <OrgInfoModal
          anchorEl={orgInfoAnchorRef.current}
          onClose={closeOrgInfo}
        />
      )}

      {editingOrganization && isEditOrgModalOpen && (
        <EditOrganizationModal
          isOpen={isEditOrgModalOpen}
          onClose={() => {
            setIsEditOrgModalOpen(false);
            setEditingOrganization(null);
          }}
          organizationId={editingOrganization.id}
          initialName={editingOrganization.name}
          initialDescription={editingOrganization.description || ''}
          initialRoles={editingOrganization.roles || []}
          initialAutoRemove={editingOrganization.autoRemoveMembers || false}
          initialAutoAddRoleMembersToChats={editingOrganization.autoAddRoleMembersToChats || false}
        />
      )}
    </>
  );
};

export default MainHeader;
