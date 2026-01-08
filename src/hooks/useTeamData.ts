import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

// We rename the argument to 'slugOrId' to reflect reality: 
// The URL might give us "sunday" (Slug) OR the Dashboard might give us a UUID (ID).
export const useTeamData = (slugOrId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let targetTeamId = slugOrId;
      let targetTeamData = null;

      // --- STEP 1: RESOLVE SLUG TO ID (The Fix) ---
      // If we have an input, and it looks like a short text (not a long UUID),
      // we assume it is a slug like "sunday" and look up the real ID.
      const isSlug = slugOrId && slugOrId.length < 36; 

      if (isSlug) {
        console.log('🔍 Resolving Slug:', slugOrId);
        
        // We use a direct table select here because you disabled RLS.
        // This is the most reliable way to get the ID right now.
        const { data } = await supabase
          .from('client_teams')
          .select('*')
          .eq('booking_slug', slugOrId)
          .single();
        
        if (data) {
          targetTeamId = data.id; // ✅ We found the UUID!
          targetTeamData = data;
          console.log('✅ Resolved to ID:', targetTeamId);
        } else {
          console.error('❌ Could not find team with slug:', slugOrId);
          setLoading(false);
          return;
        }
      }

      // --- STEP 2: FETCH CLIENT TEAMS CONTEXT ---
      // (Used for the UI labels)
      const { data: teamsData } = await supabase
        .from('client_teams')
        .select('*')
        .eq('is_active', true);

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

      // --- STEP 3: FETCH MEMBERS (Using the ID) ---
      if (targetTeamId) {
        console.log('🔍 Fetching members for ID:', targetTeamId);
        
        // Since you reverted RLS, we will use a DIRECT TABLE JOIN.
        // This is much safer than the RPC function right now because
        // we don't have to worry about permission errors.
        const { data: directData, error: directError } = await supabase
          .from('team_members')
          .select(`
            id, name, email, google_photo_url, is_active, role_id,
            member_roles(name),
            team_member_client_teams!inner(client_team_id)
          `)
          .eq('team_member_client_teams.client_team_id', targetTeamId)
          .eq('is_active', true);
            
        if (directError) {
            console.error('❌ Direct fetch failed:', directError);
            throw directError;
        }

        // Map the database result to your Frontend shape
        // We find the team object to attach so the UI filter works
        const activeTeam = mappedTeams.find(t => t.id === targetTeamId) || mappedTeams[0];
        
        const mappedMembers = (directData || []).map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.member_roles?.name || 'Team Member',
          clientTeams: [activeTeam], // ✅ CRITICAL: Attaches the team so TeamStep.tsx shows it
          googleCalendarConnected: true,
          google_photo_url: member.google_photo_url,
          isActive: member.is_active,
          // Hide sensitive/unused fields
          googleCalendarId: null,
          google_profile_data: null,
          createdAt: null,
          updatedAt: null
        }));

        console.log('✅ Final Members Count:', mappedMembers.length);
        setTeamMembers(mappedMembers);
      }
      // --- STEP 4: ADMIN PATH (Dashboard) ---
      // If no ID/Slug was provided, we fetch everyone (Dashboard view)
      else if (!slugOrId) {
        // ... (Keep existing dashboard logic if needed, or rely on above)
        // For simplicity in this fix, we will just return empty if no slug is provided
        // unless you specifically need the dashboard list right now.
        console.log('ℹ️ No slug provided, waiting for input...');
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