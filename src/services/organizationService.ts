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
  Timestamp,
} from 'firebase/firestore'; 
import { buildUserFromSnapshot } from '../utils/user.utils';
import { isDeletedUserProfile } from '../utils/user.utils';
import { messageService } from './messageService';
import { touchOrganizationActivity } from './activityService';

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

const normalizeRoleKey = (role: string) => role.trim().toLocaleLowerCase('ru');

const getOrganizationMembers = async (organizationId: string): Promise<any[]> => {
  const membersQuery = query(
    collection(db, 'organization_members'),
    where('organization_id', '==', organizationId)
  );

  const memberDocs = await getDocsByQuery(membersQuery);
  return memberDocs;
};

const getUserProfile = async (userId: string) => {
  const userSnap = await getDocById('users', userId);
  return buildUserFromSnapshot(userSnap, userId);
};

const assertMemberIsNotDeleted = async (memberId: string) => {
  const memberSnap = await getDocById<any>('organization_members', memberId);
  if (!memberSnap?.user_id) {
    throw new Error('Участник организации не найден');
  }

  const userSnap = await getDocById('users', memberSnap.user_id);
  const profile = buildUserFromSnapshot(userSnap, memberSnap.user_id);
  if (isDeletedUserProfile(profile)) {
    throw new Error('Нельзя назначать роли или модерацию удаленному пользователю');
  }
};

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
  async updateOrganization(id: string, data: UpdateOrganizationData): Promise<void> {
    const nextRoleNames = Array.isArray(data.roles)
      ? data.roles.map((role) => String(role.name || '').trim()).filter(Boolean)
      : [];
    const allowedRoleKeys = new Set(nextRoleNames.map(normalizeRoleKey));

    const orgRef = doc(db, 'organizations', id);
    await updateDoc(orgRef, {
      name: data.name,
      description: data.description,
      roles: data.roles,
      autoRemoveMembers: data.autoRemoveMembers,
      autoAddRoleMembersToChats: data.autoAddRoleMembersToChats,
      updated_at: serverTimestamp(),
    });

    const members = await getOrganizationMembers(id);
    await Promise.all(
      members.map(async (member) => {
        const currentRoles = Array.isArray(member.roles)
          ? member.roles.filter(Boolean).map((role: string) => String(role))
          : typeof member.roles === 'string' && member.roles.trim()
          ? [member.roles]
          : [];

        const filteredRoles = currentRoles.filter((role) => allowedRoleKeys.has(normalizeRoleKey(role)));
        const rolesChanged =
          filteredRoles.length !== currentRoles.length ||
          filteredRoles.some((role, index) => role !== currentRoles[index]);

        if (!rolesChanged) return;

        await updateDoc(doc(db, 'organization_members', member.id), {
          roles: filteredRoles,
          updated_at: serverTimestamp(),
        });
      })
    );

    await messageService.sendOrganizationSystemMessage(id, 'Обновлены настройки организации');
    await touchOrganizationActivity(id);
  },

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
        created_at: doc.created_at instanceof Date ? doc.created_at.toISOString() : null,
        updated_at: doc.updated_at instanceof Date ? doc.updated_at.toISOString() : null,
      })) as Organization[];

      const result: OrganizationWithMembers[] = await Promise.all(
        organizations.map(async (org) => {
          const members = await getOrganizationMembers(org.id);
          const membersWithUsers = await buildMembersWithProfiles(members);

          const lastActivityAt = org.updated_at
            ? new Date(org.updated_at).getTime()
            : (org.created_at ? new Date(org.created_at).getTime() : Date.now());

          return {
            ...org,
            organization_members: membersWithUsers,
            lastActivityAt: new Date(lastActivityAt).toISOString(),
          };
        })
      );

      return result.sort((a, b) => {
        const dateA = new Date(a.lastActivityAt).getTime();
        const dateB = new Date(b.lastActivityAt).getTime();
        return dateB - dateA;
      });
    } catch {
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
      roles: data.roles || [],
      task_tags: [],
      autoRemoveMembers: !!data.autoRemoveMembers,
      autoAddRoleMembersToChats: !!data.autoAddRoleMembersToChats,
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
    try {
      await messageService.sendSystemMessage(commonProject.id, `Организация ${data.name} создана`);
    } catch (error) {
      console.error('Failed to send organization created system message:', error);
    }
    try {
      await touchOrganizationActivity(newOrg.id);
    } catch (error) {
      console.error('Failed to touch organization activity after create:', error);
    }

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

  console.log('Invite expires_at:', invite.expires_at?.toDate());
  console.log('Current time:', new Date());
  console.log('Is expired?', new Date() > invite.expires_at.toDate());

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

    const projects = await getDocs(
      query(collection(db, 'projects'), where('organization_id', '==', organizationId))
    );
    const generalProject = projects.docs.find(
      (projectDoc) => String(projectDoc.data().name || '').trim().toLocaleLowerCase('ru') === 'общий'
    );

    if (generalProject) {
      await createDoc('project_members', {
        project_id: generalProject.id,
        user_id: userId,
        status: 'member',
        roles: [],
        joined_at: serverTimestamp(),
      });
    }

    await messageService.sendOrganizationSystemMessage(organizationId, 'Новый участник присоединился к организации');
    await touchOrganizationActivity(organizationId);

    await deleteDocById('organization_invites', inviteToken);

    const orgData = await getDocById('organizations', organizationId);
    const orgName = orgData?.name || 'Организация';

    return { organizationId, orgName };
  },

  async createOrganizationInvite(organizationId: string): Promise<OrganizationInvite> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('Не авторизован');

  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const inviteData = {
    organization_id: organizationId,
    created_by: userId,
    expires_at: expiresAt,
    active: true,
  };

  const invite = await createDoc('organization_invites', inviteData);

  return {
    token: invite.id,
    expires_at: invite.expires_at.toDate().toISOString(), 
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

    const batch2 = writeBatch(db);
    const MAX_BATCH_SIZE = 499;
    let opCount = 0;

    const addToBatch = (ref: any) => {
      batch2.delete(ref);
      opCount++;
    };

    [...pmSnap.docs, ...messagesSnap.docs, ...projectsSnap.docs].forEach(doc => {
      if (opCount < MAX_BATCH_SIZE) {
        addToBatch(doc.ref);
      }
    });

    if (opCount > 0) {
      await batch2.commit();
    }

    if (opCount >= MAX_BATCH_SIZE) {
      const remaining = [...pmSnap.docs, ...messagesSnap.docs, ...projectsSnap.docs].slice(MAX_BATCH_SIZE);
      const finalBatch = writeBatch(db);
      remaining.forEach(doc => finalBatch.delete(doc.ref));
      await finalBatch.commit();
    }
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
      await messageService.sendOrganizationSystemMessage(organizationId, 'Участник покинул организацию');
      await touchOrganizationActivity(organizationId);
    }
  },

  async updateMemberRoles(organizationId: string, memberId: string, roles: string[]): Promise<void> {
    await assertMemberIsNotDeleted(memberId);
    const memberDocRef = doc(db, 'organization_members', memberId);
    await updateDoc(memberDocRef, { roles });
    await messageService.sendOrganizationSystemMessage(organizationId, 'Обновлены роли участника');
    await touchOrganizationActivity(organizationId);
  },

  async removeMember(organizationId: string, memberId: string): Promise<void> {
    await deleteDocById('organization_members', memberId);
    await messageService.sendOrganizationSystemMessage(organizationId, 'Участник удалён из организации');
    await touchOrganizationActivity(organizationId);
  },

  async makeModerator(organizationId: string, memberId: string): Promise<void> {
    await assertMemberIsNotDeleted(memberId);
    const memberDocRef = doc(db, 'organization_members', memberId);
    await updateDoc(memberDocRef, { status: 'admin' });
    await messageService.sendOrganizationSystemMessage(organizationId, 'Назначен модератор организации');
    await touchOrganizationActivity(organizationId);
  },

  async updateMemberStatus(organizationId: string, memberId: string, status: 'admin' | 'member'): Promise<void> {
    await assertMemberIsNotDeleted(memberId);
    const memberDocRef = doc(db, 'organization_members', memberId);
    await updateDoc(memberDocRef, { status });
    await messageService.sendOrganizationSystemMessage(
      organizationId,
      status === 'admin' ? 'Назначен модератор организации' : 'Статус участника обновлен'
    );
    await touchOrganizationActivity(organizationId);
  },
};
