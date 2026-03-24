import { db } from '../lib/firebase';
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs,
  getDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { createDoc, deleteDocById, getDocById } from './firestore/firestoreService';
import { encryptMessage, decryptMessage } from '../lib/crypto';
import { getCommonProjectId, touchOrganizationActivityByProject } from './activityService';

export interface Poll {
  question: string;
  options: string[];
  multiple: boolean;
  expiresAt?: number | null;
}

interface PollOptionStored {
  text: string;
  votes: string[];
}

const PHOTO_UPLOAD_MAX_SIDE = 1280;
const PHOTO_UPLOAD_TARGET_BYTES = 550 * 1024;
const PHOTO_UPLOAD_JPEG_QUALITY = 0.72;

export interface Message {
  id: string;
  project_id: string;
  task_id?: string | null;
  sender_id: string;
  text: string;
  created_at: any;
  type?: 'text' | 'photo' | 'poll';
  photo_url?: string;
  poll?: Poll;
  sender_profile?: any;
  parent_id?: string | null;
  replies_count?: number;
  created_at_client?: string;
  read_by?: string[];
}

const getMessageTimestamp = (message: any): number => {
  if (!message) return 0;

  const createdAt = message.created_at;
  if (createdAt?.seconds) return createdAt.seconds * 1000;
  if (typeof createdAt?.toDate === 'function') return createdAt.toDate().getTime();
  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt === 'string') {
    const parsed = new Date(createdAt).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (typeof message.created_at_client === 'string') {
    const parsed = new Date(message.created_at_client).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }

  return 0;
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось загрузить изображение'));
    };

    image.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Не удалось подготовить изображение'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(file);
  });

const compressImageForUpload = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  const image = await loadImageFromFile(file);
  const needsResize =
    image.width > PHOTO_UPLOAD_MAX_SIDE ||
    image.height > PHOTO_UPLOAD_MAX_SIDE;
  const needsCompression = file.size > 280 * 1024;

  if (!needsResize && !needsCompression) {
    return file;
  }

  const ratio = Math.min(1, PHOTO_UPLOAD_MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const outputType = 'image/jpeg';
  const blob = await canvasToBlob(canvas, outputType, PHOTO_UPLOAD_JPEG_QUALITY);
  const outputExtension = 'jpg';

  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, '') + `.${outputExtension}`,
    { type: outputType, lastModified: Date.now() }
  );
};

export const messageService = {
  async sendMessage(
    projectId: string,
    text: string,
    senderId: string,
    type: 'text' | 'photo' | 'poll' = 'text',
    photo_url?: string,
    poll?: Poll,
    parent_id?: string | null
  ) {
    const encryptedText = encryptMessage(text, projectId);

    const messageData: any = {
      project_id: projectId,
      text: encryptedText,
      sender_id: senderId,
      created_at: serverTimestamp(),
      created_at_client: new Date().toISOString(),
      type,
      parent_id: parent_id || null,
      read_by: [senderId],
    };

    if (type === 'photo' && photo_url) {
      messageData.photo_url = photo_url;
    }

    if (type === 'poll' && poll) {
      messageData.poll = {
        ...poll,
        options: poll.options.map(option => ({ text: option, votes: [] })),
      };
    }

    const docRef = await createDoc('messages', messageData);
    await touchOrganizationActivityByProject(projectId);

    return {
      id: docRef.id,
      project_id: projectId,
      text,
      sender_id: senderId,
      created_at: new Date().toISOString(),
      type,
      parent_id,
      ...(photo_url && { photo_url }),
      ...(poll && { poll: { ...poll, options: poll.options.map(o => ({ text: o, votes: [] })) } }),
    };
  },

  subscribeToMessages(projectId: string, callback: (messages: Message[]) => void) {
    const q = query(collection(db, 'messages'), where('project_id', '==', projectId));

    return onSnapshot(q, snapshot => {
      const messages = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            text: data.text ? decryptMessage(data.text, projectId) : '',
          };
        })
        .filter((message) => !message.task_id)
        .sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));

      callback(messages);
    });
  },

  async sendSystemMessage(projectId: string, text: string): Promise<void> {
    const encryptedText = encryptMessage(text, projectId);

    await createDoc('messages', {
      project_id: projectId,
      text: encryptedText,
      sender_id: 'system',
      type: 'system',
      created_at: serverTimestamp(),
      created_at_client: new Date().toISOString(),
    });
    await touchOrganizationActivityByProject(projectId);
  },

  async sendOrganizationSystemMessage(organizationId: string, text: string): Promise<void> {
    const commonProjectId = await getCommonProjectId(organizationId);
    if (!commonProjectId) return;
    await this.sendSystemMessage(commonProjectId, text);
  },

  async hasUnreadMessages(organizationId: string, userId: string): Promise<boolean> {
    const projectsQuery = query(
      collection(db, 'projects'),
      where('organization_id', '==', organizationId)
    );

    try {
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectIds = projectsSnapshot.docs.map(d => d.id);
      if (projectIds.length === 0) return false;
      const unreadByProject = await Promise.all(
        projectIds.map(async (projectId) => this.hasUnreadProjectMessages(projectId, userId))
      );
      return unreadByProject.some(Boolean);
    } catch {
      return false;
    }
  },

  async hasUnreadProjectMessages(projectId: string, userId: string): Promise<boolean> {
    if (!projectId) return false;
    const lastVisit = localStorage.getItem(`lastVisit_project_${projectId}`);
    const lastVisitTime = lastVisit ? new Date(lastVisit).getTime() : 0;

    try {
      const q = query(collection(db, 'messages'), where('project_id', '==', projectId));
      const snapshot = await getDocs(q);
      return snapshot.docs.some(docItem => {
        const data = docItem.data();
        if (data.sender_id === userId) return false;
        const messageTime = getMessageTimestamp(data);
        return messageTime > lastVisitTime;
      });
    } catch {
      return false;
    }
  },

  async deleteMessage(messageId: string): Promise<void> {
    const message = await getDocById<any>('messages', messageId);
    if (!message) return;

    await deleteDocById('messages', messageId);
    await touchOrganizationActivityByProject(message.project_id);
  },

  async uploadPhoto(projectId: string, senderId: string, file: File): Promise<string> {
    const preparedFile = await compressImageForUpload(file);
    return await fileToDataUrl(preparedFile);
  },

  async voteInPoll(messageId: string, userId: string, optionIndex: number): Promise<void> {
    const messageRef = doc(db, 'messages', messageId);
    const snap = await getDoc(messageRef);
    if (!snap.exists()) return;

    const data = snap.data() as any;
    if (data.type !== 'poll' || !data.poll || !Array.isArray(data.poll.options)) return;
    if (data.poll.expiresAt && Number(data.poll.expiresAt) <= Date.now()) return;

    const options: PollOptionStored[] = data.poll.options.map((opt: any) => ({
      text: String(opt?.text ?? ''),
      votes: Array.isArray(opt?.votes) ? opt.votes.filter(Boolean) : [],
    }));
    if (!options[optionIndex]) return;

    const multiple = !!data.poll.multiple;
    const nextOptions = options.map((opt) => ({
      ...opt,
      votes: opt.votes.filter(v => v !== userId),
    }));

    if (multiple) {
      const alreadyVoted = options[optionIndex].votes.includes(userId);
      if (!alreadyVoted) {
        nextOptions[optionIndex].votes.push(userId);
      }
    } else {
      nextOptions[optionIndex].votes.push(userId);
    }

    await updateDoc(messageRef, {
      poll: {
        ...data.poll,
        options: nextOptions,
      },
      updated_at: serverTimestamp(),
    });
    await touchOrganizationActivityByProject(data.project_id);
  },

  async markProjectMessagesAsRead(projectId: string, userId: string): Promise<void> {
    if (!projectId || !userId) return;
    const q = query(collection(db, 'messages'), where('project_id', '==', projectId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    let updated = 0;

    snapshot.docs.forEach((messageDoc) => {
      const data = messageDoc.data() as any;
      if (data?.sender_id === userId) return;
      const readBy = Array.isArray(data?.read_by) ? data.read_by : [];
      if (readBy.includes(userId)) return;
      batch.update(messageDoc.ref, { read_by: arrayUnion(userId) });
      updated += 1;
    });

    if (updated > 0) {
      await batch.commit();
    }
  },

  markAsRead(organizationId: string) {
    localStorage.setItem(`lastVisit_org_${organizationId}`, new Date().toISOString());
  },

  markProjectAsRead(projectId: string) {
    localStorage.setItem(`lastVisit_project_${projectId}`, new Date().toISOString());
  },
};
