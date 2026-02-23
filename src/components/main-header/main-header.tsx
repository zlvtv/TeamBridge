import React from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import OrgInfoModal from '../../components/modals/org-info-modal/org-info-modal';
import styles from './main-header.module.css';

const MainHeader: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const { isOrgInfoOpen, openOrgInfo, closeOrgInfo } = useUI();
  const [infoBtnEl, setInfoBtnEl] = React.useState<HTMLButtonElement | null>(null);
  const [titleEl, setTitleEl] = React.useState<HTMLHeadingElement | null>(null);

  const handleInfoClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;

    if (isOrgInfoOpen) {
      closeOrgInfo();
      setInfoBtnEl(null);
      return;
    }

    setInfoBtnEl(target);
    openOrgInfo();
  };

  const handleTitleClick = (e: React.MouseEvent<HTMLHeadingElement>) => {
    const target = e.currentTarget;

    if (isOrgInfoOpen) {
      closeOrgInfo();
      setTitleEl(null);
      return;
    }

    setTitleEl(target);
    openOrgInfo();
  };

  return (
    <>
      <header className={styles['main-header']}>
        <h1
          ref={setTitleEl}
          className={styles['main-header__title']}
        >
          {currentOrganization ? currentOrganization.name : 'Выберите организацию'}
        </h1>

        {currentOrganization && (
          <button
            ref={setInfoBtnEl}
            className={styles['main-header__info-btn']}
            onClick={handleInfoClick}
            aria-label="Информация об организации"
          >
            ℹ️
          </button>
        )}
      </header>

      {isOrgInfoOpen && infoBtnEl && (
        <OrgInfoModal anchorEl={infoBtnEl} onClose={closeOrgInfo} />
      )}
    </>
  );
};

export default MainHeader;
