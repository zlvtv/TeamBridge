const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');

admin.initializeApp();

const db = admin.firestore();

const sanitizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 140);

const buildNotificationDocId = (userId, dedupeKey) =>
  `notif_${sanitizeKey(userId)}_${sanitizeKey(dedupeKey)}`;

const formatReminderOffset = (minutes) => {
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

const toMillis = (value) => {
  if (!value) return NaN;
  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? NaN : time;
};

exports.dispatchTaskReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Europe/Moscow',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async () => {
    const now = Date.now();
    const maxLag = 10 * 60 * 1000;

    const tasksSnap = await db.collection('tasks').get();
    if (tasksSnap.empty) return;

    const batch = db.batch();
    let queued = 0;

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data() || {};
      if (!task.project_id || !task.id && !taskDoc.id) continue;
      if (task.status === 'done') continue;
      if (!Array.isArray(task.assignees) || task.assignees.length === 0) continue;

      const dueAt = toMillis(task.due_date);
      if (!Number.isFinite(dueAt)) continue;

      const offsets = Array.isArray(task.reminder_offsets_minutes)
        ? task.reminder_offsets_minutes
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
        : [];

      if (offsets.length === 0) continue;

      for (const offset of offsets) {
        const fireAt = dueAt - offset * 60 * 1000;
        if (now < fireAt || now > dueAt + maxLag) continue;

        for (const userId of task.assignees) {
          const dedupeKey = `task-reminder:${taskDoc.id}:${offset}:${task.due_date}`;
          const notificationRef = db.collection('notifications').doc(buildNotificationDocId(userId, dedupeKey));

          batch.set(
            notificationRef,
            {
              user_id: userId,
              type: 'task_reminder',
              title: 'Напоминание о задаче',
              message: `${formatReminderOffset(offset)} до срока: ${task.title || 'Без названия'}`,
              from: 'Задачи',
              avatar: null,
              time: new Date().toISOString(),
              read: false,
              projectId: task.project_id,
              taskId: taskDoc.id,
              messageId: null,
              dedupe_key: dedupeKey,
              created_at: admin.firestore.FieldValue.serverTimestamp(),
              updated_at: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: false }
          );
          queued += 1;
        }
      }
    }

    if (queued > 0) {
      await batch.commit();
    }
  }
);
