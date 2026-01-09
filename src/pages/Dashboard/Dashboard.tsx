import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import OrgIconPanel from '../../components/org-icon-panel/org-icon-panel';
import SettingsPanel from '../../components/settings-panel/settings-panel';
import MainHeader from '../../components/main-header/main-header';
import ChatHeader from '../../components/chat-header/chat-header';
import ProjectChat from '../../components/project-chat/project-chat';
import TaskBoard from '../../components/task-board/task-board';
import ResizableSplitter from '../../components/resizable-splitter/resizable-splitter';
import EmptyDashboard from '../../components/empty-dashboard/EmptyDashboard';
import CreateOrganizationModal from '../../components/modals/create-organization-modal/create-organization-modal';
import styles from './Dashboard.module.css';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';

const Dashboard: React.FC = () => {
  const { isBoardFullscreen, theme, chatWidth, isCreateOrgModalOpen, openCreateOrgModal, closeCreateOrgModal } = useUI();
  const { user } = useAuth();
  const { organizations, currentOrganization, isLoading: orgLoading } = useOrganization();
  const { currentProject } = useProject();
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { openCreateOrgModal?: boolean } | null;
    if (state?.openCreateOrgModal) {
      openCreateOrgModal();
      window.history.replaceState({}, document.title);
    }
  }, [openCreateOrgModal, location.state]);

  useEffect(() => {
    console.log('🔄 isCreateOrgModalOpen изменился:', isCreateOrgModalOpen);
  }, [isCreateOrgModalOpen]);

  if (orgLoading) {
    return <div className={styles.loading}>Загрузка организаций...</div>;
  }

  return (
    <div className={`${styles.dashboard} ${theme}`}>
      <div className={styles['dashboard__panels-container']}>
        <OrgIconPanel />
        <SettingsPanel />
      </div>

      <main className={styles['dashboard__main']}>
        <MainHeader />
        <ChatHeader />

        {organizations.length === 0 && !isCreateOrgModalOpen && (
          <EmptyDashboard />
        )}

        {organizations.length > 0 && (
          !isBoardFullscreen ? (
            <div className={styles['dashboard__content']}>
              <div className={styles['dashboard__chat']} style={{ width: `${chatWidth}px` }}>
                {currentProject ? <ProjectChat /> : <div className={styles['chat-placeholder']}>Выберите проект</div>}
              </div>
              <ResizableSplitter />
              <div className={styles['dashboard__board']}>
                <TaskBoard />
              </div>
            </div>
          ) : (
            <div className={styles['dashboard__fullscreen']}>
              <TaskBoard />
            </div>
          )
        )}
      </main>

      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={closeCreateOrgModal}
      />
    </div>
  );
};

export default Dashboard;
