import React, { useEffect, useRef, useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useProject } from '../../contexts/ProjectContext';
import NotificationsPanel from '../../components/notifications-panel/notifications-panel';
import EditProfileModal from '../../components/modals/edit-profile-modal/edit-profile-modal';
import styles from './settings-panel.module.css';
import {
  addUserNotification,
  clearAllUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeUserNotifications,
} from '../../services/notificationService';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { decryptMessage } from '../../lib/crypto';
import { taskService } from '../../services/taskService';

const formatReminderOffset = (minutes: number) => {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return `за ${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;
  }

  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `за ${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`;
  }

  return `за ${minutes} мин`;
};

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

interface SettingsPanelProps {
  compactMobileList?: boolean;
  onAction?: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ compactMobileList = false, onAction }) => {
  const { theme, toggleTheme, isModalOpen, openModal, closeModal } = useUI();
  const { user } = useAuth();
  const { organizations, setCurrentOrganization } = useOrganization();
  const { projects, setCurrentProject } = useProject();
  const navigate = useNavigate();
  const mentionSeenRef = useRef<Set<string>>(new Set());
  const organizationsRef = useRef(organizations);
  const projectsRef = useRef(projects);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const isProfileOpen = isModalOpen('profile');

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    const unsubscribe = subscribeUserNotifications(user.id, setNotifications);
    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    organizationsRef.current = organizations;
  }, [organizations]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    if (!user?.id) return;
    const seenStorageKey = `mentions_seen_${user.id}`;
    try {
      const raw = localStorage.getItem(seenStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      mentionSeenRef.current = new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      mentionSeenRef.current = new Set();
    }

    const persistSeen = () => {
      const values = Array.from(mentionSeenRef.current);
      const capped = values.slice(Math.max(0, values.length - 4000));
      localStorage.setItem(seenStorageKey, JSON.stringify(capped));
    };

    let projectUnsubs: Array<() => void> = [];
    let destroyed = false;

    const cleanupProjectSubs = () => {
      projectUnsubs.forEach((unsub) => unsub());
      projectUnsubs = [];
    };

    const isMentionForCurrentUser = (text: string, projectId: string, senderId: string): boolean => {
      if (!user?.id || !text || senderId === user.id) return false;
      const tokens = Array.from(text.matchAll(/@([a-zA-Z0-9_а-яА-ЯёЁ:-]+)/g)).map(m => m[1].toLowerCase());
      if (tokens.length === 0) return false;
      if (tokens.includes('all')) return true;

      const myUsername = (user.username || '').toLowerCase();
      if (myUsername && tokens.includes(myUsername)) return true;

      const project = projectsRef.current.find(item => item.id === projectId);
      const org = organizationsRef.current.find(item => item.id === project?.organization_id);
      const member = org?.organization_members?.find(item => item.user_id === user.id);
      if (!member) return false;

      const myStatus = (member.status || '').toLowerCase();
      const myRoles = new Set((member.roles || []).map(role => role.toLowerCase()));
      return tokens.some(token => {
        const normalized = token.startsWith('role:') ? token.slice(5) : token;
        if (normalized === myStatus) return true;
        if (myRoles.has(normalized)) return true;
        return false;
      });
    };

    const subscribeToMentions = (projectIds: string[]) => {
      cleanupProjectSubs();
      if (!projectIds.length) return;

      projectIds.forEach((projectId) => {
        let initialized = false;
        const q = query(collection(db, 'messages'), where('project_id', '==', projectId));
        const unsub = onSnapshot(q, (snapshot) => {
          if (destroyed) return;

          if (!initialized) {
            snapshot.docs.forEach((messageDoc) => {
              mentionSeenRef.current.add(messageDoc.id);
            });
            persistSeen();
            initialized = true;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            const messageId = change.doc.id;
            if (mentionSeenRef.current.has(messageId)) return;

            const data: any = change.doc.data();
            const projectId = String(data.project_id || '');
            const senderId = String(data.sender_id || '');
            const type = String(data.type || 'text');
            if (!projectId || !senderId || type === 'system') {
              mentionSeenRef.current.add(messageId);
              return;
            }

            let text = '';
            try {
              text = data.text ? decryptMessage(data.text, projectId) : '';
            } catch {
              text = String(data.text || '');
            }

            if (!isMentionForCurrentUser(text, projectId, senderId)) {
              mentionSeenRef.current.add(messageId);
              return;
            }

            const senderName =
              data.sender_profile?.full_name ||
              data.sender_profile?.username ||
              'Участник';

            void addUserNotification(user.id, {
              title: 'Вас упомянули',
              message: `${senderName}: ${String(text || '').slice(0, 120)}`,
              type: 'mention',
              from: senderName,
              avatar: data.sender_profile?.avatar_url || null,
              projectId,
              taskId: null,
              messageId,
              dedupeKey: `mention:${messageId}`,
            });

            mentionSeenRef.current.add(messageId);
            persistSeen();
          });
        });
        projectUnsubs.push(unsub);
      });
    };

    const membersQuery = query(collection(db, 'project_members'), where('user_id', '==', user.id));
    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      if (destroyed) return;
      const projectIds = Array.from(
        new Set(snapshot.docs.map((item) => String(item.data().project_id || '')).filter(Boolean))
      );

      subscribeToMentions(projectIds);
    });

    return () => {
      destroyed = true;
      unsubscribeMembers();
      cleanupProjectSubs();
    };
  }, [user?.id, user?.username]);

  useEffect(() => {
    if (!user?.id || organizations.length === 0) return;

    const storageKey = `task_reminders_seen_${user.id}`;
    let destroyed = false;
    let isChecking = false;

    const readSeenKeys = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch {
        return new Set<string>();
      }
    };

    const persistSeenKeys = (keys: Set<string>) => {
      const values = Array.from(keys);
      localStorage.setItem(storageKey, JSON.stringify(values.slice(Math.max(0, values.length - 4000))));
    };

    const checkTaskReminders = async () => {
      if (isChecking || destroyed) return;
      isChecking = true;

      try {
        const orgIds = organizations.map((org) => org.id).filter(Boolean);
        if (orgIds.length === 0) return;

        const seenKeys = readSeenKeys();
        const tasks = await taskService.getUserTasks(user.id, orgIds);
        const now = Date.now();

        for (const task of tasks) {
          if (!task?.id || !task?.project_id || !task?.due_date || task.status === 'done') continue;
          const dueAt = new Date(task.due_date).getTime();
          if (Number.isNaN(dueAt)) continue;

          const offsets = Array.isArray(task.reminder_offsets_minutes)
            ? task.reminder_offsets_minutes.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
            : [];

          for (const offset of offsets) {
            const reminderKey = `${task.id}:${offset}:${task.due_date}`;
            if (seenKeys.has(reminderKey)) continue;

            const fireAt = dueAt - offset * 60 * 1000;
            const maxLag = 5 * 60 * 1000;
            if (now < fireAt || now > dueAt + maxLag) continue;

            void addUserNotification(user.id, {
              title: 'Напоминание о задаче',
              message: `${formatReminderOffset(offset)} до срока: ${task.title}`,
              type: 'task_reminder',
              from: 'Задачи',
              avatar: null,
              projectId: task.project_id,
              taskId: task.id,
              messageId: null,
              dedupeKey: `task-reminder:${task.id}:${offset}:${task.due_date}`,
            });

            seenKeys.add(reminderKey);
          }
        }

        persistSeenKeys(seenKeys);
      } finally {
        isChecking = false;
      }
    };

    void checkTaskReminders();
    const intervalId = window.setInterval(() => {
      void checkTaskReminders();
    }, 60000);

    return () => {
      destroyed = true;
      window.clearInterval(intervalId);
    };
  }, [organizations, user?.id]);

  const handleThemeClick = () => {
    onAction?.();
    toggleTheme();
  };

  const handleProfileClick = () => {
    if (isProfileOpen) {
      closeModal('profile');
    } else {
      openModal('profile');
    }
  };

  const handleNotificationsClick = () => {
    const next = !isNotificationsOpen;
    setIsNotificationsOpen(next);
    if (next && user?.id) {
      void markAllNotificationsAsRead(user.id);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (user?.id) {
      await markNotificationAsRead(user.id, notification.id);
    }
    setIsNotificationsOpen(false);

    if (!notification.projectId) return;

    const cachedProject = projects.find(project => project.id === notification.projectId);
    let organizationId = cachedProject?.organization_id || '';

    if (!organizationId) {
      try {
        const projectSnap = await getDoc(doc(db, 'projects', notification.projectId));
        if (projectSnap.exists()) {
          organizationId = String(projectSnap.data().organization_id || '');
        }
      } catch {
        organizationId = '';
      }
    }

    if (organizationId) {
      const organization = organizations.find(org => org.id === organizationId);
      if (organization) {
        setCurrentOrganization(organization);
      }
      localStorage.setItem('currentOrgId', organizationId);
    }

    localStorage.setItem('currentProjectId', notification.projectId);
    if (cachedProject) {
      setCurrentProject(cachedProject as any);
    }
    if (notification.taskId) {
      localStorage.setItem('focusTaskId', notification.taskId);
    } else {
      localStorage.removeItem('focusTaskId');
    }
    if (notification.messageId) {
      localStorage.setItem('focusMessageId', notification.messageId);
      localStorage.setItem('focusMessageProjectId', notification.projectId);
    } else {
      localStorage.removeItem('focusMessageId');
      localStorage.removeItem('focusMessageProjectId');
    }
    navigate('/dashboard');
  };

  return (
    <div className={`${styles['settings-panel']} ${compactMobileList ? styles['settings-panel--compact-mobile-list'] : ''}`}>
      <button
        className={styles['settings-panel__theme-btn']}
        onClick={handleThemeClick}
        aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      >
        {theme === 'dark' ? '🔆' : '🌙'}
        {compactMobileList && <span className={styles['settings-panel__label']}>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>}
      </button>

      <button
        className={`${styles['settings-panel__notifications-btn']} notifications-button`}
        onClick={handleNotificationsClick}
        aria-label="Уведомления"
      >
        📩
        {compactMobileList && <span className={styles['settings-panel__label']}>Уведомления</span>}
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
        onClearAll={() => {
          if (user?.id) {
            void clearAllUserNotifications(user.id);
          }
        }}
      />

      <button
        data-profile-button
        className={styles['settings-panel__avatar-btn']}
        onClick={handleProfileClick}
        aria-label="Профиль"
      >
        👤
        {compactMobileList && <span className={styles['settings-panel__label']}>Профиль</span>}
      </button>

      {isProfileOpen && (
        <EditProfileModal
          isOpen={isProfileOpen}
          onClose={() => closeModal('profile')}
        />
      )}
    </div>
  );
};

export default SettingsPanel;
