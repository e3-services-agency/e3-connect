import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

export const useTeamData = (slug?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Client Teams
  const fetchClientTeams = async () => {
    try {
      let data;
      console.log('🔍 [1] Fetching Client Team for slug:', slug); 

      if (slug) {
        const result = await (supabase as any)
          .rpc('get_client_team_by_slug', { slug_param: slug });
        data = result.data;
        console.log('✅ [1] Client Team Result:', data);
      } else {
        // Admin path
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
      console.error('❌ [1] Error in fetchClientTeams:', err);
      return [];
    }
  };

  // 2. Fetch Members
  const fetchTeamMembers = async (currentTeams: ClientTeam[]) => {
    try {
      if (slug) {
        console.log('🔍 [2] Fetching PUBLIC Members for slug:', slug);

        const { data, error } = await (supabase as any)
          .rpc('get_public_team_members_by_slug', { slug_param: slug });

        if (error) {
           console.error('❌ [2] RPC Error:', error);
           throw error;
        }
        
        console.log('✅ [2] Raw DB Members received:', data);
        
        // Find the team to attach
        const activeTeam = currentTeams.find(t => t.booking_slug === slug) || {
            id: 'virtual-team-id', 
            name: slug.charAt(0).toUpperCase() + slug.slice(1),
            booking_slug: slug,
            description: null,
            isActive: true,
            createdAt: null,
            updatedAt: null
        };
        console.log('ℹ️ [2] Attaching to Team:', activeTeam.name);

        const finalMembers = (data || []).map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role_name,
          clientTeams: [activeTeam], // ATTACH TEAM
          googleCalendarConnected: true, 
          google_photo_url: member.google_photo_url,
          isActive: member.is_active,
          googleCalendarId: null,
          google_profile_data: null,
          createdAt: null,
          updatedAt: null
        }));
        
        console.log('✅ [2] Final Mapped Members:', finalMembers);
        return finalMembers;
      } 
      
      // Admin Path
      console.log('ℹ️ [2] Admin Fetch Path');
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
      console.error('❌ [2] Error in fetchTeamMembers:', err);
      return [];
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🚀 STARTING FETCH for:', slug);
      const teams = await fetchClientTeams();
      const members = await fetchTeamMembers(teams);
      setClientTeams(teams);
      setTeamMembers(members);
      console.log('🏁 FETCH COMPLETE. Members count:', members.length);
    } catch (err) {
      console.error('❌ Fatal Error:', err);
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