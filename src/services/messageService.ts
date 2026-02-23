import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  addDoc,
  doc,
  getDocs,
} from 'firebase/firestore';
import { createDoc } from './firestore/firestoreService';
import { encryptMessage, decryptMessage } from '../lib/crypto'; // ← добавлен decryptMessage

export interface Poll {
  question: string;
  options: string[];
  multiple: boolean;
  expiresAt?: number | null;
}

export interface Message {
  id: string;
  project_id: string;
  sender_id: string;
  text: string;
  created_at: any;
  type?: 'text' | 'photo' | 'poll';
  photo_url?: string;
  poll?: Poll;
  sender_profile?: any;
  parent_id?: string | null;
  replies_count?: number;
}

export const messageService = {
  /**
   * Отправка сообщения с шифрованием
   */
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
      type,
      parent_id: parent_id || null,
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

  /**
   * Подписка на сообщения проекта
   */
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
        .sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));

      callback(messages);
    });
  },

  /**
   * Проверка наличия непрочитанных сообщений
   */
  async sendSystemMessage(projectId: string, text: string): Promise<void> {
    const encryptedText = encryptMessage(text, projectId);

    await createDoc('messages', {
      project_id: projectId,
      text: encryptedText,
      sender_id: 'system',
      type: 'system',
      created_at: new Date(),
    });
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

      const lastVisit = localStorage.getItem(`lastVisit_org_${organizationId}`);
      const lastVisitTime = lastVisit ? new Date(lastVisit).getTime() : 0;

      const messagesQuery = query(
        collection(db, 'messages'),
        where('project_id', 'in', projectIds)
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      return messagesSnapshot.docs.some(doc => {
        const data = doc.data();
        if (data.sender_id === userId) return false;
        const messageTime = data.created_at?.seconds * 1000 || 0;
        return messageTime > lastVisitTime;
      });
    } catch {
      return false;
    }
  },

  /**
   * Отметить все сообщения как прочитанные
   */
  markAsRead(organizationId: string) {
    localStorage.setItem(`lastVisit_org_${organizationId}`, new Date().toISOString());
  },
};