import CryptoJS from 'crypto-js';

const getEncryptionKey = (projectId: string): CryptoJS.lib.WordArray => {
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
    return decrypted || ciphertext;
  } catch {
    return ciphertext;
  }
};
