import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

export const useTeamData = (slugOrId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. Fetch Client Teams (Context)
      const { data: teamsData, error: teamsError } = await supabase
        .from('client_teams')
        .select('*')
        .eq('is_active', true);

      if (teamsError) throw teamsError;

      const mappedTeams = (teamsData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        booking_slug: t.booking_slug,
        description: t.description,
        isActive: t.is_active,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));
      setClientTeams(mappedTeams);

      // 2. Resolve Input to Target ID
      let targetTeamId = slugOrId;
      
      // If input is a Slug (e.g. "sunday"), look up the ID from the teams we just fetched
      if (slugOrId && slugOrId.length < 36) {
        const foundTeam = mappedTeams.find(t => t.booking_slug === slugOrId);
        if (foundTeam) {
          targetTeamId = foundTeam.id;
          console.log(`✅ Resolved slug "${slugOrId}" to ID: ${targetTeamId}`);
        }
      }

      // 3. Fetch Real Members from Database
      if (targetTeamId) {
        console.log(`🔍 Fetching DB members for Team ID: ${targetTeamId}`);
        
        // Direct Join (Works because tables are Unlocked/Public Read)
        const { data: directData, error: directError } = await supabase
          .from('team_members')
          .select(`
            id, name, email, google_photo_url, is_active, role_id,
            member_roles(name),
            team_member_client_teams!inner(client_team_id)
          `)
          .eq('team_member_client_teams.client_team_id', targetTeamId)
          .eq('is_active', true);
            
        if (directError) throw directError;

        // ✅ CRITICAL: Find the team object that matches the Target ID exactly.
        // This ensures the TeamStep.tsx filter (which uses this ID) allows the members through.
        const activeTeam = mappedTeams.find(t => t.id === targetTeamId);

        if (!activeTeam) {
            console.warn(`⚠️ Team ID ${targetTeamId} not found in client_teams list.`);
        }

        const mappedMembers = (directData || []).map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.member_roles?.name || 'Team Member',
          // We attach the activeTeam. If missing (rare), we fallback to a placeholder with the CORRECT ID.
          clientTeams: [activeTeam || { id: targetTeamId, name: 'Current Team', booking_slug: 'unknown' }], 
          googleCalendarConnected: true,
          google_photo_url: member.google_photo_url,
          isActive: member.is_active,
          googleCalendarId: null,
          google_profile_data: null,
          createdAt: null,
          updatedAt: null
        }));

        console.log(`✅ Loaded ${mappedMembers.length} members from DB`);
        setTeamMembers(mappedMembers);
      } 
      // 4. Admin Dashboard Fallback
      else if (!slugOrId) {
        const { data: allMembers } = await supabase
          .from('team_members')
          .select(`*, member_roles(name)`)
          .eq('is_active', true);

         if (allMembers) {
             const adminMembers = allMembers.map((m:any) => ({
                 id: m.id, 
                 name: m.name, 
                 email: m.email, 
                 role: m.member_roles?.name,
                 clientTeams: [], 
                 isActive: m.is_active,
                 googleCalendarConnected: !!m.google_calendar_id,
                 google_photo_url: m.google_photo_url,
                 createdAt: m.created_at,
                 updatedAt: m.updated_at
             }));
             setTeamMembers(adminMembers);
         }
      }

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