import {
  createDoc,
  deleteDocById,
  getCollection,
  getDocById,
  setDocById,
  subscribeToCollection,
  updateDocById,
} from './firestore/firestoreService';

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
  messageId?: string | null;
  user_id?: string;
  dedupe_key?: string | null;
}

interface AddNotificationPayload {
  title: string;
  message: string;
  type?: Notification['type'];
  from?: string;
  avatar?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  messageId?: string | null;
  dedupeKey?: string | null;
}

const toNotification = (doc: any): Notification => ({
  id: doc.id,
  type: doc.type || 'system',
  title: doc.title || 'Уведомление',
  message: doc.message || '',
  from: doc.from || 'Система',
  avatar: doc.avatar || null,
  time: typeof doc.time === 'string' ? doc.time : new Date(doc.time || doc.created_at || Date.now()).toISOString(),
  read: !!doc.read,
  projectId: doc.projectId || null,
  taskId: doc.taskId || null,
  messageId: doc.messageId || null,
  user_id: doc.user_id,
  dedupe_key: doc.dedupe_key || null,
});

const sanitizeKey = (value: string) =>
  value
    .toLocaleLowerCase('ru')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 140);

const buildNotificationDocId = (userId: string, dedupeKey: string) =>
  `notif_${sanitizeKey(userId)}_${sanitizeKey(dedupeKey)}`;

export const subscribeUserNotifications = (
  userId: string,
  listener: (notifications: Notification[]) => void
): (() => void) => {
  return subscribeToCollection(
    'notifications',
    (docs) => {
      const notifications = docs
        .map(toNotification)
        .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());
      listener(notifications);
    },
    {
      whereClauses: [{ field: 'user_id', operator: '==', value: userId }],
    }
  );
};

export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  const docs = await getCollection<any>('notifications', {
    whereClauses: [{ field: 'user_id', operator: '==', value: userId }],
  });

  return docs
    .map(toNotification)
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());
};

export const addUserNotification = async (
  userId: string,
  payload: AddNotificationPayload
): Promise<Notification> => {
  const dedupeKey = payload.dedupeKey?.trim() || null;
  const baseData = {
    user_id: userId,
    type: payload.type || 'system',
    title: payload.title,
    message: payload.message,
    from: payload.from || 'Система',
    avatar: payload.avatar || null,
    time: new Date().toISOString(),
    read: false,
    projectId: payload.projectId || null,
    taskId: payload.taskId || null,
    messageId: payload.messageId || null,
    dedupe_key: dedupeKey,
  };

  if (dedupeKey) {
    const docId = buildNotificationDocId(userId, dedupeKey);
    const existing = await getDocById<any>('notifications', docId);
    if (existing) {
      return toNotification(existing);
    }
    await setDocById<any>('notifications', docId, baseData as any);
    const created = await getDocById<any>('notifications', docId);
    return toNotification(created || { id: docId, ...baseData });
  }

  const created = await createDoc<any>('notifications', baseData as any);
  return toNotification(created);
};

export const markNotificationAsRead = async (userId: string, notificationId: string): Promise<void> => {
  const existing = await getDocById<any>('notifications', notificationId);
  if (!existing || existing.user_id !== userId) return;
  await updateDocById('notifications', notificationId, { read: true });
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  const docs = await getCollection<any>('notifications', {
    whereClauses: [{ field: 'user_id', operator: '==', value: userId }],
  });

  await Promise.all(
    docs
      .filter((doc) => !doc.read)
      .map((doc) => updateDocById('notifications', doc.id, { read: true }))
  );
};

export const clearAllUserNotifications = async (userId: string): Promise<void> => {
  const docs = await getCollection<any>('notifications', {
    whereClauses: [{ field: 'user_id', operator: '==', value: userId }],
  });

  await Promise.all(docs.map((doc) => deleteDocById('notifications', doc.id)));
};
