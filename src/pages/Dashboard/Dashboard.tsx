import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import OrgIconPanel from '../../components/org-icon-panel/org-icon-panel';
import SettingsPanel from '../../components/settings-panel/settings-panel';
import MainHeader from '../../components/main-header/main-header';
import ChatHeader from '../../components/chat-header/chat-header';
import ProjectChat from '../../components/project-chat/project-chat';
import TaskBoard from '../../components/task-board/task-board';
import ResizableSplitter from '../../components/resizable-splitter/resizable-splitter';
import CreateOrganizationModal from '../../components/modals/create-organization-modal/create-organization-modal';
import LoadingState from '../../components/ui/loading/LoadingState';
import EmptyDashboard from '../../components/empty-dashboard/EmptyDashboard';
import styles from './Dashboard.module.css';
import { useUI } from '../../contexts/UIContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { isBoardFullscreen, theme, chatWidth, isCreateOrgModalOpen, openCreateOrgModal, closeCreateOrgModal } = useUI();
  const { organizations, isLoading: orgLoading, refreshOrganizations, currentOrganization } = useOrganization();
  const { currentProject, isLoading: projectLoading } = useProject();
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  useEffect(() => {
    const state = location.state as { openCreateOrgModal?: boolean } | null;
    if (state?.openCreateOrgModal && !isCreateOrgModalOpen) {
      openCreateOrgModal();
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [isCreateOrgModalOpen, openCreateOrgModal, location.state]);

  if (orgLoading) {
    return <LoadingState message="Загрузка организаций..." />;
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

        {organizations.length === 0 ? (
          <EmptyDashboard />
        ) : !isBoardFullscreen ? (
          <div className={styles['dashboard__content']}>
            <div className={styles['dashboard__chat']} style={{ width: `${chatWidth}px` }}>
              {(currentProject && !projectLoading) ? <ProjectChat /> : <LoadingState message="Загрузка чата..." />}
            </div>
            <ResizableSplitter />
            <div className={styles['dashboard__board']}>
              {(currentProject && !projectLoading) ? <TaskBoard /> : <LoadingState message="Загрузка панели задач..." />}
            </div>
          </div>
        ) : (
          <div className={styles['dashboard__fullscreen']}>
          </div>
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
