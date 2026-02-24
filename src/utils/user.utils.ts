export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  description: string | null;
}

export const buildUserFromSnapshot = (userSnap: any, userId: string): User => {
  if (!userSnap) {
    const fallbackUsername = `Пользователь ${userId.slice(-5)}`;
    return {
      id: userId,
      email: '',
      username: fallbackUsername,
      full_name: fallbackUsername,
      avatar_url: null,
      description: ''
    };
  }

  return {
    id: userId,
    email: userSnap.email || '',
    username: userSnap.username || userSnap.email?.split('@')[0] || `user_${userId.slice(-5)}`,
    full_name: userSnap.full_name || userSnap.username || userSnap.email?.split('@')[0] || `Пользователь ${userId.slice(-5)}`,
    avatar_url: userSnap.avatar_url || null,
    description: userSnap.description || null,
  };
};
