import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig } from '@/types/team';

export const useTeamData = (clientTeamId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamMembers = async () => {
    // 1. SAFETY CHECK: If no ID is provided, stop here.
    if (!clientTeamId) {
      setLoading(true); 
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔒 Secure fetching for ID:', clientTeamId);

      // 2. CALL SECURE DB FUNCTION
      const { data, error } = await supabase
        .rpc('get_safe_public_team_members', { 
          filter_value: clientTeamId 
        });

      if (error) throw error;

      console.log(`✅ DB returned ${data?.length || 0} members`);

      // 3. TRANSFORM DATA (Flat RPC -> Nested UI Type)
      const safeMembers = (data || []).map((row: any) => ({
        id: row.member_id,
        name: row.member_name,
        email: row.member_email,
        role: row.member_role,
        // We use a dummy ID because the UI needs a string, but the real Role ID is internal
        roleId: '00000000-0000-0000-0000-000000000000', 
        clientTeams: [{
          id: row.client_team_id,
          name: row.client_team_name,
          booking_slug: row.client_team_slug,
          isActive: true
        }],
        // Hardcode sensitive fields to safe defaults
        googleCalendarConnected: false, 
        googleCalendarId: null, 
        google_photo_url: row.member_photo_url,
        google_profile_data: null, 
        isActive: true,
        createdAt: null,
        updatedAt: null
      }));

      setTeamMembers(safeMembers);

    } catch (err: any) {
      console.error('Error in fetchTeamMembers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, [clientTeamId]);

  return { teamMembers, loading, error, refetch: fetchTeamMembers };
};