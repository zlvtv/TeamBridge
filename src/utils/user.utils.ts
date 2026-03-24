export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  description: string | null;
  last_seen_at?: string | null;
}

export const DELETED_USER_LABEL = 'Удаленный пользователь';

export const isDeletedUserProfile = (userLike: {
  username?: string | null;
  full_name?: string | null;
} | null | undefined) => {
  const username = String(userLike?.username || '').trim().toLowerCase();
  const fullName = String(userLike?.full_name || '').trim().toLowerCase();
  return username === DELETED_USER_LABEL.toLowerCase() || fullName === DELETED_USER_LABEL.toLowerCase();
};

const normalizeDateValue = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return null;
};

export const buildUserFromSnapshot = (userSnap: any, userId: string): User => {
  if (!userSnap) {
    const fallbackUsername = DELETED_USER_LABEL;
    return {
      id: userId,
      email: '',
      username: fallbackUsername,
      full_name: fallbackUsername,
      avatar_url: null,
      description: '',
      last_seen_at: null,
    };
  }

  return {
    id: userId,
    email: userSnap.email || '',
    username: userSnap.username || userSnap.email?.split('@')[0] || DELETED_USER_LABEL,
    full_name: userSnap.full_name || userSnap.username || userSnap.email?.split('@')[0] || DELETED_USER_LABEL,
    avatar_url: userSnap.avatar_url || null,
    description: userSnap.description || null,
    last_seen_at: normalizeDateValue(userSnap.last_seen_at),
  };
};
