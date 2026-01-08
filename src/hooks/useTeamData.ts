import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

export const useTeamData = (slug?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Team Definitions
  const fetchClientTeams = async () => {
    try {
      let data;
      
      if (slug) {
        // ✅ SECURE PATH: Public Booking Page
        const result = await (supabase as any)
          .rpc('get_client_team_by_slug', { slug_param: slug });
        data = result.data;
      } else {
        // ⚠️ ADMIN PATH: Internal Dashboard
        const result = await (supabase as any)
          .from('client_teams')
          .select('*')
          .eq('is_active', true)
          .order('name');
        data = result.data;
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
      console.error('Error fetching teams:', err);
      return [];
    }
  };

  // 2. Fetch Team Members (Accepts teams as argument)
  const fetchTeamMembers = async (currentTeams: ClientTeam[]) => {
    try {
      if (slug) {
        // ✅ SECURE PATH: Public Booking Page
        const { data, error } = await (supabase as any)
          .rpc('get_public_team_members_by_slug', { slug_param: slug });

        if (error) throw error;
        
        // --- ROBUSTNESS FIX ---
        // Find the matching team object to attach to the member.
        // If missing, create a "Virtual Team" so the UI filter still works.
        const activeTeam = currentTeams.find(t => t.booking_slug === slug) || {
            id: 'virtual-team-id', 
            name: slug.charAt(0).toUpperCase() + slug.slice(1),
            booking_slug: slug,
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
          // Attach the team so the UI knows this member belongs here
          clientTeams: [activeTeam], 
          googleCalendarConnected: true, 
          google_photo_url: member.google_photo_url,
          isActive: member.is_active,
          // Explicitly nullify sensitive admin fields
          googleCalendarId: null,
          google_profile_data: null,
          createdAt: null,
          updatedAt: null
        }));
      } 
      
      // ⚠️ ADMIN PATH: Internal Dashboard (Full Logic)
      const { data: membersData, error: membersError } = await (supabase as any)
        .rpc('get_team_members_with_roles');

      if (membersError) throw membersError;
      if (!membersData) return [];

      // Fetch relationships for admin view
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
      console.error('Error fetching members:', err);
      return [];
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Teams FIRST
      const teams = await fetchClientTeams();
      setClientTeams(teams);

      // 2. Pass those teams to the Member fetcher
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
  }, [slug]);

  return { teamMembers, clientTeams, loading, error, refetch: fetchData };
};