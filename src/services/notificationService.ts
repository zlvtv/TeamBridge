import { Omit } from 'react';

// Тип уведомления
export interface Notification {
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
}

// Хранилище уведомлений (в реальности — лучше использовать Firebase)
let notifications: Notification[] = [
];

let notificationUpdater: ((notifications: Notification[]) => void) | null = null;

(window as any).setNotificationUpdater = (updater: (notifications: Notification[]) => void) => {
  notificationUpdater = updater;
  updater([...notifications]); 
};

/**
 * Получение всех уведомлений
 */
export const getNotifications = (): Notification[] => {
  return [...notifications];
};

/**
 * Отметка уведомления как прочитанного
 */
export const markAsRead = (id: string): void => {
  const index = notifications.findIndex(n => n.id === id);
  if (index !== -1) {
    notifications[index] = { ...notifications[index], read: true };
    if (notificationUpdater) {
      notificationUpdater([...notifications]);
    }
  }
};

/**
 * Добавление нового уведомления
 */
export const addNotification = (
  title: string,
  message: string,
  type: Notification['type'] = 'system',
  from: string = 'Система',
  avatar: string | null = null,
  projectId: string | null = null,
  taskId: string | null = null
): void => {
  const newNotification: Notification = {
    id: 'notif_' + Date.now(),
    type,
    title,
    message,
    from,
    avatar,
    time: new Date().toISOString(),
    read: false,
    projectId,
    taskId,
  };

  notifications = [newNotification, ...notifications];

  if (notificationUpdater) {
    notificationUpdater([...notifications]);
  }

  // Показываем браузерное уведомление
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico',
    });
  }
};

/**
 * @deprecated Use addNotification instead
 */
export const sendTaskReminderNotification = (
  userId: string,
  taskId: string,
  taskTitle: string,
  dueDate: Date
) => {
  console.warn('Use addNotification() instead');
  addNotification(
    'Напоминание о задаче',
    `Задача "${taskTitle}" истекает ${dueDate.toLocaleString()}`,
    'task_reminder',
    'Напоминание'
  );
};
