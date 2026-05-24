import { buildUserFromSnapshot, DELETED_USER_LABEL, isDeletedUserProfile } from './user.utils';

describe('user.utils', () => {
  describe('isDeletedUserProfile', () => {
    it('recognizes deleted profiles by username or full name', () => {
      expect(isDeletedUserProfile({ username: 'Удаленный пользователь' })).toBe(true);
      expect(isDeletedUserProfile({ full_name: 'Удаленный пользователь' })).toBe(true);
      expect(isDeletedUserProfile({ username: 'active_user' })).toBe(false);
    });
  });

  describe('buildUserFromSnapshot', () => {
    it('creates a deleted-user fallback when snapshot is missing', () => {
      expect(buildUserFromSnapshot(null, 'user-1')).toEqual({
        id: 'user-1',
        email: '',
        username: DELETED_USER_LABEL,
        full_name: DELETED_USER_LABEL,
        avatar_url: null,
        description: '',
        last_seen_at: null,
      });
    });

    it('normalizes firebase timestamp-like values', () => {
      const result = buildUserFromSnapshot(
        {
          email: 'ivan@example.com',
          username: 'ivan',
          full_name: 'Иван Иванов',
          avatar_url: null,
          description: 'Frontend',
          last_seen_at: {
            toDate: () => new Date('2026-03-24T08:00:00.000Z'),
          },
        },
        'user-2'
      );

      expect(result.last_seen_at).toBe('2026-03-24T08:00:00.000Z');
      expect(result.username).toBe('ivan');
      expect(result.full_name).toBe('Иван Иванов');
    });
  });
});
