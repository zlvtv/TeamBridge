import CryptoJS from 'crypto-js';

const LEGACY_PEPPER = 'teambridge-message-default-pepper';
const APP_PEPPER = String(import.meta.env.VITE_MESSAGE_PEPPER || LEGACY_PEPPER);

const deriveKey = (projectId: string, pepper: string): CryptoJS.lib.WordArray => {
  return CryptoJS.PBKDF2(`${projectId}:${pepper}`, pepper, {
    keySize: 256 / 32,
    iterations: 1200,
  });
};

const getEncryptionKey = (projectId: string): CryptoJS.lib.WordArray => {
  return deriveKey(String(projectId || ''), APP_PEPPER);
};

const getLegacyEncryptionKey = (projectId: string): CryptoJS.lib.WordArray => {
  return CryptoJS.SHA256(String(projectId || ''));
};

export const encryptMessage = (text: string, projectId: string): string => {
  try {
    const key = getEncryptionKey(projectId);
    return CryptoJS.AES.encrypt(String(text ?? ''), key).toString();
  } catch {
    return String(text ?? '');
  }
};

export const decryptMessage = (ciphertext: string, projectId: string): string => {
  if (!ciphertext) return '';

  try {
    const key = getEncryptionKey(projectId);
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) return decrypted;

    const legacyKey = getLegacyEncryptionKey(projectId);
    const legacyBytes = CryptoJS.AES.decrypt(ciphertext, legacyKey);
    const legacyDecrypted = legacyBytes.toString(CryptoJS.enc.Utf8);
    return legacyDecrypted || ciphertext;
  } catch {
    return ciphertext;
  }
};
