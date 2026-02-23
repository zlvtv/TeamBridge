import React, { useState, useEffect } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import ProfileModal from '../../components/modals/profile-modal/profile-modal';
import NotificationsPanel from '../../components/notifications-panel/notifications-panel';
import styles from './settings-panel.module.css';
import { getNotifications, markAsRead } from '../../services/notificationService';

interface Notification {
  id: string;
  type: 'reply' | 'mention' | 'task_reminder';
  title: string;
  message: string;
  from: string;
  avatar: string | null;
  time: string;
  read: boolean;
  projectId: string | null;
  taskId: string | null;
}

const SettingsPanel: React.FC = () => {
  const { theme, toggleTheme, isProfileOpen, openProfile, closeProfile } = useUI();
  const { signOut } = useAuth();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(getNotifications());

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setNotifications(getNotifications());
  }, []);

  useEffect(() => {
    (window as any).setNotificationUpdater = setNotifications;
    
    return () => {
      delete (window as any).setNotificationUpdater;
    };
  }, []);

  const handleThemeClick = () => {
    toggleTheme();
  };

  const handleProfileClick = () => {
    if (isProfileOpen) {
      closeProfile();
    } else {
      openProfile();
    }
  };

  const handleNotificationsClick = () => {
    setIsNotificationsOpen(!isNotificationsOpen);
  };

  const handleSignOut = () => {
    signOut();
  };

  const handleNotificationClick = (notification: Notification) => {
    
    markAsRead(notification.id);
    setNotifications([...notifications]);
    setIsNotificationsOpen(false);
  };

  return (
    <div className={styles['settings-panel']}>
      <button
        className={styles['settings-panel__theme-btn']}
        onClick={handleThemeClick}
        aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      >
        {theme === 'dark' ? '🔆' : '🌙'}
      </button>

      <button
        className={`${styles['settings-panel__notifications-btn']} notifications-button`}
        onClick={handleNotificationsClick}
        aria-label="Уведомления"
      >
        📩
        {unreadCount > 0 && (
          <span className={styles['notifications-badge']}>
            {unreadCount}
          </span>
        )}
      </button>

     <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
      />

      <button
        data-profile-button
        className={styles['settings-panel__avatar-btn']}
        onClick={handleProfileClick}
        aria-label="Профиль"
      >
        👤
      </button>

      {isProfileOpen && <ProfileModal />}
    </div>
  );
};

export default SettingsPanel;
