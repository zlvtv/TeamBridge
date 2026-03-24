export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 60;
export const PROFILE_DESCRIPTION_MAX_LENGTH = 240;

const USERNAME_ALLOWED_PATTERN = /^[a-zA-Z0-9_а-яА-ЯёЁ-]+$/;
const USERNAME_SANITIZE_PATTERN = /[^a-zA-Z0-9_а-яА-ЯёЁ-]/g;

export const sanitizeUsernameInput = (value: string) =>
  value.replace(USERNAME_SANITIZE_PATTERN, '').slice(0, USERNAME_MAX_LENGTH);

export const validateUsername = (username: string): string | null => {
  const trimmed = username.trim();

  if (!trimmed) {
    return 'Имя пользователя обязательно';
  }

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return `Минимум ${USERNAME_MIN_LENGTH} символа`;
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return `Не более ${USERNAME_MAX_LENGTH} символов`;
  }

  if (!USERNAME_ALLOWED_PATTERN.test(trimmed)) {
    return 'Только буквы, цифры, _, -';
  }

  return null;
};

export const validateFullName = (name: string): string | null => {
  const trimmed = name.trim();

  if (!trimmed) {
    return 'Полное имя обязательно';
  }

  if (trimmed.length < FULL_NAME_MIN_LENGTH) {
    return 'Слишком короткое имя';
  }

  if (trimmed.length > FULL_NAME_MAX_LENGTH) {
    return 'Слишком длинное имя';
  }

  return null;
};

export const validateProfileDescription = (description: string): string | null => {
  if (description.trim().length > PROFILE_DESCRIPTION_MAX_LENGTH) {
    return `Не более ${PROFILE_DESCRIPTION_MAX_LENGTH} символов`;
  }

  return null;
};
