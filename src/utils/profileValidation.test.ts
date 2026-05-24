import {
  PROFILE_DESCRIPTION_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  sanitizeUsernameInput,
  validateFullName,
  validateProfileDescription,
  validateUsername,
} from './profileValidation';

describe('profileValidation', () => {
  describe('sanitizeUsernameInput', () => {
    it('keeps only allowed symbols and trims to max length', () => {
      const source = 'иван!!!_test-user__12345678901234567890';
      const sanitized = sanitizeUsernameInput(source);

      expect(sanitized).toBe('иван_test-user__12345678901234');
      expect(sanitized.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
    });
  });

  describe('validateUsername', () => {
    it('requires a username', () => {
      expect(validateUsername('   ')).toBe('Имя пользователя обязательно');
    });

    it('rejects usernames shorter than 3 characters', () => {
      expect(validateUsername('ab')).toBe('Минимум 3 символа');
    });

    it('rejects invalid characters', () => {
      expect(validateUsername('name!')).toBe('Только буквы, цифры, _, -');
    });

    it('accepts latin, cyrillic, underscores and dashes', () => {
      expect(validateUsername('иван-test_42')).toBeNull();
    });
  });

  describe('validateFullName', () => {
    it('requires a full name', () => {
      expect(validateFullName('')).toBe('Полное имя обязательно');
    });

    it('rejects too short names', () => {
      expect(validateFullName('A')).toBe('Слишком короткое имя');
    });

    it('accepts a valid full name', () => {
      expect(validateFullName('Иван Иванов')).toBeNull();
    });
  });

  describe('validateProfileDescription', () => {
    it('allows empty descriptions', () => {
      expect(validateProfileDescription('')).toBeNull();
    });

    it('rejects descriptions longer than the limit', () => {
      expect(validateProfileDescription('a'.repeat(PROFILE_DESCRIPTION_MAX_LENGTH + 1))).toBe('Не более 240 символов');
    });
  });
});
