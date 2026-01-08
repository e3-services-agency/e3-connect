import { useState, useEffect } from 'react';
import { TeamMemberConfig, ClientTeam } from '@/types/team';

// 🧪 SMART TEST MODE
export const useTeamData = (slugOrId?: string) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>([]);
  const [clientTeams, setClientTeams] = useState<ClientTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      console.log('🧪 TEST MODE: Generating data for input:', slugOrId);

      // CRITICAL FIX: We use the input (slugOrId) as the Team ID
      // This guarantees the TeamStep filter will match it!
      const mockTeamId = slugOrId || 'default-test-id';

      // 1. Create a Mock Team that matches the input
      const mockTeam = {
        id: mockTeamId, // <--- MATCHING ID
        name: 'Sunday Natural (MOCK)',
        booking_slug: 'sunday',
        description: 'Test Description',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setClientTeams([mockTeam]);

      // 2. Mock Members attached to THAT team
      const mockMembers = [
        {
          id: 'member-1',
          name: 'Test Marcel',
          email: 'marcel@test.com',
          role: 'Co-Founder',
          clientTeams: [mockTeam], // <--- Attached to matching team
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