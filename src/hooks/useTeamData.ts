import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

// CHANGED: Argument is now 'clientTeamId' (UUID)
export const useTeamData = (clientTeamId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Client Teams
  // (We keep this for the Admin Dashboard which lists all teams)
  const fetchClientTeams = async () => {
    try {
      // Admin path: Get all active teams
      const result = await (supabase as any)
        .from('client_teams')
        .select('*')
        .eq('is_active', true)
        .order('name');

      return result.data?.map((team: any) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        booking_slug: team.booking_slug,
        isActive: team.is_active,
        createdAt: team.created_at,
        updatedAt: team.updated_at
      })) || [];
    } catch (err) {
      console.error('Error in fetchClientTeams:', err);
      return [];
    }
  };

  // 2. Fetch Members (Using the new ID function)
  const fetchTeamMembers = async (currentTeams: ClientTeam[]) => {
    try {
      // ✅ PUBLIC PATH: If an ID is provided, use the new Secure ID Function
      if (clientTeamId) {
        console.log('🔍 Fetching members for ID:', clientTeamId);
        
        const { data, error } = await (supabase as any)
          .rpc('get_public_team_members_by_id', { client_team_id_param: clientTeamId });

        if (error) throw error;

        // Attach the correct team object for the UI filter
        const activeTeam = currentTeams.find(t => t.id === clientTeamId) || {
            id: clientTeamId,
            name: 'Current Team',
            booking_slug: 'unknown',
            description: null,
            isActive: true,
            createdAt: null,
            updatedAt: null
        };

        return (data || []).map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role_name,
          clientTeams: [activeTeam], // Attached correctly via ID
          googleCalendarConnected: true, 
          google_photo_url: member.google_photo_url,
          isActive: member.is_active,
          googleCalendarId: null,
          google_profile_data: null,
          createdAt: null,
          updatedAt: null
        }));
      } 
      
      // ⚠️ ADMIN PATH: No ID provided, fetch everyone (Dashboard)
      const { data: membersData, error: membersError } = await (supabase as any)
        .rpc('get_team_members_with_roles');

      if (membersError) throw membersError;
      if (!membersData) return [];

      const memberIds = membersData.map((member: any) => member.id);
      const { data: relationshipsData } = await (supabase as any)
        .from('team_member_client_teams')
        .select(`team_member_id, client_teams:client_team_id (*)`)
        .in('team_member_id', memberIds);

      return membersData.map((member: any) => {
        const memberRelationships = relationshipsData?.filter(
          (rel: any) => rel.team_member_id === member.id
        ) || [];

        const memberClientTeams = memberRelationships
          .map((rel: any) => rel.client_teams)
          .filter(Boolean)
          .map((team: any) => ({
            id: team.id,
            name: team.name,
            description: team.description,
            booking_slug: team.booking_slug,
            isActive: team.is_active,
            createdAt: team.created_at,
            updatedAt: team.updated_at
          }));

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role_name,
          roleId: member.role_id,
          clientTeams: memberClientTeams,
          googleCalendarConnected: !!member.google_calendar_id,
          googleCalendarId: member.google_calendar_id,
          google_photo_url: member.google_photo_url,
          google_profile_data: member.google_profile_data,
          isActive: member.is_active,
          createdAt: member.created_at,
          updatedAt: member.updated_at
        };
      });

    } catch (err) {
      console.error('Error in fetchTeamMembers:', err);
      return [];
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const teams = await fetchClientTeams();
      setClientTeams(teams);
      const members = await fetchTeamMembers(teams);
      setTeamMembers(members);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientTeamId]); // Dependency updated to ID

  return { teamMembers, clientTeams, loading, error, refetch: fetchData };
};