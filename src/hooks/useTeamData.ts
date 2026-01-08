import { useState, useEffect } from 'react';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

// 🛑 TEST MODE: No Supabase, just static data to verify UI
export const useTeamData = (slugOrId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API delay
    setTimeout(() => {
      console.log('🧪 TEST MODE: Loading Mock Data for input:', slugOrId);

      // 1. Mock Team (Matches "sunday")
      const mockTeam = {
        id: 'test-team-id',
        name: 'Sunday Natural (MOCK)',
        booking_slug: 'sunday',
        description: 'Test Description',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setClientTeams([mockTeam]);

      // 2. Mock Members
      const mockMembers = [
        {
          id: 'member-1',
          name: 'Test Marcel',
          email: 'marcel@test.com',
          role: 'Co-Founder',
          clientTeams: [mockTeam], // Attached correctly
          googleCalendarConnected: true,
          google_photo_url: null,
          isActive: true,
          googleCalendarId: null,
          google_profile_data: null,
          createdAt: null,
          updatedAt: null
        },
        {
          id: 'member-2',
          name: 'Test Jan',
          email: 'jan@test.com',
          role: 'Developer',
          clientTeams: [mockTeam],
          googleCalendarConnected: true,
          google_photo_url: null,
          isActive: true,
          googleCalendarId: null,
          google_profile_data: null,
          createdAt: null,
          updatedAt: null
        }
      ];

      setTeamMembers(mockMembers);
      setLoading(false);
    }, 500);
  }, [slugOrId]);

  return { teamMembers, clientTeams, loading, error, refetch: () => {} };
};