import { supabase } from '../lib/supabase';
import {
  Organization,
  OrganizationWithMembers,
  CreateOrganizationData,
  OrganizationInvite,
} from '../types/organization.types';

export const organizationService = {
  async getOrganizationsLite(): Promise<Organization[]> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Не авторизован');

    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        organization:organizations!inner(
          id, 
          name, 
          description, 
          created_by, 
          created_at, 
          updated_at
        )
      `)
      .eq('user_id', user.id);

    if (error) throw error;

    return data.map((dm) => dm.organization);
  },
  async getUserOrganizations(): Promise<OrganizationWithMembers[]> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Не удалось получить данные пользователя');
    }

    const { data, error } = await supabase.rpc('get_user_organizations_with_members');
    if (error) throw new Error(`Ошибка загрузки организаций: ${error.message}`);

    const orgMap = new Map<string, OrganizationWithMembers>();

    (data as any[]).forEach((row) => {
      const memberData = row.member_data;

      if (!orgMap.has(row.id)) {
        orgMap.set(row.id, {
          id: row.id,
          name: row.name,
          description: row.description,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          organization_members: [],
        });
      }

      const org = orgMap.get(row.id)!;
      org.organization_members.push({
        id: memberData.id,
        organization_id: row.id,
        user_id: memberData.user_id,
        role: memberData.role,
        joined_at: row.created_at, 
        user: {
          id: memberData.user_id,
          full_name: memberData.full_name,
          email: null, 
          username: memberData.username,
          avatar_url: memberData.avatar_url,
        },
      });
    });

    return Array.from(orgMap.values());
  },

  async joinOrganization(inviteToken: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_organization_by_invite', {
    invite_token: inviteToken,
  });

  if (error) throw error;
  return data;
},

  async createOrganization(data: CreateOrganizationData): Promise<OrganizationWithMembers> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Пользователь не аутентифицирован');

    const { data: orgId, error: rpcError } = await supabase.rpc('create_organization_with_owner', {
      org_name: data.name,
      org_description: data.description || null,
    });

    if (rpcError || !orgId) throw new Error(rpcError?.message || 'Ошибка создания');

    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select(`
        *,
        organization_members (
          id,
          role,
          user_id,
          users (
            id,
            full_name,
            email
          )
        )
      `)
      .eq('id', orgId)
      .single();

    if (fetchError) {
      return {
        id: orgId,
        name: data.name,
        description: data.description,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        organization_members: [],
      };
    }

    return {
      ...org,
      organization_members: (org.organization_members || []).map((m: any) => ({
        ...m,
        user: m.users,
      })),
    } as OrganizationWithMembers;
  },

  async createOrganizationInvite(organizationId: string): Promise<OrganizationInvite> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Не аутентифицирован');

    const { data, error } = await supabase.rpc('create_organization_invite', {
      org_id: organizationId,
    });

    if (error) throw new Error(`Ошибка создания приглашения: ${error.message}`);
    return data;
  },

  async deleteOrganization(organizationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Не аутентифицирован');

    const { error } = await supabase.rpc('delete_organization', {
      org_id: organizationId,
    });

    if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  },

  async leaveOrganization(organizationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');

  const { error } = await supabase.rpc('leave_organization', {
    org_id: organizationId,
  });

  if (error) throw new Error(`Ошибка выхода: ${error.message}`);
},
};
