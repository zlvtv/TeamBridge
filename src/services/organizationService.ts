// src/services/organizationService.ts
import { supabase } from '../lib/supabase';
import { Organization, OrganizationWithMembers, CreateOrganizationData, OrganizationMember } from '../types/organization.types';

export const organizationService = {
  // Создание новой организации
  async createOrganization(data: CreateOrganizationData): Promise<Organization> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: organization, error } = await supabase
      .from('organizations')
      .insert([
        {
          ...data,
          created_by: user.id,
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Автоматически добавляем создателя как владельца
    await this.addMember(organization.id, user.id, 'owner');

    return organization;
  },

  // Получение организаций пользователя
  async getUserOrganizations(): Promise<OrganizationWithMembers[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('organizations')
      .select(`
        *,
        organization_members (
          *,
          profiles (
            username,
            email,
            full_name
          )
        )
      `)
      .eq('organization_members.user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Вступление в организацию по коду приглашения
  async joinOrganization(inviteCode: string): Promise<Organization> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Находим организацию по коду
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (orgError) throw new Error('Organization not found');
    if (!organization) throw new Error('Invalid invite code');

    // Добавляем пользователя как участника
    await this.addMember(organization.id, user.id, 'member');

    return organization;
  },

  // Добавление участника в организацию
  async addMember(organizationId: string, userId: string, role: 'owner' | 'admin' | 'member' = 'member'): Promise<void> {
    const { error } = await supabase
      .from('organization_members')
      .insert([
        {
          organization_id: organizationId,
          user_id: userId,
          role: role,
        }
      ]);

    if (error) {
      if (error.code === '23505') { // unique violation
        throw new Error('User is already a member of this organization');
      }
      throw error;
    }
  },

  // Получение участников организации
  async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        *,
        profiles (
          username,
          email,
          full_name
        )
      `)
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Проверка, является ли пользователь участником организации
  async isUserMember(organizationId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    return !!data && !error;
  }
};