import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const projectToOrganizationCache = new Map<string, string>();

export const touchOrganizationActivity = async (organizationId: string): Promise<void> => {
  if (!organizationId) return;

  try {
    await updateDoc(doc(db, 'organizations', organizationId), {
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to touch organization activity:', error);
  }
};

export const getOrganizationIdByProjectId = async (projectId: string): Promise<string | null> => {
  if (!projectId) return null;

  const cached = projectToOrganizationCache.get(projectId);
  if (cached) return cached;

  try {
    const projectSnap = await getDoc(doc(db, 'projects', projectId));
    if (!projectSnap.exists()) return null;

    const orgId = projectSnap.data()?.organization_id as string | undefined;
    if (!orgId) return null;

    projectToOrganizationCache.set(projectId, orgId);
    return orgId;
  } catch {
    return null;
  }
};

export const touchOrganizationActivityByProject = async (projectId: string): Promise<void> => {
  const organizationId = await getOrganizationIdByProjectId(projectId);
  if (!organizationId) return;
  await touchOrganizationActivity(organizationId);
};

export const getCommonProjectId = async (organizationId: string): Promise<string | null> => {
  if (!organizationId) return null;

  try {
    const commonQuery = query(
      collection(db, 'projects'),
      where('organization_id', '==', organizationId),
      where('name', '==', 'Общий'),
      limit(1)
    );
    const commonSnap = await getDocs(commonQuery);
    if (!commonSnap.empty) return commonSnap.docs[0].id;

    const firstProjectQuery = query(
      collection(db, 'projects'),
      where('organization_id', '==', organizationId),
      orderBy('created_at', 'asc'),
      limit(1)
    );
    const firstProjectSnap = await getDocs(firstProjectQuery);
    if (!firstProjectSnap.empty) return firstProjectSnap.docs[0].id;

    return null;
  } catch {
    return null;
  }
};
