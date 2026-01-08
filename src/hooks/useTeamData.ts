// useTeamData.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

export const useTeamData = (clientTeamId?: string) => {
  // We use your existing type 'TeamMemberConfig' here to avoid breaking the UI
  // but we will fill it with data from our 'SafeTeamMember' source.
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamMembers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ 1. SECURE PUBLIC PATH
      if (clientTeamId) {
        console.log('🔒 Secure fetching for:', clientTeamId);

        const { data, error } = await supabase
          .rpc('get_safe_public_team_members', { 
            filter_value: clientTeamId 
          });

        if (error) throw error;

        // Transform the flat database rows into the nested shape your UI expects
        const safeMembers = (data || []).map((row: any) => ({
          id: row.member_id,
          name: row.member_name,
          email: row.member_email,
          role: row.member_role,
          google_photo_url: row.member_photo_url,
          isActive: true, // We filtered for active in SQL
          
          // Reconstruct the clientTeams array
          clientTeams: [{
            id: row.client_team_id,
            name: row.client_team_name,
            booking_slug: row.client_team_slug,
            isActive: true
          }],

          // Set sensitive fields to null/defaults
          googleCalendarConnected: false, // UI doesn't need to know the real status for public booking
          googleCalendarId: null, 
          google_profile_data: null, 
          createdAt: null,
          updatedAt: null
        }));

        setTeamMembers(safeMembers);
      } 
      
      // ⚠️ 2. ADMIN PATH (Legacy fallback for Dashboard)
      else {
        console.warn('⚠️ Fetching ALL data (Admin Mode)');
        // ... (Your original code for fetching all members goes here if needed)
        // For now, let's return empty to ensure we are testing the Secure Path
        setTeamMembers([]); 
      }

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