import React from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import CreateTaskModal from '../../components/modals/create-task-modal/create-task-modal';
import styles from './chat-header.module.css';
import { createPortal } from 'react-dom';

const ChatHeader: React.FC = () => {
  const { projects } = useProject();
  const { isCreateProjectOpen, openCreateProject, closeCreateProject } = useUI();
  const [addBtnEl, setAddBtnEl] = React.useState<HTMLButtonElement | null>(null);

  const handleAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setAddBtnEl(e.currentTarget);
    openCreateProject();
  };

  return (
    <>
      <header className={styles['chat-header']}>
        <div className={styles['chat-header__tabs']} role="tablist">
          {projects.map((project) => (
            <button
              key={project.id}
              role="tab"
              className={styles['chat-header__tab']}
              aria-selected="false"
            >
              {project.name}
            </button>
          ))}
        </div>

        {projects.length > 0 && (
          <button
            ref={setAddBtnEl}
            className={styles['chat-header__add-btn']}
            onClick={handleAddClick}
            aria-label="Создать проект"
            title="Создать новый проект"
          >
            +
          </button>
        )}
      </header>

      {isCreateProjectOpen && addBtnEl &&
        createPortal(
          <CreateTaskModal isOpen={isCreateProjectOpen} onClose={closeCreateProject} />,
          document.body
        )}
    </>
  );
};

export default ChatHeader;
