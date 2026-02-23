import CryptoJS from 'crypto-js';

const getEncryptionKey = (projectId: string): CryptoJS.lib.WordArray => {
  return CryptoJS.SHA256(projectId);
};

export const encryptMessage = (text: string, projectId: string): string => {
  const key = getEncryptionKey(projectId);
  return CryptoJS.AES.encrypt(text, key).toString();
};

export const decryptMessage = (ciphertext: string, projectId: string): string => {
  if (!ciphertext) return '';

  try {
    const key = getEncryptionKey(projectId);
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
};
