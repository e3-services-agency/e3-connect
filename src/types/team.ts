
export interface TeamMemberConfig {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId: string; // Add role_id for foreign key relationship
  clientTeams: ClientTeam[]; // Changed from single clientTeam to array
  googleCalendarConnected: boolean;
  googleCalendarId?: string;
  google_photo_url?: string;  // Added Google photo field
  google_profile_data?: any;  // Added Google profile data field
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientTeam {
  id: string;
  name: string;
  description?: string;
  booking_slug?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberClientTeam {
  id: string;
  teamMemberId: string;
  clientTeamId: string;
  createdAt: string;
}

export interface AdminGoogleCredentials {
  id: string;
  adminEmail: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  domain: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  googleEventId?: string;
  organizerEmail: string;
  attendeeEmails: string[];
  status: 'scheduled' | 'cancelled' | 'completed';
  clientTeamId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafeTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  google_photo_url: string | null;
  clientTeams: {
    id: string;
    name: string;
    booking_slug: string;
  }[];
}