import { Organization, OrganizationWithMembers, CreateOrganizationData, OrganizationInvite } from '../types/organization.types';
import { auth, db } from '../lib/firebase';
import {
  getCollection,
  createDoc,
  deleteDocById,
  getDocById,
} from '../lib/firestore';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDocsFromServer,
  writeBatch,
  serverTimestamp,
  getDocFromServer,
  updateDoc,
} from 'firebase/firestore';

const getCurrentUserId = () => {
  return auth.currentUser?.uid || null;
};

const getCurrentUser = () => {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    id: user.uid,
    email: user.email || '',
    full_name: user.displayName || user.email?.split('@')[0] || 'User',
    username: user.email?.split('@')[0] || `user_${user.uid.slice(-5)}`,
    avatar_url: user.photoURL || null,
  };
};

const buildUserFromSnapshot = (userSnap: any, userId: string) => {
  if (!userSnap) {
    const fallbackUsername = `user_${userId.slice(-5)}`;
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
    username: userSnap.username || userSnap.email?.split('@')[0] || `user_${userId.slice(-5)}`,
    full_name: userSnap.full_name || userSnap.username || userSnap.email?.split('@')[0] || `Пользователь ${userId.slice(-5)}`,
    avatar_url: userSnap.avatar_url || null,
  };
};

export const organizationService = {
  async getOrganizationsLite(): Promise<Organization[]> {
    const userId = getCurrentUserId();
    if (!userId) return [];

    const orgs = await getCollection('organizations');
    return orgs
      .filter((org: any) => org.members?.includes(userId))
      .map(({ id, name, description, created_by, createdAt, updatedAt }: any) => ({
        id,
        name,
        description,
        created_by,
        created_at: createdAt?.toDate ? createdAt.toDate().toISOString() : createdAt,
        updated_at: updatedAt?.toDate ? updatedAt.toDate().toISOString() : updatedAt,
      }));
  },

  async getUserOrganizations(forceServer = false): Promise<OrganizationWithMembers[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];

  const orgQuery = query(
    collection(db, 'organizations'),
    where('members', 'array-contains', userId)
  );

  let orgSnap;
  try {
    if (forceServer) {
      orgSnap = await getDocsFromServer(orgQuery); 
    } else {
      orgSnap = await getDocsFromServer(orgQuery);
    }
  } catch (err) {
    console.warn('Falling back to cache for organizations:', err);
    orgSnap = await getDocs(orgQuery);
  }
  const orgs = orgSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  const result: OrganizationWithMembers[] = [];

  for (const org of orgs) {
    const membersQuery = query(
      collection(db, 'organization_members'),
      where('organization_id', '==', org.id)
    );
    let membersSnap;
    try {
      const snap = await getDocsFromServer(membersQuery);
      membersSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      const snap = await getDocs(membersQuery);
      membersSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const membersWithUsers = await Promise.all(
      membersSnap.map(async (member: any) => {
        const userSnap = await getDocById('users', member.user_id);
        const user = buildUserFromSnapshot(userSnap, member.user_id);

        return {
          ...member,
          joined_at: member.joined_at?.toDate ? member.joined_at.toDate().toISOString() : member.joined_at,
          user,
        };
      })
    );

    const lastActivityAt = membersWithUsers
      .map(m => new Date(m.joined_at).getTime())
      .sort((a, b) => b - a)[0]; 

    result.push({
      ...org,
      created_at: org.createdAt?.toDate ? org.createdAt.toDate().toISOString() : org.createdAt,
      updated_at: org.updatedAt?.toDate ? org.updatedAt.toDate().toISOString() : org.updatedAt,
      organization_members: membersWithUsers,
      lastActivityAt: new Date(lastActivityAt).toISOString(), 
    });
  }

  return result.sort((a, b) => {
    const dateA = new Date(a.lastActivityAt).getTime();
    const dateB = new Date(b.lastActivityAt).getTime();
    return dateB - dateA; 
  });
},

  async createOrganization(data: CreateOrganizationData): Promise<OrganizationWithMembers> {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Пользователь не авторизован');

    const orgData = {
      name: data.name,
      description: data.description || null,
      created_by: userId,
      members: [userId],
    };

    const newOrg = await createDoc('organizations', orgData);

    await createDoc('organization_members', {
      organization_id: newOrg.id,
      user_id: userId,
      role: 'owner',
      joined_at: serverTimestamp(),
    });

    const user = getCurrentUser();

    return {
      ...newOrg,
      organization_members: [
        {
          id: 'temp',
          organization_id: newOrg.id,
          user_id: userId,
          role: 'owner',
          joined_at: new Date().toISOString(),
          user: user!,
        },
      ],
    };
  },

  async joinOrganization(inviteToken: string): Promise<{ organizationId: string; orgName: string }> {
    const inviteSnap = await getDocById('organization_invites', inviteToken);
    if (!inviteSnap) throw new Error('Приглашение не найдено');
    if (!inviteSnap.active) throw new Error('Приглашение отозвано');

    const expiresAt = inviteSnap.expires_at?.toDate ? inviteSnap.expires_at.toDate() : null;
    if (!expiresAt || new Date() > expiresAt) {
      throw new Error('Приглашение истекло');
    }

    const organizationId = inviteSnap.organization_id;
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Сначала войдите в аккаунт');

    const q = query(
      collection(db, 'organization_members'),
      where('organization_id', '==', organizationId),
      where('user_id', '==', userId)
    );
    let memberSnap = [];
    try {
      const snap = await getDocsFromServer(q);
      memberSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('Falling back to cache for member check:', err);
      const snap = await getDocs(q);
      memberSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    if (memberSnap.length > 0) {
      console.warn('Stale entry found, cleaning:', memberSnap[0]);
      await deleteDocById('organization_members', memberSnap[0].id);
    }

    await createDoc('organization_members', {
      organization_id: organizationId,
      user_id: userId,
      role: 'member',
      joined_at: serverTimestamp(),
    });

    const orgRef = doc(db, 'organizations', organizationId);
    const orgSnap = await getDocFromServer(orgRef);
    if (orgSnap.exists()) {
      const data = orgSnap.data();
      const members = data.members || [];
      if (!members.includes(userId)) {
        await updateDoc(orgRef, {
          members: [...members, userId],
        });
      }
    }

    await deleteDocById('organization_invites', inviteToken);

    const orgData = await getDocById('organizations', organizationId);
    const orgName = orgData?.name || 'Организация';

    return { organizationId, orgName };
  },

  async createOrganizationInvite(organizationId: string): Promise<OrganizationInvite> {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Не авторизован');

    const inviteData = {
      organization_id: organizationId,
      created_by: userId,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      active: true,
    };

    const invite = await createDoc('organization_invites', inviteData);

    return {
      token: invite.id,
      expires_at: invite.expires_at.toISOString(),
      invite_link: `${window.location.origin}/invite/${invite.id}`,
    };
  },

  async deleteOrganization(organizationId: string): Promise<void> {
    const batch = writeBatch(db);

    batch.delete(doc(db, 'organizations', organizationId));

    const membersSnap = await getDocs(
      query(collection(db, 'organization_members'), where('organization_id', '==', organizationId))
    );
    membersSnap.docs.forEach((doc) => batch.delete(doc.ref));

    const invitesSnap = await getDocs(
      query(collection(db, 'organization_invites'), where('organization_id', '==', organizationId))
    );
    invitesSnap.docs.forEach((doc) => batch.delete(doc.ref));

    const projectsSnap = await getDocs(
      query(collection(db, 'projects'), where('orgId', '==', organizationId))
    );
    for (const projectDoc of projectsSnap.docs) {
      const messagesSnap = await getDocs(collection(db, `projects/${projectDoc.id}/messages`));
      messagesSnap.docs.forEach((msgDoc) => batch.delete(msgDoc.ref));
      batch.delete(projectDoc.ref);
    }

    const tasksSnap = await getDocs(
      query(collection(db, 'tasks'), where('organization_id', '==', organizationId))
    );
    tasksSnap.docs.forEach((taskDoc) => batch.delete(taskDoc.ref));

    await batch.commit();
  },

  async isUserInOrganization(organizationId: string, userId: string): Promise<boolean> {
  const membersQuery = query(
    collection(db, 'organization_members'),
    where('organization_id', '==', organizationId),
    where('user_id', '==', userId)
  );
  try {
    const snap = await getDocsFromServer(membersQuery);
    return !snap.empty;
  } catch (err) {
    const snap = await getDocs(membersQuery);
    return !snap.empty;
  }
},

  async leaveOrganization(organizationId: string): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('Не авторизован');

  const membersQuery = query(
    collection(db, 'organization_members'),
    where('organization_id', '==', organizationId),
    where('user_id', '==', userId)
  );
  let membersSnap;
  try {
    const snap = await getDocsFromServer(membersQuery);
    membersSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const snap = await getDocs(membersQuery);
    membersSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  const member = membersSnap[0];
  if (member) {
    await deleteDocById('organization_members', member.id);
  }

  const orgRef = doc(db, 'organizations', organizationId);
  const orgSnap = await getDocFromServer(orgRef);
  if (orgSnap.exists()) {
    const data = orgSnap.data();
    const members = data.members || [];
    if (members.includes(userId)) {
      await updateDoc(orgRef, {
        members: members.filter((id: string) => id !== userId),
      });
    }
  }
},
};
