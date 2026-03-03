
export interface TeamMember {
  id: string; // Changed from number to string for UUID
  name: string;
  role: string;
  email: string;
  availability: Record<string, string[]>;
}

export interface AppState {
  currentStep: number;
  totalSteps: number;
  duration: number | null;
  requiredMembers: Set<string>; // Changed from Set<number> to Set<string>
  optionalMembers: Set<string>; // Changed from Set<number> to Set<string>
  selectedDate: string | null;
  selectedTime: string | null;
  guestEmails: string[];
  timezone: string;
  timeFormat: '12h' | '24h';
  steps: { name: string }[];
  // Booking customization
  bookingTitle?: string;
  bookingTopic?: string;
  bookingDescription?: string;
  bookingImages?: string[];
  bookingLinks?: { name: string; url: string }[];
  clientTeamId?: string;
  // Booker information
  bookerName?: string;
  bookerEmail?: string;
  // Booking type
  isIndividualBooking?: boolean;
  individualMember?: any;
}

export interface StepProps {
  appState: AppState;
  onNext: () => void;
  onBack: () => void;
  onStateChange: (newState: Partial<AppState>) => void;
}

// Adding missing interfaces used in AvailabilityStep
export interface SchedulingData {
  duration: number;
  selectedTeamMembers: string[];
  selectedDate?: string;
  selectedTime?: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  attendees?: {
    name: string;
    email: string;
    type: 'required' | 'optional';
    available: boolean;
  }[];
}
