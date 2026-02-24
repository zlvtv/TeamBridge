import { useRef, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import OrgInfoModal from '../../components/modals/org-info-modal/org-info-modal';
import styles from './main-header.module.css';

const MainHeader: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const { isModalOpen, openModal, closeModal } = useUI();

  const isOrgInfoOpen = isModalOpen('orgInfo');
  const openOrgInfo = () => openModal('orgInfo');
  const closeOrgInfo = () => closeModal('orgInfo');

  const infoBtnElRef = useRef<HTMLButtonElement | null>(null);
  const [titleEl, setTitleEl] = useState<HTMLHeadingElement | null>(null);


  const handleInfoClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Info btn clicked', e.currentTarget);
    if (isOrgInfoOpen) {
      closeOrgInfo();
      infoBtnElRef.current = null;
    } else {
      infoBtnElRef.current = e.currentTarget;
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

    setTitleEl(target);
    openOrgInfo();
  };

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
              infoBtnElRef.current = el;
            }}
            className={styles['main-header__info-btn']}
            onClick={handleInfoClick}
            aria-label="Информация об организации"
          >
            ℹ️
          </button>
        )}
      </header>

      {isOrgInfoOpen && infoBtnElRef.current && (
        <OrgInfoModal
          anchorEl={infoBtnElRef.current}
          onClose={closeOrgInfo}
        />
      )}
    </>
  );
};

export default MainHeader;
