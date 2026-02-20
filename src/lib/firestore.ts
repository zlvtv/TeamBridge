import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  getDocsFromServer,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';

const buildUserFromSnapshot = (userSnap: any, userId: string) => {
  if (!userSnap) {
    const fallbackUsername = 'Пользователь';
    return {
      id: userId,
      email: '',
      username: fallbackUsername,
      full_name: fallbackUsername,
      avatar_url: null,
    };
  }

  return {
    id: userId,
    email: userSnap.email || '',
    username: userSnap.username || userSnap.email?.split('@')[0] || 'Пользователь',
    full_name: userSnap.full_name || userSnap.username || userSnap.email?.split('@')[0] || 'Пользователь',
    avatar_url: userSnap.avatar_url || null,
  };
};

export const getCollection = async (collectionName: string) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getDocsByQuery = async (collectionName: string, q: any) => {
  try {
    const querySnapshot = await getDocsFromServer(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err: any) {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

export const getDocById = async (collectionName: string, id: string) => {
  const ref = doc(collection(db, collectionName), id);
  try {
    const docSnap = await getDocFromServer(ref);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    const docSnap = await getDoc(ref);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }
};

export const createDoc = async (collectionName: string, data: any) => {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, ...data };
};

export const updateDocById = async (collectionName: string, id: string, data: any) => {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
};

export const deleteDocById = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};

export const subscribeToMessages = (projectId: string, callback: (messages: any[]) => void) => {
  const q = query(collection(db, 'messages'), where('project_id', '==', projectId));
  return onSnapshot(q, async snapshot => {
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        sender_profile: data.sender_profile
      };
    });
    
    // Sort messages by creation date
    messages.sort((a, b) => {
      const aTime = a.created_at?.seconds || 0;
      const bTime = b.created_at?.seconds || 0;
      return aTime - bTime;
    });
    
    callback(messages);
    
    // Mark messages as read if they belong to current user
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      const userId = JSON.parse(currentUser).id;
      const batch = writeBatch(db);
      let hasUnread = false;
      
      messages.forEach(msg => {
        if (msg.sender_id === userId && !msg.read) {
          const msgRef = doc(db, 'messages', msg.id);
          batch.update(msgRef, { read: true });
          hasUnread = true;
        }
      });
      
      if (hasUnread) {
        await batch.commit();
      }
    }
  });
};

export const getProjects = async (orgId: string) => {
  const q = query(collection(db, 'projects'), where('orgId', '==', orgId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createProject = async (orgId: string, name: string, description?: string) => {
  const docRef = await addDoc(collection(db, 'projects'), {
    name,
    description: description || null,
    orgId,
    createdBy: 'user-1',
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id };
};

export const addMessage = async (projectId: string, text: string, senderId: string) => {
    await addDoc(collection(db, 'messages'), {
    text: encryptedText,
    sender_id: userId,
    project_id: projectId,  
    created_at: serverTimestamp(),
  });
};

export const getMessages = async (projectId: string) => {
  const q = query(collection(db, 'messages'), where('project_id', '==', projectId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createTask = async (taskData: CreateTaskData) => {
  const status = taskData.status || 'todo';
  const priority = taskData.priority || 'medium';
  const assignee_ids = taskData.assignee_ids || [];
  const tags = taskData.tags || [];
  
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...taskData,
    status,
    priority,
    assignee_ids,
    tags, 
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    created_by: assignee_ids?.[0] || '',
  });

  return { 
    id: docRef.id, 
    ...taskData, 
    status, 
    priority, 
    assignee_ids,
    tags,
    created_at: new Date().toISOString(), 
    updated_at: new Date().toISOString(),
    created_by: assignee_ids?.[0] || ''
  };
};

export const sendMessage = async (projectId: string, text: string, senderId: string) => {
  const docRef = await addDoc(collection(db, 'messages'), {
    project_id: projectId,
    text,
    sender_id: senderId,
    created_at: serverTimestamp(),
  });

  return { id: docRef.id, project_id: projectId, text, sender_id: senderId, created_at: new Date().toISOString() };
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  await deleteDoc(doc(db, 'messages', messageId));
};
