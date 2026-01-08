import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

// CHANGED: Argument is 'slugOrId' because it might be "sunday" (Slug) or a UUID
export const useTeamData = (slugOrId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Client Teams
  // This logic is critical: It determines if we are looking for ONE team (Public) or ALL (Admin)
  const fetchClientTeams = async () => {
    try {
      let data = [];

      // CASE A: We have a specific target (Public Booking Page)
      if (slugOrId) {
        // Try to fetch as if it is a SLUG (most common for public page)
        const { data: slugData, error: slugError } = await (supabase as any)
          .rpc('get_client_team_by_slug', { slug_param: slugOrId });

        if (!slugError && slugData && slugData.length > 0) {
          data = slugData;
        } else {
          // If slug failed, maybe it WAS an ID? (Fallback/Edge case)
          // We can't easily check this without admin rights, so we rely on the slug RPC mostly.
          // If you really need ID support here, we'd need a separate RPC 'get_client_team_by_id'
          console.warn('Could not find team by slug:', slugOrId);
        }
      } 
      // CASE B: No target (Admin Dashboard)
      else {
        const result = await (supabase as any)
          .from('client_teams')
          .select('*')
          .eq('is_active', true)
          .order('name');
        data = result.data || [];
      }

      return data.map((team: any) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        booking_slug: team.booking_slug,
        isActive: team.is_active,
        createdAt: team.created_at,
        updatedAt: team.updated_at
      }));
    } catch (err) {
      console.error('Error in fetchClientTeams:', err);
      return [];
    }
  };

  // 2. Fetch Members
  const fetchTeamMembers = async (currentTeams: ClientTeam[]) => {
    try {
      // ✅ PUBLIC PATH: We found a specific team in step 1
      if (slugOrId && currentTeams.length === 1) {
        const activeTeam = currentTeams[0]; // This is the resolved team (e.g., Sunday Natural)
        
        console.log('🔍 Resolving members for Team ID:', activeTeam.id);
        
        // NOW we pass the UUID (activeTeam.id) to the secure function
        const { data, error } = await (supabase as any)
          .rpc('get_public_team_members_by_id', { client_team_id_param: activeTeam.id });

        if (error) throw error;

        return (data || []).map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role_name,
          clientTeams: [activeTeam], // Attached correctly
          googleCalendarConnected: true, 
          google_photo_url: member.google_photo_url,
          isActive: member.is_active,
          googleCalendarId: null, // Hidden
          google_profile_data: null, // Hidden
          createdAt: null,
          updatedAt: null
        }));
      } 
      
      // ⚠️ ADMIN PATH: Fetch everyone (Dashboard)
      // Only runs if we didn't search for a specific slug, OR if slug search failed
      if (!slugOrId) {
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
              booking_slug: team.booking_slug,
              // ... map other fields
            }));

          return {
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role_name,
            clientTeams: memberClientTeams,
            googleCalendarConnected: !!member.google_calendar_id,
            google_photo_url: member.google_photo_url,
            isActive: member.is_active,
            // ... other fields
          };
        });
      }

      return []; // Default empty if slug provided but no team found
    } catch (err) {
      console.error('Error in fetchTeamMembers:', err);
      return [];
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get the Team (Resolves "sunday" -> ID)
      const teams = await fetchClientTeams();
      setClientTeams(teams);

      // 2. Get the Members (Uses the ID from step 1)
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
  }, [slugOrId]); 

  return { teamMembers, clientTeams, loading, error, refetch: fetchData };
};