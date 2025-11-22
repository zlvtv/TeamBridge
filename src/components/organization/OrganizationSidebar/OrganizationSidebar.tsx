// src/components/organization/OrganizationSidebar/OrganizationSidebar.tsx
import React from 'react';
import { useOrganization } from '../../../context/OrganizationContext';
import Button from '../../ui/Button/Button';
import styles from './OrganizationSidebar.module.css';

interface OrganizationSidebarProps {
  onOpenCreateModal: () => void;
  onOpenJoinModal: () => void;
}

const OrganizationSidebar: React.FC<OrganizationSidebarProps> = ({
  onOpenCreateModal,
  onOpenJoinModal,
}) => {
  const { organizations, currentOrganization, setCurrentOrganization, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.sidebar__loading}>Loading organizations...</div>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebar__header}>
        <h2 className={styles.sidebar__title}>Organizations</h2>
        <div className={styles.sidebar__actions}>
          <Button
            variant="primary"
            onClick={onOpenCreateModal}
            className={styles.sidebar__button}
            size="small"
          >
            New
          </Button>
          <Button
            variant="secondary"
            onClick={onOpenJoinModal}
            className={styles.sidebar__button}
            size="small"
          >
            Join
          </Button>
        </div>
      </div>

      <div className={styles.sidebar__content}>
        {organizations.length === 0 ? (
          <div className={styles.sidebar__empty}>
            <p>No organizations yet</p>
            <p className={styles.sidebar__emptyHint}>
              Create your first organization or join an existing one
            </p>
          </div>
        ) : (
          <div className={styles.organizationList}>
            {organizations.map((org) => (
              <div
                key={org.id}
                className={`${styles.organizationItem} ${
                  currentOrganization?.id === org.id ? styles['organizationItem--active'] : ''
                }`}
                onClick={() => setCurrentOrganization(org)}
              >
                <div className={styles.organizationItem__avatar}>
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className={styles.organizationItem__info}>
                  <div className={styles.organizationItem__name}>
                    {org.name}
                  </div>
                  <div className={styles.organizationItem__members}>
                    {org.organization_members?.length || 0} members
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationSidebar;