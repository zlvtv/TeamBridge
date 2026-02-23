import React, { useState } from 'react';
import Modal from '../../ui/modal/Modal';
import Button from '../../ui/button/button';
import { FormProvider } from '../../ui/form/FormProvider';
import Field from '../../ui/form/Field';
import styles from './edit-project-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useProject } from '../../../contexts/ProjectContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';
import ConfirmModal from '../confirm-modal/confirm-modal';
import { projectService } from '../../../services/projectService';
import { messageService } from '../../../services/messageService';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose }) => {
  const { currentOrganization } = useOrganization();
  const { currentProject, refreshProjects } = useProject();
  const { closeEditProject } = useUI();
  const { user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  if (!currentProject) return null;

  const handleSubmit = async (values: Record<string, any>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await projectService.updateProject(currentProject.id, {
        name: values.name,
        description: values.description || null
      });

      if (currentProject.name !== values.name) {
        await messageService.sendSystemMessage(
          currentProject.id,
          `Название проекта изменено на: **${values.name}**`
        );
      }

      await refreshProjects();
      onClose();
      closeEditProject();
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить проект');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      const projectName = currentProject.name;
      await projectService.deleteProject(currentProject.id);
      await messageService.sendSystemMessage(currentProject.id, `Проект **${projectName}** был удалён`);
      onClose();
      closeEditProject();
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить проект');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать проект">
      <FormProvider
        initialValues={{
          name: currentProject.name,
          description: currentProject.description || ''
        }}
        onSubmit={handleSubmit}
      >
        <div className={styles['edit-project-modal__field']}>
          <Field
            name="name"
            label="Название проекта *"
            placeholder="Введите название"
            required
            validators={[
              (value) => !value?.trim() ? 'Обязательно' : null,
              (value) => value.trim().length < 2 ? 'Минимум 2 символа' : null
            ]}
          />
        </div>

        <div className={styles['edit-project-modal__field']}>
          <Field
            name="description"
            label="Описание (опционально)"
            placeholder="Введите описание"
            type="textarea"
            multiline
            rows={3}
          />
        </div>

        {error && (
          <div className={styles['edit-project-modal__error-message']}>
            {error}
          </div>
        )}

        <div className={styles['edit-project-modal__actions']}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Сохранить
          </Button>
        </div>
      </FormProvider>

      <div className={styles['edit-project-modal__danger-zone']}>
        <h3>Удалить проект</h3>
        <p>Удаление проекта приведёт к удалению всех сообщений и самого проекта. Это действие нельзя отменить.</p>
        <Button variant="danger" onClick={() => setIsDeleteConfirmOpen(true)} disabled={isSubmitting}>
          Удалить проект
        </Button>
      </div>

      {isDeleteConfirmOpen && (
        <ConfirmModal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onConfirm={handleDelete}
          title="Подтвердите удаление"
          confirmText="Удалить"
          cancelText="Отмена"
        >
          <p>Вы действительно хотите удалить проект <strong>{currentProject.name}</strong>?</p>
          <p>Все данные будут безвозвратно удалены.</p>
        </ConfirmModal>
      )}
    </Modal>
  );
};

export default EditProjectModal;
