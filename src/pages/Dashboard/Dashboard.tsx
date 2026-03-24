import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import OrgIconPanel from '../../components/org-icon-panel/org-icon-panel';
import SettingsPanel from '../../components/settings-panel/settings-panel';
import MainHeader from '../../components/main-header/main-header';

import ProjectChat from '../../components/project-chat/project-chat';
import TaskBoard from '../../components/task-board/task-board';
import ResizableSplitter from '../../components/resizable-splitter/resizable-splitter';
import CreateOrganizationModal from '../../components/modals/create-organization-modal/create-organization-modal';
import CreateProjectModal from '../../components/modals/create-project-modal/create-project-modal';
import ProjectInfoModal from '../../components/modals/project-info-modal/project-info-modal';
import LoadingState from '../../components/ui/loading/LoadingState';
import EmptyDashboard from '../../components/empty-dashboard/EmptyDashboard';
import styles from './Dashboard.module.css';
import { useUI } from '../../contexts/UIContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';

const Dashboard: React.FC = () => {
  const { isBoardFullscreen, theme, chatWidth, isModalOpen, closeModal, openModal } = useUI();
  const { organizations, isLoading: orgLoading, currentOrganization, markOrganizationAsRead } = useOrganization();
  const { currentProject, projects, isLoading: projectLoading, setCurrentProject, markProjectAsRead } = useProject();
  const { canCreateProjects } = useProject();
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );
  const [mobileView, setMobileView] = useState<'chat' | 'board'>('chat');
  const [isMobileWorkspaceOpen, setIsMobileWorkspaceOpen] = useState(false);
  const [isProjectInfoModalOpen, setIsProjectInfoModalOpen] = useState(false);
  const [canShowEmptyDashboard, setCanShowEmptyDashboard] = useState(false);
  const [canShowProjectPlaceholder, setCanShowProjectPlaceholder] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const isTabletLayout = viewportWidth <= 1180;
  const isMobileLayout = viewportWidth <= 760;
  const shouldStackPanels = viewportWidth <= 1024;
  const canCreateProject = canCreateProjects();

  const showProjectContent = !!currentOrganization && !!currentProject && !projectLoading;

  useEffect(() => {
    if (!isMobileLayout) {
      setIsMobileWorkspaceOpen(false);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (orgLoading || organizations.length > 0) {
      setCanShowEmptyDashboard(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setCanShowEmptyDashboard(true);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [orgLoading, organizations.length]);

  useEffect(() => {
    if (!currentOrganization || currentProject || projectLoading) {
      setCanShowProjectPlaceholder(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setCanShowProjectPlaceholder(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [currentOrganization, currentProject, projectLoading]);

  useEffect(() => {
    if (!currentOrganization?.id || !currentProject?.id) return;
    markOrganizationAsRead(currentOrganization.id);
  }, [currentOrganization?.id, currentProject?.id, markOrganizationAsRead]);

  if (orgLoading) {
    return <LoadingState message="Загрузка организаций..." />;
  }

  const openOrgInfoFromMobile = () => {
    window.dispatchEvent(new CustomEvent('open-org-info'));
    setIsMobileWorkspaceOpen(false);
  };

  const selectProjectFromMobile = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    localStorage.setItem('currentProjectId', project.id);
    setCurrentProject(project);
    markProjectAsRead(project.id);
    setIsMobileWorkspaceOpen(false);
  };

  const mobilePanelControls = isMobileLayout ? (
    <div className={styles['dashboard__mobileInlineControls']}>
      <div className={styles['dashboard__mobileViewTabs']}>
        <button
          type="button"
          className={`${styles['dashboard__mobileViewButton']} ${mobileView === 'chat' ? styles['dashboard__mobileViewButton--active'] : ''}`}
          onClick={() => setMobileView('chat')}
        >
          Чат
        </button>
        <button
          type="button"
          className={`${styles['dashboard__mobileViewButton']} ${mobileView === 'board' ? styles['dashboard__mobileViewButton--active'] : ''}`}
          onClick={() => setMobileView('board')}
        >
          Задачи
        </button>
        <button
          type="button"
          className={styles['dashboard__mobileProjectInfoPill']}
          onClick={() => setIsProjectInfoModalOpen(true)}
          disabled={!currentProject}
          aria-label="О проекте"
        >
          ⓘ
        </button>
      </div>
    </div>
  ) : null;

  const mobileWorkspaceMenu =
    isMobileLayout && isMobileWorkspaceOpen && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className={styles['dashboard__mobileBackdrop']}
              onClick={() => setIsMobileWorkspaceOpen(false)}
              aria-label="Закрыть меню рабочего пространства"
            />
            <div className={`${styles['dashboard__mobileSheet']} ${styles['dashboard__mobileSheet--left']}`}>
              <div className={styles['dashboard__mobileMenuSection']}>
                <span className={styles['dashboard__mobileMenuLabel']}>Рабочее пространство</span>
                <button
                  type="button"
                  className={styles['dashboard__mobileWorkspaceCard']}
                  onClick={openOrgInfoFromMobile}
                  disabled={!currentOrganization}
                >
                  <div className={styles['dashboard__mobileWorkspacePrimary']}>
                    <strong>{currentOrganization?.name || 'Выберите организацию'}</strong>
                    <span>Состав участников, роли и информация</span>
                  </div>
                  <span className={styles['dashboard__mobileWorkspaceAction']}>Открыть</span>
                </button>
                <div className={styles['dashboard__mobileOrganizationsContainer']}>
                  <OrgIconPanel compactMobile onProjectSelected={() => setIsMobileWorkspaceOpen(false)} />
                </div>
              </div>

              <div className={styles['dashboard__mobileMenuSection']}>
                <span className={styles['dashboard__mobileMenuLabel']}>Создать</span>
                <div className={styles['dashboard__mobileQuickActions']}>
                  <button
                    type="button"
                    className={styles['dashboard__mobileQuickAction']}
                    onClick={() => {
                      openModal('createOrg');
                      setIsMobileWorkspaceOpen(false);
                    }}
                  >
                    Организация
                  </button>
                </div>
              </div>

              <div className={styles['dashboard__mobileMenuSection']}>
                <span className={styles['dashboard__mobileMenuLabel']}>Профиль и настройки</span>
                <SettingsPanel compactMobileList onAction={() => setIsMobileWorkspaceOpen(false)} />
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div
      className={[
        styles.dashboard,
        theme,
        isTabletLayout ? styles['dashboard--tablet'] : '',
        isMobileLayout ? styles['dashboard--mobile'] : '',
        shouldStackPanels ? styles['dashboard--stacked'] : '',
      ].filter(Boolean).join(' ')}
    >
      <div className={styles['dashboard__ambient']} />

      {!isMobileLayout ? (
        <aside className={styles['dashboard__left']}>
          <div className={styles['dashboard__sidebar-card']}>
            <OrgIconPanel />
          </div>
          <div className={styles['dashboard__sidebar-card']}>
            <SettingsPanel />
          </div>
        </aside>
      ) : null}

      <main className={styles['dashboard__main']}>
        <MainHeader />

        {isMobileLayout ? (
          <div className={styles['dashboard__mobileToolbar']}>
            <div className={styles['dashboard__mobileToolbarRow']}>
              <button
                type="button"
                className={`${styles['dashboard__mobileUtilityButton']} ${isMobileWorkspaceOpen ? styles['dashboard__mobileUtilityButton--active'] : ''}`}
                onClick={() => {
                  setIsMobileWorkspaceOpen((prev) => !prev);
                }}
              >
                ☰
              </button>
              <div className={styles['dashboard__mobileProjectsRail']}>
                <div className={styles['dashboard__mobileProjectsBar']}>
                  {projects.length > 0 ? (
                    projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className={`${styles['dashboard__mobileProjectChip']} ${currentProject?.id === project.id ? styles['dashboard__mobileProjectChip--active'] : ''} ${project.hasUnreadMessages ? styles['dashboard__mobileProjectChip--unread'] : ''}`}
                        onClick={() => selectProjectFromMobile(project.id)}
                      >
                        {project.name}
                      </button>
                    ))
                  ) : (
                    <div className={styles['dashboard__mobileProjectsEmpty']}>Проекты появятся здесь</div>
                  )}
                </div>
              </div>
              {canCreateProject ? (
                <button
                  type="button"
                  className={styles['dashboard__mobileAddProjectButton']}
                  onClick={() => openModal('createProject')}
                  aria-label="Создать проект"
                >
                  +
                </button>
              ) : null}
            </div>

          </div>
        ) : null}
        {mobileWorkspaceMenu}

        {organizations.length === 0 && canShowEmptyDashboard ? (
          <EmptyDashboard />
        ) : organizations.length === 0 ? (
          <div className={styles['dashboard__panel-loading']}>
            <LoadingState message="Подготавливаем рабочее пространство..." />
          </div>
        ) : !isBoardFullscreen ? (
          <div className={styles['dashboard__content']}>
            <section
              className={`${styles['dashboard__chat']} ${isMobileLayout && mobileView !== 'chat' ? styles['dashboard__panel--hidden'] : ''}`}
              style={!shouldStackPanels && !isMobileLayout ? { width: `${chatWidth}px` } : undefined}
            >
              {isMobileLayout ? mobilePanelControls : null}
              {currentOrganization && currentProject ? (
                showProjectContent ? (
                  <ProjectChat />
                ) : (
                  <div className={styles['dashboard__panel-loading']}>
                    <LoadingState message="Загрузка чата..." />
                  </div>
                )
              ) : currentOrganization && (!canShowProjectPlaceholder || projectLoading || projects.length > 0) ? (
                <div className={styles['dashboard__panel-loading']}>
                  <LoadingState message="Открываем проект..." />
                </div>
              ) : (
                <div className={styles['dashboard__placeholder']}>
                  <h3>Выберите организацию и проект</h3>
                  <p>Когда активный проект появится, здесь откроется рабочий чат команды.</p>
                </div>
              )}
            </section>

            {!shouldStackPanels && !isMobileLayout ? <ResizableSplitter /> : null}

            <section className={`${styles['dashboard__board']} ${isMobileLayout && mobileView !== 'board' ? styles['dashboard__panel--hidden'] : ''}`}>
              {isMobileLayout ? mobilePanelControls : null}
              {currentOrganization ? (
                showProjectContent ? (
                  <TaskBoard />
                ) : (
                  <div className={styles['dashboard__panel-loading']}>
                    <LoadingState message="Загрузка панели задач..." />
                  </div>
                )
              ) : (
                <TaskBoard />
              )}
            </section>
          </div>
        ) : (
          <div className={styles['dashboard__fullscreen']}>
            <TaskBoard />
          </div>
        )}
      </main>

      <CreateOrganizationModal
        isOpen={isModalOpen('createOrg')}
        onClose={() => closeModal('createOrg')}
      />

      <CreateProjectModal
        isOpen={isModalOpen('createProject')}
        onClose={() => closeModal('createProject')}
      />

      <ProjectInfoModal
        isOpen={isProjectInfoModalOpen}
        onClose={() => setIsProjectInfoModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
