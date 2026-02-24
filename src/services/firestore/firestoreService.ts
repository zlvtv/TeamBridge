import { 
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, QueryConstraint, onSnapshot, Timestamp, setDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface FirestoreDocument {
  id: string;
  created_at?: Date | Timestamp;
  updated_at?: Date | Timestamp;
}

type CollectionName = 
  | 'organizations' | 'projects' | 'messages' | 'tasks' 
  | 'users' | 'invitations' | 'files' | 'polls'
  | 'organization_invites';

interface QueryOptions {
  whereClauses?: Array<{ field: string; operator: any; value: any }>;
  order?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

const convertTimestamps = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(convertTimestamps);

  const result: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];

      if ((key === 'created_at' || key === 'updated_at') && value instanceof Timestamp) {
        result[key] = value.toDate();
      } else {
        result[key] = value;
      }
    }
  }
  return result;
};

const withTimestamps = (data: any) => ({
  ...data,
  created_at: data.created_at || new Date(),
  updated_at: new Date()
});

export const getDocById = async <T extends FirestoreDocument>(
  collectionName: CollectionName,
  id: string
): Promise<T | null> => {
  try {
    const snapshot = await getDoc(doc(db, collectionName, id));
    return snapshot.exists()
      ? { id: snapshot.id, ...convertTimestamps(snapshot.data()) } as T
      : null;
  } catch (error) {
    console.error(`Error getting ${collectionName}/${id}:`, error);
    throw error;
  }
};

export const getCollection = async <T extends FirestoreDocument>(
  collectionName: CollectionName,
  options?: QueryOptions
): Promise<T[]> => {
  try {
    let q = query(collection(db, collectionName));

    if (options?.whereClauses) {
      const constraints = options.whereClauses.map(wc => where(wc.field, wc.operator, wc.value));
      q = query(q, ...constraints);
    }

    if (options?.order) {
      q = query(q, orderBy(options.order.field, options.order.direction));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    })) as T[];
  } catch (error) {
    console.error(`Error getting collection ${collectionName}:`, error);
    throw error;
  }
};

export const createDoc = async <T extends FirestoreDocument>(
  collectionName: CollectionName,
  data: Omit<T, 'id'>
): Promise<{ id: string } & T> => {
  try {
    const docRef = await addDoc(collection(db, collectionName), withTimestamps(data));
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Document not created');
    
    const result = snap.data();
    result.id = snap.id;
    return convertTimestamps(result) as { id: string } & T;
  } catch (error) {
    console.error(`Error creating in ${collectionName}:`, error);
    throw error;
  }
};

export const setDocById = async <T extends FirestoreDocument>(
  collectionName: CollectionName,
  id: string,
  data: Omit<T, 'id'>
): Promise<void> => {
  try {
    await setDoc(doc(db, collectionName, id), withTimestamps(data));
  } catch (error) {
    console.error(`Error setting ${collectionName}/${id}:`, error);
    throw error;
  }
};

export const updateDocById = async (
  collectionName: CollectionName,
  id: string,
  data: Partial<any>
): Promise<void> => {
  try {
    await updateDoc(doc(db, collectionName, id), {
      ...data,
      updated_at: new Date()
    });
  } catch (error) {
    console.error(`Error updating ${collectionName}/${id}:`, error);
    throw error;
  }
};

export const deleteDocById = async (
  collectionName: CollectionName,
  id: string
): Promise<void> => {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`Error deleting ${collectionName}/${id}:`, error);
    throw error;
  }
};

export const subscribeToDoc = (
  collectionName: CollectionName,
  id: string,
  onNext: (doc: any) => void,
  onError?: (error: Error) => void
) => {
  return onSnapshot(
    doc(db, collectionName, id),
    (snap) => onNext(snap.exists() ? { id: snap.id, ...convertTimestamps(snap.data()) } : null),
    (error) => { console.error(`Subscription error ${collectionName}/${id}:`, error); onError?.(error); }
  );
};

export const subscribeToCollection = (
  collectionName: CollectionName,
  onNext: (docs: any[]) => void,
  options?: QueryOptions,
  onError?: (error: Error) => void
) => {
  let q = query(collection(db, collectionName));

  if (options?.whereClauses) {
    const constraints = options.whereClauses.map(wc => where(wc.field, wc.operator, wc.value));
    q = query(q, ...constraints);
  }

  if (options?.order) {
    q = query(q, orderBy(options.order.field, options.order.direction));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      }));
      onNext(docs);
    },
    (error) => { console.error(`Subscription error ${collectionName}:`, error); onError?.(error); }
  );
};

export const getDocsByQuery = async <T extends FirestoreDocument>(
  q: any 
): Promise<T[]> => {
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    })) as T[];
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
};

export const subscribeToMessages = (
  projectId: string,
  callback: (messages: Message[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, 'messages'),
    where('project_id', '==', projectId)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    })) as Message[];

    callback(messages);
  }, onError);
};
