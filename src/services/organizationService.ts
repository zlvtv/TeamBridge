import { Organization, OrganizationWithMembers, CreateOrganizationData, OrganizationInvite } from '../types/organization.types';
import { auth, db } from '../lib/firebase';
import {
  getDocById,
  createDoc,
  deleteDocById,
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
  async getUserOrganizations(forceServer = false): Promise<OrganizationWithMembers[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];

  try {
    const membersQuery = query(
      collection(db, 'organization_members'),
      where('user_id', '==', userId)
    );

    let membersSnap;
    try {
      membersSnap = forceServer ? await getDocsFromServer(membersQuery) : await getDocs(membersQuery);
    } catch (err) {
      const snap = await getDocs(membersQuery);
      membersSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const memberRecords = membersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (memberRecords.length === 0) return [];
    const orgIds = [...new Set(memberRecords.map(m => m.organization_id))];

    const orgsQuery = query(
      collection(db, 'organizations'),
      where('__name__', 'in', orgIds)
    );

    let orgSnap;
    try {
      orgSnap = forceServer ? await getDocsFromServer(orgsQuery) : await getDocs(orgsQuery);
    } catch (err) {
      const snap = await getDocs(orgsQuery);
      orgSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const organizations = orgSnap.docs.map(doc => ({
      id: doc.id, 
      ...doc.data(),
      created_at: doc.data().created_at?.toDate ? doc.data().created_at.toDate().toISOString() : null,
      updated_at: doc.data().updated_at?.toDate ? doc.data().updated_at.toDate().toISOString() : null,
    })) as Organization[];

    const result: OrganizationWithMembers[] = [];

    for (const org of organizations) {
      const membersOfOrgQuery = query(
        collection(db, 'organization_members'),
        where('organization_id', '==', org.id)
      );

      let membersOfOrgSnap;
      try {
        membersOfOrgSnap = forceServer 
          ? await getDocsFromServer(membersOfOrgQuery)
          : await getDocs(membersOfOrgQuery);
      } catch (err) {
        const snap = await getDocs(membersOfOrgQuery);
        membersOfOrgSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      const membersWithUsers = await Promise.all(
        membersOfOrgSnap.docs.map(async (memberDoc) => {
          const memberData = { id: memberDoc.id, ...memberDoc.data() };
          const userSnap = await getDocById('users', memberData.user_id);
          const user = buildUserFromSnapshot(userSnap, memberData.user_id);

          return {
            ...memberData,
            joined_at: memberData.joined_at?.toDate 
              ? memberData.joined_at.toDate().toISOString() 
              : null,
            user,
          };
        })
      );

      const lastActivityAt = Math.max(...membersWithUsers.map(m => new Date(m.joined_at).getTime()));

      result.push({
        ...org,
        organization_members: membersWithUsers,
        lastActivityAt: new Date(lastActivityAt).toISOString(),
      });
    }

    return result.sort((a, b) => {
      const dateA = new Date(a.lastActivityAt).getTime();
      const dateB = new Date(b.lastActivityAt).getTime();
      return dateB - dateA;
    });
  } catch (err) {
    return [];
  }
},

  
async createOrganization(data: CreateOrganizationData): Promise<OrganizationWithMembers> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('Пользователь не авторизован');

  const orgData = {
    name: data.name,
    description: data.description || null,
    created_by: userId,
  };

  const newOrg = await createDoc('organizations', orgData);

  await createDoc('organization_members', {
    organization_id: newOrg.id,
    user_id: userId,
    role: 'owner',
    joined_at: serverTimestamp(),
  });

  const commonProject = await createDoc('projects', {
    organization_id: newOrg.id,
    name: 'Общий',
    description: 'Общий чат всей организации',
    created_by: userId,
    created_at: serverTimestamp(),
  });

  await createDoc('project_members', {
    project_id: commonProject.id,
    user_id: userId,
    role: 'owner',
    joined_at: serverTimestamp(),
  });

  const userObj = getCurrentUser();

  return {
    ...newOrg,
    organization_members: [
      {
        id: 'temp',
        organization_id: newOrg.id,
        user_id: userId,
        role: 'owner',
        joined_at: new Date().toISOString(),
        user: userObj!,
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


    await createDoc('organization_members', {
      organization_id: organizationId,
      user_id: userId,
      role: 'member',
      joined_at: serverTimestamp(),
    });

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
  const batch1 = writeBatch(db);
  batch1.delete(doc(db, 'organizations', organizationId));

  const membersSnap = await getDocs(
    query(collection(db, 'organization_members'), where('organization_id', '==', organizationId))
  );
  membersSnap.docs.forEach(doc => batch1.delete(doc.ref));

  const invitesSnap = await getDocs(
    query(collection(db, 'organization_invites'), where('organization_id', '==', organizationId))
  );
  invitesSnap.docs.forEach(doc => batch1.delete(doc.ref));

  const tasksSnap = await getDocs(
    query(collection(db, 'tasks'), where('organization_id', '==', organizationId))
  );
  tasksSnap.docs.forEach(doc => batch1.delete(doc.ref));

  await batch1.commit();

  const projectsSnap = await getDocs(
    query(collection(db, 'projects'), where('organization_id', '==', organizationId))
  );
  const projectIds = projectsSnap.docs.map(d => d.id);

  if (projectIds.length === 0) return;

  const pmSnap = await getDocs(
    query(collection(db, 'project_members'), where('project_id', 'in', projectIds))
  );

  const messagesSnap = await getDocs(
    query(collection(db, 'messages'), where('project_id', 'in', projectIds))
  );

  const MAX_BATCH_SIZE = 499;
  let batch = writeBatch(db);
  let opCount = 0;

  const addToBatch = (ref: any) => {
    batch.delete(ref);
    opCount++;
    if (opCount >= MAX_BATCH_SIZE) throw new Error('Batch full');
  };

  try {
    pmSnap.docs.forEach(doc => addToBatch(doc.ref));
    messagesSnap.docs.forEach(doc => addToBatch(doc.ref));
    projectsSnap.docs.forEach(doc => addToBatch(doc.ref));
  } catch (err) {
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
    [...pmSnap.docs, ...messagesSnap.docs, ...projectsSnap.docs].forEach(d => {
      if (opCount < MAX_BATCH_SIZE) {
        batch.delete(d.ref);
        opCount++;
      }
    });
  }

  if (opCount > 0) await batch.commit();
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
  },
};
