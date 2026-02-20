// src/hooks/useTeamData.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig } from '@/types/team';

export const useTeamData = (clientTeamId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<any[]>([]); // Added clientTeams state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (clientTeamId) {
        // 🔒 PUBLIC MODE: Secure fetching for public booking page
        console.log('🔒 Secure fetching for ID:', clientTeamId);

        const { data, error } = await supabase
          .rpc('get_safe_public_team_members', { 
            filter_value: clientTeamId 
          });

        if (error) throw error;

        const safeMembers = (data || []).map((row: any) => ({
          id: row.member_id,
          name: row.member_name,
          email: row.member_email,
          role: row.member_role,
          roleId: '00000000-0000-0000-0000-000000000000', 
          clientTeams: [{
            id: row.client_team_id,
            name: row.client_team_name,
            booking_slug: row.client_team_slug,
            isActive: true
          }],
          googleCalendarConnected: false, 
          googleCalendarId: null, 
          google_photo_url: row.member_photo_url,
          google_profile_data: null, 
          isActive: true,
          createdAt: null,
          updatedAt: null
        }));

        setTeamMembers(safeMembers);
        
      } else {
        // 🔓 ADMIN MODE: Fetch everything for the dashboard
        console.log('🔓 Admin fetching all team data');
        
        // 1. Fetch Client Teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('client_teams')
          .select('*')
          .order('name');
          
        if (teamsError) throw teamsError;
        
        const mappedTeams = (teamsData || []).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          booking_slug: t.booking_slug,
          isActive: t.is_active,
        }));
        
        setClientTeams(mappedTeams);

        // 2. Fetch Team Members with their relations
        const { data: membersData, error: membersError } = await supabase
          .from('team_members')
          .select(`
            *,
            member_roles (name),
            team_member_client_teams (
              client_teams (id, name, booking_slug, is_active)
            )
          `)
          .order('name');

        if (membersError) throw membersError;

        const mappedMembers = (membersData || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.member_roles?.name || 'Unknown',
          roleId: m.role_id,
          clientTeams: (m.team_member_client_teams || [])
            .map((tmct: any) => tmct.client_teams)
            .filter(Boolean)
            .map((ct: any) => ({
              id: ct.id,
              name: ct.name,
              booking_slug: ct.booking_slug,
              isActive: ct.is_active
            })),
          googleCalendarConnected: m.google_calendar_connected || false,
          googleCalendarId: m.google_calendar_id,
          google_photo_url: m.google_photo_url,
          google_profile_data: m.google_profile_data,
          isActive: m.is_active,
          createdAt: m.created_at,
          updatedAt: m.updated_at
        }));

        setTeamMembers(mappedMembers);
      }

    } catch (err: any) {
      console.error('Error in fetchTeamMembers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientTeamId]);

  return { teamMembers, clientTeams, loading, error, refetch: fetchData };
};