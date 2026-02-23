import React, { useRef, useEffect, useState } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Button from '../../ui/button/button';
import styles from './project-info-modal.module.css';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useProject } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';

interface ProjectInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProjectInfoModal: React.FC<ProjectInfoModalProps> = ({ isOpen, onClose }) => {
  const { currentOrganization } = useOrganization();
  const { currentProject } = useProject();
  const { user } = useAuth();

  const isOwner = currentOrganization?.created_by === user?.id;
  const currentUserMember = currentOrganization?.organization_members?.find(m => m.user_id === user?.id);
  const isModerator = isOwner || (currentUserMember?.status === 'admin');

  useEffect(() => {
    if (isOpen) {
    }
  }, [isOpen]);

  if (!currentProject || !currentOrganization) return null;

  const projectLeader = currentOrganization.organization_members?.find(
    member => member.user_id === currentProject.project_leader_id
  );

  const leaderName = projectLeader
    ? projectLeader.user?.full_name || projectLeader.user?.username || 'Неизвестно'
    : 'Неизвестно';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Информация о проекте">
      <div className={styles['project-info-modal__content']}>
        <div className={styles['project-info-modal__info-grid']}>
          <div className={styles['project-info-modal__info-item']}>
            <strong>Название:</strong>
            <span>{currentProject.project_name}</span>
          </div>
          <div className={styles['project-info-modal__info-item']}>
            <strong>Описание:</strong>
            <span>{currentProject.project_description || '—'}</span>
          </div>
          <div className={styles['project-info-modal__info-item']}>
            <strong>Руководитель:</strong>
            <span>{leaderName}</span>
          </div>
          <div className={styles['project-info-modal__info-item']}>
            <strong>Организация:</strong>
            <span>{currentOrganization.name}</span>
          </div>
          <div className={styles['project-info-modal__info-item']}>
            <strong>Дата создания:</strong>
            <span>
              {currentProject.created_at
                ? new Date(currentProject.created_at).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : '—'}
            </span>
          </div>
        </div>

        {currentProject.project_tags && currentProject.project_tags.length > 0 && (
          <div className={styles['project-info-modal__tags-section']}>
            <strong>Теги:</strong>
            <div className={styles['project-info-modal__tags-list']}>
              {currentProject.project_tags.map((tag, index) => (
                <span key={index} className={styles['project-info-modal__tag']}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles['project-info-modal__actions']}>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProjectInfoModal;
