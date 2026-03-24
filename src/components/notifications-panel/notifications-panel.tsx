import React, { useEffect, useRef } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import Button from '../ui/button/button';
import styles from './notifications-panel.module.css';

interface Notification {
  id: string;
  type: 'reply' | 'mention' | 'task_reminder' | 'system';
  title: string;
  message: string;
  from: string;
  avatar: string | null;
  time: string;
  read: boolean;
  projectId: string | null;
  taskId: string | null;
  messageId?: string | null;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onClearAll: () => void;
}

let notificationsEnabled = false;

export const setNotificationsEnabled = (enabled: boolean) => {
  notificationsEnabled = enabled;
};

const showBrowserNotification = (notification: Notification) => {
  if (notificationsEnabled && Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
    });
  }
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
  onClearAll,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextSeen = new Set(seenNotificationIdsRef.current);
    const newUnreadNotifications = notifications.filter((n) => !n.read && !nextSeen.has(n.id));
    if (newUnreadNotifications.length > 0) {
      showBrowserNotification(newUnreadNotifications[0]);
    }
    notifications.forEach((notification) => nextSeen.add(notification.id));
    seenNotificationIdsRef.current = nextSeen;
  }, [notifications]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Уведомления (${notifications.length})`} maxWidth={560}>
      <div className={styles['notifications-panel__actions']}>
        <Button variant="ghost" size="small" onClick={onClearAll}>
          Очистить все
        </Button>
        <span className={styles['notifications-panel__meta']}>Непрочитанные: {unreadCount}</span>
      </div>
      <div className={styles['notifications-panel__list']}>
        {notifications.length === 0 ? (
          <div className={styles['notifications-panel__empty']}>Нет уведомлений</div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`${styles['notifications-panel__item']} ${
                notification.read ? styles['notifications-panel__read'] : ''
              }`}
              onClick={() => onNotificationClick(notification)}
            >
              <div className={styles['notifications-panel__content']}>
                <div className={styles['notifications-panel__avatar']}>
                  {notification.from.charAt(0)}
                </div>
                <div className={styles['notifications-panel__text']}>
                  <h3 className={styles['notifications-panel__title']}>
                    {notification.title}
                  </h3>
                  <p className={styles['notifications-panel__message']}>
                    {notification.message}
                  </p>
                  <p className={styles['notifications-panel__time']}>
                    {notification.time}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};

export default NotificationsPanel;
