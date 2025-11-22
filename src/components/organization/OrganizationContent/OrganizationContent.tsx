// src/components/organization/OrganizationContent/OrganizationContent.tsx
import React from 'react';
import { useOrganization } from '../../../context/OrganizationContext';
import styles from './OrganizationContent.module.css';

const OrganizationContent: React.FC = () => {
  const { currentOrganization } = useOrganization();

  if (!currentOrganization) {
    return null;
  }

  return (
    <div className={styles.content}>
      <div className={styles.content__header}>
        <div className={styles.content__headerInfo}>
          <h1 className={styles.content__title}>{currentOrganization.name}</h1>
          {currentOrganization.description && (
            <p className={styles.content__description}>
              {currentOrganization.description}
            </p>
          )}
          <div className={styles.content__meta}>
            <span className={styles.content__inviteCode}>
              Invite Code: <strong>{currentOrganization.invite_code}</strong>
            </span>
            <span className={styles.content__memberCount}>
              {currentOrganization.organization_members?.length || 0} members
            </span>
          </div>
        </div>
      </div>

      <div className={styles.content__body}>
        <div className={styles.placeholder}>
          <h3>Organization Dashboard</h3>
          <p>This is where your channels, messages, and tasks will appear.</p>
          <p>Next week we'll start building the channels functionality.</p>
          
          <div className={styles.placeholder__features}>
            <div className={styles.feature}>
              <h4>📝 Channels & Topics</h4>
              <p>Organize discussions by channels and topics</p>
            </div>
            <div className={styles.feature}>
              <h4>💬 Real-time Messages</h4>
              <p>Instant messaging with reactions and threads</p>
            </div>
            <div className={styles.feature}>
              <h4>✅ Task Management</h4>
              <p>Create and assign tasks with deadlines</p>
            </div>
            <div className={styles.feature}>
              <h4>📅 Calendar Integration</h4>
              <p>View all deadlines in one place</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationContent;