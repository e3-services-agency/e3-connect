import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

export const useTeamData = (slug?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Client Teams (The "Folder" needed to organize members)
  const fetchClientTeams = async () => {
    try {
      let data;
      
      if (slug) {
        // ✅ SECURE PATH: Public Booking Page
        // Try to fetch the specific team using the secure function
        const result = await (supabase as any)
          .rpc('get_client_team_by_slug', { slug_param: slug });
        
        data = result.data;
        
        // If RPC fails/is missing, fall back to empty array (we handle this in fetchTeamMembers)
        if (result.error) {
          console.warn('Secure team fetch warning:', result.error);
        }
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
      console.error('Error in fetchClientTeams:', err);
      return [];
    }
  };

  // 2. Fetch Members (The "People")
  const fetchTeamMembers = async (currentTeams: ClientTeam[]) => {
    try {
      // --- A. SECURE PUBLIC PATH (Booking Page) ---
      if (slug) {
        // Fetch only public-safe data
        const { data, error } = await (supabase as any)
          .rpc('get_public_team_members_by_slug', { slug_param: slug });

        if (error) {
           console.error('Error fetching public members:', error);
           throw error;
        }

        // CRITICAL FIX: Ensure we have a valid Team object to attach.
        // If the fetchClientTeams failed or returned nothing, we create a 
        // "Virtual Team" so the UI filter (TeamStep.tsx) still accepts the user.
        const activeTeam = currentTeams.find(t => t.booking_slug === slug) || {
            id: 'virtual-team-id', 
            name: 'Current Team',
            booking_slug: slug, // This MUST match the prop passed to TeamStep
            description: null,
            isActive: true,
            createdAt: null,
            updatedAt: null
        };

        // Map the DB result to your frontend type
        return (data || []).map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role_name,
          // We manually attach the team here so the UI knows they belong
          clientTeams: [activeTeam], 
          googleCalendarConnected: true, 
          google_photo_url: member.google_photo_url,
          isActive: member.is_active,
          // Nullify sensitive admin data
          googleCalendarId: null,
          google_profile_data: null,
          createdAt: null,
          updatedAt: null
        }));
      } 
      
      // --- B. ADMIN PATH (Dashboard) ---
      // 1. Get all members with roles
      const { data: membersData, error: membersError } = await (supabase as any)
        .rpc('get_team_members_with_roles');

      if (membersError) throw membersError;
      if (!membersData) return [];

      // 2. Get the "Join Table" links to see who belongs to which team
      const memberIds = membersData.map((member: any) => member.id);
      const { data: relationshipsData } = await (supabase as any)
        .from('team_member_client_teams')
        .select(`team_member_id, client_teams:client_team_id (*)`)
        .in('team_member_id', memberIds);

      // 3. Combine them
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
      // Step 1: Get the Teams
      const teams = await fetchClientTeams();
      setClientTeams(teams);

      // Step 2: Get the Members (passing the teams we just found)
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

  return {
    teamMembers,
    clientTeams,
    loading,
    error,
    refetch: fetchData
  };
};