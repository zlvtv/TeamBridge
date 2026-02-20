import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { decryptMessage } from '../lib/crypto';

export interface Message {
  id: string;
  project_id: string;
  sender_id: string;
  text: string;
  created_at: any; // Firestore timestamp
  sender_profile?: any;
}

export const messageService = {
  // Get messages for a project
  async getMessages(projectId: string): Promise<Message[]> {
    const q = query(
      collection(db, 'messages'),
      where('project_id', '==', projectId)
    );
    
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  },

  // Subscribe to real-time message updates
  subscribeToMessages(projectId: string, callback: (messages: Message[]) => void) {
    const q = query(
      collection(db, 'messages'),
      where('project_id', '==', projectId)
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      // Sort messages by creation date
      messages.sort((a, b) => {
        const aTime = a.created_at?.seconds || 0;
        const bTime = b.created_at?.seconds || 0;
        return aTime - bTime;
      });
      
      callback(messages);
    });
  },

  // Send a new message
  async sendMessage(projectId: string, text: string, senderId: string) {
    try {
      const docRef = await addDoc(collection(db, 'messages'), {
        project_id: projectId,
        text: text,
        sender_id: senderId,
        created_at: serverTimestamp(),
      });
      
      return {
        id: docRef.id,
        project_id: projectId,
        text: text,
        sender_id: senderId,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Check if organization has unread messages
  async hasUnreadMessages(organizationId: string, userId: string): Promise<boolean> {
    // Get all projects for the organization
    const projectsQuery = query(
      collection(db, 'projects'),
      where('organization_id', '==', organizationId)
    );
    
    try {
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectIds = projectsSnapshot.docs.map(doc => doc.id);
      
      if (projectIds.length === 0) return false;
      
      // Get the last read timestamp for the user in this organization
      // For now, we'll use a simple approach - check if there are any messages 
      // created after the user's last visit to any project in this organization
      const lastVisit = localStorage.getItem(`lastVisit_org_${organizationId}`);
      const lastVisitTime = lastVisit ? new Date(lastVisit).getTime() : 0;
      
      // Check messages in all projects
      const messagesQuery = query(
        collection(db, 'messages'),
        where('project_id', 'in', projectIds)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      
      return messagesSnapshot.docs.some(doc => {
        const messageData = doc.data();
        // Skip messages from the current user
        if (messageData.sender_id === userId) return false;
        
        const messageTime = messageData.created_at?.seconds * 1000 || 0;
        return messageTime > lastVisitTime;
      });
    } catch (error) {
      console.error('Error checking unread messages:', error);
      return false;
    }
  },

  // Mark all messages in organization as read
  markAsRead(organizationId: string) {
    localStorage.setItem(`lastVisit_org_${organizationId}`, new Date().toISOString());
  }
};
