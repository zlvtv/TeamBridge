import { Organization, OrganizationWithMembers, CreateOrganizationData, UpdateOrganizationData, OrganizationInvite } from '../types/organization.types';
import { auth, db } from '../lib/firebase';
import {
  getDocById,
  createDoc,
  deleteDocById,
  getDocsByQuery,
} from './firestore/firestoreService';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  updateDoc,
  arrayRemove,
} from 'firebase/firestore';
import { buildUserFromSnapshot } from '../utils/user.utils';

const getCurrentUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};

const getCurrentUser = () => {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    id: user.uid,
    email: user.email || '',
    full_name: user.displayName || user.email?.split('@')[0] || 'Пользователь',
    username: user.email?.split('@')[0] || `user_${user.uid.slice(-5)}`,
    avatar_url: user.photoURL || null,
  };
};

/**
 * Получение всех членов организации
 */
const getOrganizationMembers = async (organizationId: string): Promise<any[]> => {
  const membersQuery = query(
    collection(db, 'organization_members'),
    where('organization_id', '==', organizationId)
  );

  const memberDocs = await getDocsByQuery(membersQuery);
  return memberDocs;
};

/**
 * Получение профиля пользователя с fallback
 */
const getUserProfile = async (userId: string) => {
  const userSnap = await getDocById('users', userId);
  return buildUserFromSnapshot(userSnap, userId);
};

/**
 * Формирование данных об участниках с профилями
 */
const buildMembersWithProfiles = async (members: any[]): Promise<OrganizationWithMembers['organization_members']> => {
  return await Promise.all(
    members.map(async (member) => {
      const user = await getUserProfile(member.user_id);
      return {
        ...member,
        joined_at: member.joined_at?.toDate ? member.joined_at.toDate().toISOString() : new Date().toISOString(),
        user,
      };
    })
  );
};

export const organizationService = {
  /**
   * Обновление организации
   */
  async updateOrganization(id: string, data: UpdateOrganizationData): Promise<void> {
    const orgRef = doc(db, 'organizations', id);
    await updateDoc(orgRef, {
      name: data.name,
      description: data.description,
      roles: data.roles,
      autoRemoveMembers: data.autoRemoveMembers,
      updated_at: serverTimestamp(),
    });
  },

  /**
   * Получение организаций пользователя
   */
  async getUserOrganizations(): Promise<OrganizationWithMembers[]> {
    const userId = getCurrentUserId();
    if (!userId) return [];

    try {
      const membersQuery = query(
        collection(db, 'organization_members'),
        where('user_id', '==', userId)
      );
      const memberDocs = await getDocsByQuery(membersQuery);
      const memberRecords = memberDocs.map(d => ({ id: d.id, ...d }));

      if (memberRecords.length === 0) return [];

      const orgIds = [...new Set(memberRecords.map(m => m.organization_id))];

      const orgsQuery = query(
        collection(db, 'organizations'),
        where('__name__', 'in', orgIds)
      );
      const orgDocs = await getDocsByQuery(orgsQuery);

      const organizations = orgDocs.map(doc => ({
        id: doc.id,
        ...doc,
        created_at: doc.created_at?.toDate ? doc.created_at.toDate().toISOString() : null,
        updated_at: doc.updated_at?.toDate ? doc.updated_at.toDate().toISOString() : null,
      })) as Organization[];

      const result: OrganizationWithMembers[] = [];

      for (const org of organizations) {
        const members = await getOrganizationMembers(org.id);
        const membersWithUsers = await buildMembersWithProfiles(members);

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
    } catch {
      return [];
    }
  },

  /**
   * Создание новой организации
   */
  async createOrganization(data: CreateOrganizationData): Promise<OrganizationWithMembers> {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Пользователь не авторизован');

    const orgData = {
      name: data.name,
      description: data.description || null,
      created_by: userId,
      roles: data.roles || [],
    };

    const newOrg = await createDoc('organizations', orgData);

    await createDoc('organization_members', {
      organization_id: newOrg.id,
      user_id: userId,
      status: 'owner',
      joined_at: serverTimestamp(),
    });

    const commonProject = await createDoc('projects', {
      organization_id: newOrg.id,
      name: 'Общий',
      description: 'Общий чат всей организации',
      created_by: userId,
      created_at: serverTimestamp(),
    });

    const projMemberData = {
      project_id: commonProject.id,
      user_id: userId,
      status: 'owner',
      joined_at: serverTimestamp(),
    };

    await createDoc('project_members', projMemberData);

    const userObj = getCurrentUser();

    return {
      ...newOrg,
      organization_members: [
        {
          id: 'temp',
          organization_id: newOrg.id,
          user_id: userId,
          status: 'owner',
          joined_at: new Date().toISOString(),
          user: userObj!,
        },
      ],
    };
  },

  async joinOrganization(inviteToken: string): Promise<{ organizationId: string; orgName: string }> {
    const invite = await getDocById('organization_invites', inviteToken);
    if (!invite) throw new Error('Приглашение не найдено');
    if (!invite.active) throw new Error('Приглашение отозвано');

    const expiresAt = invite.expires_at?.toDate ? invite.expires_at.toDate() : null;
    if (!expiresAt || new Date() > expiresAt) {
      throw new Error('Приглашение истекло');
    }

    const organizationId = invite.organization_id;
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Сначала войдите в аккаунт');

    const existingMemberQuery = query(
      collection(db, 'organization_members'),
      where('organization_id', '==', organizationId),
      where('user_id', '==', userId)
    );
    const existingSnap = await getDocs(existingMemberQuery);
    if (!existingSnap.empty) {
      throw new Error('Вы уже состоите в этой организации');
    }

    await createDoc('organization_members', {
      organization_id: organizationId,
      user_id: userId,
      status: 'member',
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
    const batch = writeBatch(db);

    batch.delete(doc(db, 'organizations', organizationId));

    const membersSnap = await getDocs(
      query(collection(db, 'organization_members'), where('organization_id', '==', organizationId))
    );
    membersSnap.docs.forEach(doc => batch.delete(doc.ref));

    const invitesSnap = await getDocs(
      query(collection(db, 'organization_invites'), where('organization_id', '==', organizationId))
    );
    invitesSnap.docs.forEach(doc => batch.delete(doc.ref));

    const tasksSnap = await getDocs(
      query(collection(db, 'tasks'), where('organization_id', '==', organizationId))
    );
    tasksSnap.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();

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
    let opCount = 0;
    let batch2 = writeBatch(db);

    const addToBatch = (ref: any) => {
      batch2.delete(ref);
      opCount++;
      if (opCount >= MAX_BATCH_SIZE) {
        throw new Error('batch_full');
      }
    };

    try {
      pmSnap.docs.forEach(doc => addToBatch(doc.ref));
      messagesSnap.docs.forEach(doc => addToBatch(doc.ref));
      projectsSnap.docs.forEach(doc => addToBatch(doc.ref));
    } catch (err) {
      await batch2.commit();
      batch2 = writeBatch(db);
      opCount = 0;
      [...pmSnap.docs, ...messagesSnap.docs, ...projectsSnap.docs].forEach(d => {
        if (opCount < MAX_BATCH_SIZE) {
          batch2.delete(d.ref);
          opCount++;
        }
      });
    }

    if (opCount > 0) await batch2.commit();
  },

  async isUserInOrganization(organizationId: string, userId: string): Promise<boolean> {
    const membersQuery = query(
      collection(db, 'organization_members'),
      where('organization_id', '==', organizationId),
      where('user_id', '==', userId)
    );
    const snap = await getDocsByQuery(membersQuery);
    return snap.length > 0;
  },

  async leaveOrganization(organizationId: string): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Не авторизован');

    const membersQuery = query(
      collection(db, 'organization_members'),
      where('organization_id', '==', organizationId),
      where('user_id', '==', userId)
    );
    const members = await getDocsByQuery(membersQuery);
    const member = members[0];

    if (member) {
      await deleteDocById('organization_members', member.id);
    }
  },

  async updateMemberRoles(organizationId: string, memberId: string, roles: string[]): Promise<void> {
    const memberDocRef = doc(db, 'organization_members', memberId);
    await updateDoc(memberDocRef, { roles });
  },

  async removeMember(organizationId: string, memberId: string): Promise<void> {
    await deleteDocById('organization_members', memberId);
  },

  async makeModerator(organizationId: string, memberId: string): Promise<void> {
    const memberDocRef = doc(db, 'organization_members', memberId);
    await updateDoc(memberDocRef, { status: 'admin' });
  },
};