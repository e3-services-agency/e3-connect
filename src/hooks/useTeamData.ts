import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

// 1. Update signature to accept an optional slug
export const useTeamData = (slug?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientTeams = async () => {
    try {
      let data, fetchError;

      if (slug) {
        // ✅ SECURE PATH: Public Booking Page
        // Uses the Secure RPC to fetch ONLY the specific team
        const result = await (supabase as any)
          .rpc('get_client_team_by_slug', { slug_param: slug });
        data = result.data;
        fetchError = result.error;
      } else {
        // ⚠️ ADMIN PATH: Internal Dashboard
        // Fetches ALL teams (requires authentication once RLS is enabled)
        const result = await (supabase as any)
          .from('client_teams')
          .select('*')
          .eq('is_active', true)
          .order('name');
        data = result.data;
        fetchError = result.error;
      }

      if (fetchError) {
        console.error('Error fetching client teams:', fetchError);
        setError('Failed to fetch client teams');
        return [];
      }

      return data?.map((team: any) => ({
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

  const fetchTeamMembers = async () => {
    try {
      // Use the new secure function that enforces admin access
      const { data: membersData, error: membersError } = await (supabase as any)
        .rpc('get_team_members_with_roles');

      if (membersError) {
        console.error('Error fetching team members:', membersError);
        setError('Failed to fetch team members');
        return [];
      }

      if (!membersData) return [];

      // Then get their client team relationships
      const memberIds = membersData.map((member: any) => member.id);
      const { data: relationshipsData, error: relationshipsError } = await (supabase as any)
        .from('team_member_client_teams')
        .select(`
          team_member_id,
          client_teams:client_team_id (
            id,
            name,
            description,
            booking_slug,
            is_active,
            created_at,
            updated_at
          )
        `)
        .in('team_member_id', memberIds);

      if (relationshipsError) {
        console.error('Error fetching relationships:', relationshipsError);
      }

      // Combine the data
      return membersData.map((member: any) => {
        const memberRelationships = relationshipsData?.filter(
          (rel: any) => rel.team_member_id === member.id
        ) || [];

        const clientTeams = memberRelationships
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
          role: member.role_name, // Now using role_name from the view
          roleId: member.role_id, // Add role_id for updates
          clientTeams,
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
      const [teams, members] = await Promise.all([
        fetchClientTeams(),
        fetchTeamMembers()
      ]);

      setClientTeams(teams);
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
  }, [slug]); // 2. Add slug to dependency array

  return {
    teamMembers,
    clientTeams,
    loading,
    error,
    refetch: fetchData
  };
};