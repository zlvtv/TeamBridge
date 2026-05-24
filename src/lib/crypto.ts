import CryptoJS from 'crypto-js';

// Захардкоженный пеппер — использовался до появления VITE_MESSAGE_PEPPER.
// Хранится здесь только для обратной совместимости при расшифровке старых сообщений.
const LEGACY_PEPPER = 'teambridge-message-default-pepper';
const APP_PEPPER = String(import.meta.env.VITE_MESSAGE_PEPPER || LEGACY_PEPPER);

// Новый ключ использует PBKDF2 с секретным пеппером из env
const deriveKey = (projectId: string, pepper: string): CryptoJS.lib.WordArray => {
  return CryptoJS.PBKDF2(`${projectId}:${pepper}`, pepper, {
    keySize: 256 / 32,
    iterations: 1200,
  });
};

const getEncryptionKey = (projectId: string): CryptoJS.lib.WordArray =>
  deriveKey(String(projectId || ''), APP_PEPPER);

// Ключ для сообщений, зашифрованных LEGACY_PEPPER (до установки VITE_MESSAGE_PEPPER)
const getLegacyPbkdf2Key = (projectId: string): CryptoJS.lib.WordArray =>
  deriveKey(String(projectId || ''), LEGACY_PEPPER);

// Самый старый вариант ключа — просто SHA256(projectId), без пеппера вообще
const getOldestLegacyKey = (projectId: string): CryptoJS.lib.WordArray =>
  CryptoJS.SHA256(String(projectId || ''));

const tryDecrypt = (ciphertext: string, key: CryptoJS.lib.WordArray): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
};

export const encryptMessage = (text: string, projectId: string): string => {
  try {
    const key = getEncryptionKey(projectId);
    return CryptoJS.AES.encrypt(String(text ?? ''), key).toString();
  } catch {
    return String(text ?? '');
  }
};

/**
 * Расшифровывает сообщение, перебирая все известные версии ключа по порядку:
 *
 * 1. Текущий ключ: PBKDF2(projectId, APP_PEPPER) — новые сообщения
 * 2. PBKDF2(projectId, LEGACY_PEPPER) — сообщения до установки VITE_MESSAGE_PEPPER
 * 3. SHA256(projectId) — самые старые сообщения (первая версия шифрования)
 *
 * Если ни один ключ не подошёл — возвращает исходную строку (не ломает UI).
 */
export const decryptMessage = (ciphertext: string, projectId: string): string => {
  if (!ciphertext) return '';

  // Шаг 1: текущий ключ (новые сообщения)
  const current = tryDecrypt(ciphertext, getEncryptionKey(projectId));
  if (current) return current;

  // Шаг 2: PBKDF2 с захардкоженным пеппером (сообщения без VITE_MESSAGE_PEPPER)
  // Пропускаем если APP_PEPPER уже равен LEGACY_PEPPER — ключ тот же, повтор не нужен
  if (APP_PEPPER !== LEGACY_PEPPER) {
    const legacyPbkdf2 = tryDecrypt(ciphertext, getLegacyPbkdf2Key(projectId));
    if (legacyPbkdf2) return legacyPbkdf2;
  }

  // Шаг 3: SHA256 без пеппера (самые старые сообщения)
  const oldest = tryDecrypt(ciphertext, getOldestLegacyKey(projectId));
  if (oldest) return oldest;

  // Ни один ключ не подошёл — возвращаем как есть, UI не ломается
  return ciphertext;
};
