// src/pages/Dashboard/Dashboard.tsx
import React from 'react';
import OrgIconPanel from '../../components/org-icon-panel/org-icon-panel';
import SettingsPanel from '../../components/settings-panel/settings-panel';
import MainHeader from '../../components/main-header/main-header';
import ChatHeader from '../../components/chat-header/chat-header';
import ProjectChat from '../../components/project-chat/project-chat';
import TaskBoard from '../../components/task-board/task-board';
import ResizableSplitter from '../../components/resizable-splitter/resizable-splitter';
import EmptyDashboard from '../../components/empty-dashboard/EmptyDashboard'; // ✅ Новый компонент
import styles from './Dashboard.module.css';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';

const Dashboard: React.FC = () => {
  const { isBoardFullscreen, theme, chatWidth } = useUI();
  const { user } = useAuth();
  const { organizations, currentOrganization, isLoading: orgLoading } = useOrganization();
  const { currentProject } = useProject();

  if (orgLoading) {
    return <div className={styles.loading}>Загрузка организаций...</div>;
  }

  if (organizations.length === 0) {
    return <EmptyDashboard />;
  }

  return (
    <div className={`${styles.dashboard} ${theme}`}>
      {/* ✅ Панели: снизу, но выровнены по вертикали */}
      <div className={styles['dashboard__panels-container']}>
        <OrgIconPanel />
        <SettingsPanel />
      </div>

      <main className={styles['dashboard__main']}>
        <MainHeader />
        <ChatHeader />

        {!isBoardFullscreen ? (
          <div className={styles['dashboard__content']}>
            <div className={styles['dashboard__chat']} style={{ width: `${chatWidth}px` }}>
              {currentProject ? (
                <ProjectChat />
              ) : (
                <div className={styles['chat-placeholder']}>Выберите проект</div>
              )}
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
        )}
      </main>
    </div>
  );
};

export default Dashboard;
