// src/pages/Dashboard/Dashboard.tsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { OrganizationProvider, useOrganization } from '../../context/OrganizationContext';
import Button from '../../components/ui/Button/Button';
import Modal from '../../components/ui/Modal/Modal';
import Input from '../../components/ui/Input/Input';
import OrganizationSidebar from '../../components/organization/OrganizationSidebar/OrganizationSidebar';
import OrganizationContent from '../../components/organization/OrganizationContent/OrganizationContent';
import styles from './Dashboard.module.css';

const DashboardContent: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { organizations, currentOrganization, createOrganization, joinOrganization } = useOrganization();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await createOrganization({
        name: orgName.trim(),
        description: orgDescription.trim() || undefined,
      });
      setOrgName('');
      setOrgDescription('');
      setIsCreateModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await joinOrganization(inviteCode.trim());
      setInviteCode('');
      setIsJoinModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Принудительная навигация на логин после выхода
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.dashboard__header}>
        <div className={styles.dashboard__headerContent}>
          <h1 className={styles.dashboard__title}>Corporate Messenger</h1>
          <div className={styles.dashboard__userInfo}>
            <span className={styles.dashboard__userName}>
              {user?.username || user?.email}
            </span>
            <Button variant="secondary" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      
      <main className={styles.dashboard__main}>
        <OrganizationSidebar 
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onOpenJoinModal={() => setIsJoinModalOpen(true)}
        />
        
        <div className={styles.dashboard__content}>
          {currentOrganization ? (
            <OrganizationContent />
          ) : (
            <div className={styles.dashboard__welcome}>
              <h2>Welcome to Corporate Messenger!</h2>
              <p>Create your first organization or join an existing one to get started.</p>
              <div className={styles.dashboard__actionButtons}>
                <Button 
                  variant="primary" 
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Create Organization
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setIsJoinModalOpen(true)}
                >
                  Join Organization
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Модальное окно создания организации */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Organization"
        size="medium"
      >
        <form onSubmit={handleCreateOrganization} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="orgName" className={styles.formLabel}>
              Organization Name *
            </label>
            <Input
              id="orgName"
              type="text"
              placeholder="Enter organization name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="orgDescription" className={styles.formLabel}>
              Description (optional)
            </label>
            <textarea
              id="orgDescription"
              placeholder="Enter organization description"
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              className={styles.textarea}
              rows={3}
            />
          </div>

          {error && (
            <div className={styles.formError}>
              {error}
            </div>
          )}

          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !orgName.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно вступления в организацию */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join Organization"
        size="small"
      >
        <form onSubmit={handleJoinOrganization} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="inviteCode" className={styles.formLabel}>
              Invite Code *
            </label>
            <Input
              id="inviteCode"
              type="text"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              required
            />
          </div>

          {error && (
            <div className={styles.formError}>
              {error}
            </div>
          )}

          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsJoinModalOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !inviteCode.trim()}
            >
              {isLoading ? 'Joining...' : 'Join Organization'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Dashboard: React.FC = () => {
  return (
    <OrganizationProvider>
      <DashboardContent />
    </OrganizationProvider>
  );
};

export default Dashboard;