export type PresenceTone = 'online' | 'recent' | 'offline' | 'unknown';

export interface PresenceStatus {
  label: string;
  tone: PresenceTone;
}

export const getPresenceStatus = (value?: string | null): PresenceStatus => {
  if (!value) {
    return {
      label: 'Еще не заходил(а) после обновления',
      tone: 'unknown',
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      label: 'Еще не заходил(а) после обновления',
      tone: 'unknown',
    };
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 2) {
    return { label: 'Онлайн', tone: 'online' };
  }

  if (diffMinutes < 10) {
    return { label: 'В сети недавно', tone: 'recent' };
  }

  if (diffMinutes < 60) {
    return {
      label: `Был(а) в сети ${diffMinutes} мин назад`,
      tone: 'offline',
    };
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return {
      label: `Был(а) в сети ${diffHours} ч назад`,
      tone: 'offline',
    };
  }

  return {
    label: `Был(а) в сети ${date.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    tone: 'offline',
  };
};
