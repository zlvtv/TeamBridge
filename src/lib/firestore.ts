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
} from 'firebase/firestore';

export const getCollection = async (collectionName: string) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getDocsByQuery = async (collectionName: string, q: any) => {
  try {
    const querySnapshot = await getDocsFromServer(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err: any) {
    console.warn('Server error, falling back to cache:', err.message);
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
    console.warn('Falling back to cache for doc:', collectionName, id);
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
  return onSnapshot(q, snapshot => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(messages);
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
  await addDoc(collection(db, `projects/${projectId}/messages`), {
    text,
    senderId,
    createdAt: serverTimestamp(),
  });
};

export const getMessages = async (projectId: string) => {
  const q = query(collection(db, `projects/${projectId}/messages`));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createTask = async (taskData: {
  project_id: string;
  title: string;
  description?: string;
  due_date?: string;
  source_message_id?: string;
  assignee_ids: string[];
}) => {
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...taskData,
    status: 'todo',
    priority: 'medium',
    created_at: serverTimestamp(),
    created_by: taskData.assignee_ids[0],
  });

  return { id: docRef.id, ...taskData, status: 'todo', priority: 'medium', created_at: new Date().toISOString() };
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
