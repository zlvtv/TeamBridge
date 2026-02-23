import React, { useState } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Button from '../../ui/button/button';
import { FormProvider } from '../../ui/form/FormProvider';
import Field from '../../ui/form/Field';
import styles from './create-project-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useProject } from '../../../contexts/ProjectContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';
import { projectService } from '../../../services/projectService';
import { messageService } from '../../../services/messageService';

const CreateProjectModal: React.FC = () => {
const { currentOrganization } = useOrganization();
const { refreshProjects } = useProject();
const {
  isModalOpen,
  closeModal,
} = useUI();

const isCreateProjectOpen = isModalOpen('createProject');
const closeCreateProject = () => closeModal('createProject');
  const { user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentOrganization || !user) return null;

  const handleSubmit = async (values: Record<string, any>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const projectId = await projectService.createProject({
        name: values.name,
        description: values.description || null,
        organization_id: currentOrganization.id,
        created_by: user.id
      });

      await projectService.addMember(projectId, user.id, 'owner');

      await messageService.sendSystemMessage(projectId, `Создан проект: **${values.name}**`);

      await refreshProjects();
      closeCreateProject();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать проект');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isCreateProjectOpen} onClose={closeCreateProject} title="Создать проект">
      <FormProvider
        initialValues={{ name: '', description: '' }}
        onSubmit={handleSubmit}
      >
        <div className={styles['create-project-modal__field']}>
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

        <div className={styles['create-project-modal__field']}>
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
          <div className={styles['create-project-modal__error-message']}>
            {error}
          </div>
        )}

        <div className={styles['create-project-modal__actions']}>
          <Button variant="secondary" onClick={closeCreateProject} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Создать
          </Button>
        </div>

        {isSubmitting && (
          <div className={styles['create-project-modal__creating-feedback']}>
            <small>Создаём проект…</small>
          </div>
        )}
      </FormProvider>
    </Modal>
  );
};

export default CreateProjectModal;
