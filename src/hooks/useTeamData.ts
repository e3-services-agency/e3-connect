// src/hooks/useTeamData.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig } from '@/types/team';

export const useTeamData = (clientTeamId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [loading, setLoading] = useState(false); // Start false to prevent flash
  const [error, setError] = useState<string | null>(null);

  const fetchTeamMembers = async () => {
    // 1. SAFETY: If no ID, clear data and stop.
    if (!clientTeamId) {
      setTeamMembers([]);
      setLoading(false); // Ensure we are NOT loading
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔒 Secure fetching for ID:', clientTeamId);

      const { data, error } = await supabase
        .rpc('get_safe_public_team_members', { 
          filter_value: clientTeamId 
        });

      if (error) throw error;

      console.log(`✅ DB returned ${data?.length || 0} members`);

      // 2. TRANSFORM DATA
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