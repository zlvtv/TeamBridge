import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/modal/modal';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useProject } from '../../../contexts/ProjectContext';
import { useAllUserProjects } from '../../../hooks/useAllUserProjects';
import { getCollection } from '../../../services/firestore/firestoreService';
import { decryptMessage } from '../../../lib/crypto';
import styles from './search-modal.module.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SearchTab = 'all' | 'organizations' | 'projects' | 'tasks' | 'messages';

type SearchMessageResult = {
  id: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  text: string;
  createdAt: number;
};

const SEARCH_TABS: Array<{ id: SearchTab; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'organizations', label: 'Организации' },
  { id: 'projects', label: 'Проекты' },
  { id: 'tasks', label: 'Задачи' },
  { id: 'messages', label: 'Сообщения' },
];

const normalize = (value: string) => value.toLocaleLowerCase('ru').trim();

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [messageResults, setMessageResults] = useState<SearchMessageResult[]>([]);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);

  const { organizations, setCurrentOrganization } = useOrganization();
  const { setCurrentProject } = useProject();
  const { projects: allUserProjects } = useAllUserProjects();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveTab('all');
      setMessageResults([]);
      setIsSearchingMessages(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleHotkey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
      }
    };

    if (!isOpen) return;
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, [isOpen]);

  const normalizedQuery = normalize(query);

  const organizationsResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return organizations.filter((org) => {
      const membersText = (org.organization_members || [])
        .map((member) => `${member.user?.full_name || ''} ${member.user?.username || ''}`)
        .join(' ');

      return normalize(`${org.name} ${org.description || ''} ${membersText}`).includes(normalizedQuery);
    });
  }, [normalizedQuery, organizations]);

  const projectsResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return allUserProjects.filter((project) => {
      const rolesText = (project.roles || []).map((role: any) => role.name || '').join(' ');
      return normalize(`${project.name} ${project.description || ''} ${rolesText}`).includes(normalizedQuery);
    });
  }, [allUserProjects, normalizedQuery]);

  const taskResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return allUserProjects
      .flatMap((project) =>
        (project.tasks || [])
          .filter((task: any) => !task.archived_at)
          .map((task: any) => ({
            ...task,
            projectName: project.name,
            organizationId: project.organization_id,
            organizationName: organizations.find((org) => org.id === project.organization_id)?.name || '',
          }))
      )
      .filter((task) =>
        normalize(`${task.title} ${task.description || ''} ${(task.tags || []).join(' ')}`).includes(normalizedQuery)
      );
  }, [allUserProjects, normalizedQuery, organizations]);

  useEffect(() => {
    let cancelled = false;

    const searchMessages = async () => {
      if (!isOpen || normalizedQuery.length < 3 || (activeTab !== 'all' && activeTab !== 'messages')) {
        setMessageResults([]);
        setIsSearchingMessages(false);
        return;
      }

      setIsSearchingMessages(true);

      try {
        const messageCollections = await Promise.all(
          allUserProjects.slice(0, 12).map(async (project) => {
            const messages = await getCollection<any>('messages', {
              whereClauses: [{ field: 'project_id', operator: '==', value: project.id }],
            });

            return messages
              .filter((message) => !message.task_id && message.type !== 'system')
              .map((message) => {
                const text = message.text ? decryptMessage(message.text, project.id) : '';
                return {
                  id: message.id,
                  projectId: project.id,
                  projectName: project.name,
                  organizationId: project.organization_id,
                  organizationName: organizations.find((org) => org.id === project.organization_id)?.name || '',
                  text,
                  createdAt: new Date(String(message.created_at_client || message.created_at || 0)).getTime(),
                } satisfies SearchMessageResult;
              });
          })
        );

        if (cancelled) return;

        const matched = messageCollections
          .flat()
          .filter((message) => normalize(message.text).includes(normalizedQuery))
          .sort((left, right) => right.createdAt - left.createdAt)
          .slice(0, 12);

        setMessageResults(matched);
      } catch (error) {
        if (!cancelled) {
          console.error('Не удалось выполнить поиск по сообщениям:', error);
          setMessageResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingMessages(false);
        }
      }
    };

    void searchMessages();

    return () => {
      cancelled = true;
    };
  }, [activeTab, allUserProjects, isOpen, normalizedQuery, organizations]);

  const selectProjectContext = (organizationId: string, projectId: string) => {
    const organization = organizations.find((org) => org.id === organizationId);
    if (!organization) return;

    sessionStorage.setItem(
      'pendingProjectSelection',
      JSON.stringify({ organizationId, projectId })
    );
    localStorage.setItem('currentOrgId', organizationId);
    localStorage.setItem('currentProjectId', projectId);
    setCurrentOrganization(organization);

    const alreadyLoadedProject = allUserProjects.find((project) => project.id === projectId);
    if (alreadyLoadedProject) {
      setCurrentProject(alreadyLoadedProject);
    }
  };

  const handleOrganizationClick = (organizationId: string) => {
    const organization = organizations.find((org) => org.id === organizationId);
    if (!organization) return;

    localStorage.setItem('currentOrgId', organizationId);
    setCurrentOrganization(organization);
    onClose();
  };

  const handleProjectClick = (organizationId: string, projectId: string) => {
    selectProjectContext(organizationId, projectId);
    onClose();
  };

  const handleTaskClick = (organizationId: string, projectId: string, taskId: string) => {
    localStorage.setItem('focusTaskId', taskId);
    selectProjectContext(organizationId, projectId);
    onClose();
  };

  const handleMessageClick = (result: SearchMessageResult) => {
    localStorage.setItem('focusMessageId', result.id);
    localStorage.setItem('focusMessageProjectId', result.projectId);
    selectProjectContext(result.organizationId, result.projectId);
    onClose();
  };

  const shouldShow = (tab: SearchTab) => activeTab === 'all' || activeTab === tab;
  const hasAnyResults =
    organizationsResults.length > 0 ||
    projectsResults.length > 0 ||
    taskResults.length > 0 ||
    messageResults.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Глобальный поиск"
      showCloseButton={false}
      maxWidth={780}
    >
      <div className={styles['search-modal__content']}>
        <div className={styles['search-modal__intro']}>
          <span>Ищите по организациям, проектам, задачам и сообщениям</span>
          <kbd>⌘K</kbd>
        </div>

        <input
          type="text"
          className={styles['search-modal__input']}
          placeholder="Например: релиз, onboarding, отчет..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />

        <div className={styles['search-modal__tabs']}>
          {SEARCH_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles['search-modal__tab']} ${activeTab === tab.id ? styles['search-modal__tab--active'] : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!normalizedQuery ? (
          <div className={styles['search-modal__empty']}>
            Введите запрос, и я покажу совпадения по рабочему пространству.
          </div>
        ) : (
          <div className={styles['search-modal__results']}>
            {shouldShow('organizations') && organizationsResults.length > 0 ? (
              <section className={styles['search-modal__section']}>
                <h3>Организации</h3>
                {organizationsResults.slice(0, 6).map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    className={styles['search-modal__result-item']}
                    onClick={() => handleOrganizationClick(org.id)}
                  >
                    <span className={styles['search-modal__result-name']}>{org.name}</span>
                    {org.description ? (
                      <span className={styles['search-modal__result-desc']}>{org.description}</span>
                    ) : null}
                  </button>
                ))}
              </section>
            ) : null}

            {shouldShow('projects') && projectsResults.length > 0 ? (
              <section className={styles['search-modal__section']}>
                <h3>Проекты</h3>
                {projectsResults.slice(0, 8).map((project) => {
                  const organizationName = organizations.find((org) => org.id === project.organization_id)?.name || '';
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={styles['search-modal__result-item']}
                      onClick={() => handleProjectClick(project.organization_id, project.id)}
                    >
                      <span className={styles['search-modal__result-name']}>{project.name}</span>
                      <span className={styles['search-modal__result-meta']}>{organizationName}</span>
                    </button>
                  );
                })}
              </section>
            ) : null}

            {shouldShow('tasks') && taskResults.length > 0 ? (
              <section className={styles['search-modal__section']}>
                <h3>Задачи</h3>
                {taskResults.slice(0, 10).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={styles['search-modal__result-item']}
                    onClick={() => handleTaskClick(task.organizationId, task.project_id, task.id)}
                  >
                    <span className={styles['search-modal__result-name']}>{task.title}</span>
                    <span className={styles['search-modal__result-desc']}>
                      {task.organizationName} · {task.projectName}
                    </span>
                  </button>
                ))}
              </section>
            ) : null}

            {shouldShow('messages') ? (
              <section className={styles['search-modal__section']}>
                <h3>Сообщения</h3>
                {isSearchingMessages ? (
                  <div className={styles['search-modal__loading']}>Ищу сообщения...</div>
                ) : messageResults.length > 0 ? (
                  messageResults.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      className={styles['search-modal__result-item']}
                      onClick={() => handleMessageClick(message)}
                    >
                      <span className={styles['search-modal__result-name']}>{message.text}</span>
                      <span className={styles['search-modal__result-desc']}>
                        {message.organizationName} · {message.projectName}
                      </span>
                    </button>
                  ))
                ) : activeTab === 'messages' || normalizedQuery.length >= 3 ? (
                  <div className={styles['search-modal__section-empty']}>Сообщения не найдены</div>
                ) : null}
              </section>
            ) : null}

            {!hasAnyResults && !isSearchingMessages ? (
              <div className={styles['search-modal__no-results']}>Ничего не найдено</div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SearchModal;
