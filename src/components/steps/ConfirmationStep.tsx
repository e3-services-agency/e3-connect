import React, { useState, useMemo } from 'react';
import { StepProps } from '../../types/scheduling';
import { useTeamData } from '../../hooks/useTeamData';
import { GoogleCalendarService } from '../../utils/googleCalendarService';
import { supabase } from '../../integrations/supabase/client';
import { toast } from 'sonner';
import { Textarea } from '../ui/textarea';
import { Calendar, Clock, Users, ChevronDown, ChevronUp, Loader } from 'lucide-react';

const ConfirmationStep: React.FC<StepProps> = ({ appState, onBack, onStateChange }) => {
  const [isBooked, setIsBooked] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [meetingData, setMeetingData] = useState<any>(null);
  
  // FIXED: Pull loading state and teamMembers from the hook to handle async sync
  const { teamMembers, loading } = useTeamData();

  // FIXED: Memoize the mapping of UUIDs to full Member objects to prevent race conditions
  const requiredTeam = useMemo(() => 
    teamMembers.filter(m => appState.requiredMembers.has(m.id)), 
  [teamMembers, appState.requiredMembers]);

  const optionalTeam = useMemo(() => 
    teamMembers.filter(m => appState.optionalMembers.has(m.id)), 
  [teamMembers, appState.optionalMembers]);

  // Local state for editing booking details
  const [sessionTitle, setSessionTitle] = useState(() => {
    if (appState.bookingTitle) return appState.bookingTitle;
    
    // Get client name from URL slug or client team
    const getClientName = () => {
      const path = window.location.pathname;
      const slug = path.split('/').pop();
      
      // Map URL slugs to proper client team names
      const slugToNameMap: Record<string, string> = {
        'atr': 'ATR',
        'puig': 'PUIG', 
        'co-founders': 'Co-Founders',
        'sn': 'Sunday Natural'
      };
      
      // First try to get name from slug mapping
      if (slug && slugToNameMap[slug]) {
        return slugToNameMap[slug];
      }
      
      // Try to get from team members' client teams
      // FIXED: Use the memoized requiredTeam for the fallback logic
      if (requiredTeam.length > 0 && requiredTeam[0]?.clientTeams?.[0]?.name) {
        return requiredTeam[0].clientTeams[0].name;
      }
      
      return 'Client';
    };
    
    return `${getClientName()} x E3 Session`;
  });
  
  const [sessionTopic, setSessionTopic] = useState(appState.bookingTopic || '');
  const [sessionDescription, setSessionDescription] = useState(appState.bookingDescription || '');

  const confirmBooking = async () => {
    // SAFETY CHECK: Ensure data has synced from the database hook before proceeding
    if (requiredTeam.length === 0 && appState.requiredMembers.size > 0) {
      toast.error('Syncing team participant details... please wait a moment.');
      return;
    }

    if (!appState.selectedTime || !appState.selectedDate || !sessionTopic.trim()) {
      if (!sessionTopic.trim()) {
        toast.error('Please add a topic for the meeting');
        return;
      }
      toast.error('Missing required booking information');
      return;
    }

    setIsBooking(true);
    
    try {
      // CRITICAL FIX: Proper timezone handling for date/time
      const userTimezone = appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('Creating meeting with timezone:', userTimezone);
      console.log('Selected time string:', appState.selectedTime);
      
      // Parse the selected time correctly - it's already in ISO format but we need to ensure proper timezone handling
      const startTime = new Date(appState.selectedTime);
      console.log('Parsed start time:', startTime.toISOString());
      console.log('Start time in user timezone:', startTime.toLocaleString("en-US", {timeZone: userTimezone}));
      
      // FIXED: Ensure duration is properly set with fallback
      const meetingDuration = appState.duration || 30;
      const endTime = new Date(startTime.getTime() + meetingDuration * 60000);
      console.log('End time:', endTime.toISOString());

      // Get selected team members (Using memoized lists)
      const allMembers = [...requiredTeam, ...optionalTeam];

      // Prepare attendee emails
      const guestEmailsArray = Array.isArray(appState.guestEmails) ? appState.guestEmails : [];
      const attendeeEmails = [
        ...allMembers.map(m => m.email),
        ...guestEmailsArray
      ];

      // Add booker email if provided
      if (appState.bookerEmail && !attendeeEmails.includes(appState.bookerEmail)) {
        attendeeEmails.push(appState.bookerEmail);
      }

      // Use the current session title and description
      const meetingTitle = `💼${sessionTitle.trim()} – ${sessionTopic.trim()}`;
      const meetingDescription = `${sessionTopic.trim()}\n\n${sessionDescription.trim()}`;

      // Save meeting to database
      const { data: meeting, error: dbError } = await (supabase as any)
        .from('meetings')
        .insert({
          title: meetingTitle,
          description: meetingDescription,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          organizer_email: requiredTeam[0]?.email || 'admin@e3-services.com',
          attendee_emails: attendeeEmails,
          status: 'scheduled',
          client_team_id: appState.clientTeamId
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to save meeting to database');
      }

      // Get current page URL for the booking system link
      const currentUrl = window.location.href;
      const bookingSystemLink = `<a href="${currentUrl}">E3 Connect Booking System</a>`;

      // Create formatted calendar event description with proper formatting
      let calendarDescription = `📌 <b>Session Details</b><br>`;
      calendarDescription += `Topic: ${sessionTopic}<br>`;
      if (sessionDescription.trim()) {
        calendarDescription += `Description: ${sessionDescription}<br>`;
      }
      calendarDescription += `<br>---<br>`;
      calendarDescription += `🗓️ <b>Scheduling Details</b><br>`;
      calendarDescription += `Scheduled via: ${bookingSystemLink}<br>`;
      calendarDescription += `Booked by: ${appState.bookerEmail || 'N/A'}<br>`;
      calendarDescription += `Required Attendee(s): ${requiredTeam.map(m => m.name).join(', ')}<br>`;
      if (optionalTeam.length > 0) {
        calendarDescription += `Optional Attendee(s): ${optionalTeam.map(m => m.name).join(', ')}<br>`;
      }


      // Create calendar event
      const eventData = {
        summary: meetingTitle,
        description: calendarDescription,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: userTimezone
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: userTimezone
        },
        attendees: attendeeEmails.map(email => ({ email }))
      };

      // Create calendar event using the first required member's calendar
      const organizerEmail = requiredTeam[0]?.email || 'admin@e3-services.com';
      const calendarResult = await GoogleCalendarService.createEvent(organizerEmail, eventData);

      console.log('Calendar result:', calendarResult);

      // Update meeting with Google event ID and Meet link
      let finalMeetingData = meeting;
      if (calendarResult?.event?.id) {
        const meetLink = calendarResult.event.conferenceData?.entryPoints?.find(
          (entry: any) => entry.entryPointType === 'video'
        )?.uri;

        const { data: updatedMeeting } = await (supabase as any)
          .from('meetings')
          .update({ 
            google_event_id: calendarResult.event.id,
            google_meet_link: meetLink || null
          })
          .eq('id', meeting.id)
          .select()
          .single();

        finalMeetingData = updatedMeeting || meeting;
        console.log('Google Meet link saved:', meetLink);
      }

      setMeetingData(finalMeetingData);
      toast.success('Meeting booked successfully! Calendar invites have been sent.');
      setIsBooked(true);
    } catch (error) {
      console.error('Error booking meeting:', error);
      toast.error(`Failed to book meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBooking(false);
    }
  };

  const resetFlow = () => {
    onStateChange({
      currentStep: 1,
      duration: null,
      requiredMembers: new Set<string>(),
      optionalMembers: new Set<string>(),
      selectedDate: null,
      selectedTime: null,
      guestEmails: [],
      bookingTitle: undefined,
      bookingTopic: undefined,
      bookingDescription: undefined,
      bookerName: undefined,
      bookerEmail: undefined
    });
  };

  const handleTitleChange = (value: string) => {
    setSessionTitle(value);
    onStateChange({ bookingTitle: value });
  };
  
  const handleTopicChange = (value: string) => {
    setSessionTopic(value);
    onStateChange({ bookingTopic: value });
  };

  const handleDescriptionChange = (value: string) => {
    setSessionDescription(value);
    onStateChange({ bookingDescription: value });
  };

  // FIXED: Added Loading Guard to prevent rendering the UI until team details are synced
  if (loading && !isBooked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-e3-white">
        <Loader className="w-10 h-10 animate-spin text-e3-emerald mb-4" />
        <p>Syncing team participant details...</p>
      </div>
    );
  }

  if (!appState.selectedTime) return null;

  const selectedTime = new Date(appState.selectedTime);
  const userTimezone = appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  console.log('=== CONFIRMATION STEP DEBUG ===');
  console.log('Selected time from state:', appState.selectedTime);
  console.log('Selected date from state:', appState.selectedDate);
  console.log('User timezone:', userTimezone);
  console.log('Duration from state:', appState.duration);
  console.log('Parsed selected time:', selectedTime.toISOString());
  console.log('Selected time in user TZ:', selectedTime.toLocaleString("en-US", {timeZone: userTimezone}));
  
  // FIXED: Force 24-hour format for time display consistently
  const timeString = selectedTime.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false, // Force 24-hour format
    timeZone: userTimezone
  });
  
  // CRITICAL FIX: Use the selected time itself for date, don't rely on selectedDate string
  const dateString = selectedTime.toLocaleDateString([], { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: userTimezone
  });
  
  console.log('Formatted date string:', dateString);
  console.log('Formatted time string:', timeString);
  
  // FIXED: Use memoized values for UI display to ensure data is present
  const requiredTeamDisplay = requiredTeam;
  const optionalTeamDisplay = optionalTeam;

  // FIXED: Ensure duration is properly displayed with fallback
  const meetingDuration = appState.duration || 30;

  if (isBooked) {
    return (
      <div className="step animate-fade-in text-center max-w-2xl mx-auto" aria-labelledby="success-heading">
        <div className="w-16 h-16 bg-e3-emerald/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Calendar className="w-8 h-8 text-e3-emerald" />
        </div>
        <h2 id="success-heading" className="text-2xl font-bold text-e3-emerald mb-4">
          Meeting Scheduled Successfully!
        </h2>
        <p className="text-e3-white/80 mb-6">Your meeting has been scheduled and calendar invites have been sent to all attendees.</p>
        
        {/* Google Meet Link */}
        {meetingData?.google_meet_link && (
          <div className="bg-e3-emerald/10 border border-e3-emerald/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="w-5 h-5 text-e3-emerald" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.5l-6.5-6.5v4h-8.5c-1.1 0-2 .9-2 2s.9 2 2 2h8.5v4L24 12.5zM7 16H3c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h4v8z"/>
              </svg>
              <span className="text-e3-emerald font-semibold">Google Meet Link</span>
            </div>
            <a
              href={meetingData.google_meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-e3-emerald text-e3-space-blue px-4 py-2 rounded-lg hover:bg-e3-emerald/90 transition-colors font-medium"
            >
              Join Meeting
            </a>
            <p className="text-e3-white/70 text-xs mt-2">
              This link has been included in your calendar invitation
            </p>
          </div>
        )}
        
        {/* Improved Success Summary with Better Layout */}
        <div className="bg-e3-space-blue/30 rounded-lg p-6 mb-6 text-left border border-e3-emerald/20">
          <h3 className="text-lg font-semibold text-e3-emerald mb-4 text-center">Booking Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div className="flex justify-between sm:block">
              <span className="text-e3-azure font-medium">Topic:</span>
              <span className="text-e3-white sm:block">{sessionTopic}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-e3-azure font-medium">Title:</span>
              <span className="text-e3-white sm:block">{sessionTitle}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-e3-azure font-medium">Date:</span>
              <span className="text-e3-white sm:block">{dateString}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-e3-azure font-medium">Time:</span>
              <span className="text-e3-white sm:block">{timeString}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-e3-azure font-medium">Duration:</span>
              <span className="text-e3-white sm:block">{meetingDuration} minutes</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-e3-azure font-medium">Timezone:</span>
              <span className="text-e3-white sm:block">{userTimezone}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-e3-azure font-medium">Booked By:</span>
              <span className="text-e3-white sm:block">{appState.bookerName || 'Guest'}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-e3-azure font-medium">Contact:</span>
              <span className="text-e3-white sm:block">{appState.bookerEmail}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-e3-azure font-medium">Required:</span>
              <span className="text-e3-white ml-2">{requiredTeamDisplay.map(m => m.name).join(', ')}</span>
            </div>
            {optionalTeamDisplay.length > 0 && (
              <div className="sm:col-span-2">
                <span className="text-e3-azure font-medium">Optional:</span>
                <span className="text-e3-white ml-2">{optionalTeamDisplay.map(m => m.name).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={resetFlow} 
          className="cta focusable"
        >
          Schedule Another Meeting
        </button>
      </div>
    );
  }

  return (
    <div className="step animate-fade-in" aria-labelledby="step6-heading">
      <h2 id="step6-heading" className="text-2xl font-bold text-e3-white text-center mb-8">6. Confirm Your Booking</h2>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Session Title */}
        <div className="bg-e3-space-blue/70 p-4 sm:p-6 rounded-lg border border-e3-white/10">
          <label className="block text-sm font-medium text-e3-emerald mb-3">
            Session Title
            <span className="text-e3-white/60 text-xs ml-2">Add a clear name for this meeting to help participants recognize it easily</span>
          </label>
          <input
            type="text"
            value={sessionTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full bg-e3-space-blue/50 border border-e3-white/20 rounded-lg px-4 py-3 text-e3-white placeholder-e3-white/60 focus:border-e3-azure outline-none text-base sm:text-lg"
            placeholder="Enter session title..."
          />
        </div>

        {/* TOPIC Section - Required */}
        <div className="bg-e3-space-blue/70 p-4 sm:p-6 rounded-lg border border-e3-white/10">
          <label className="block text-sm font-medium text-e3-emerald mb-3">
            Topic <span className="text-red-400">*</span>
            <span className="text-e3-white/60 text-xs ml-2">What will you be discussing in this meeting?</span>
          </label>
          <input
            type="text"
            value={sessionTopic}
            onChange={(e) => handleTopicChange(e.target.value)}
            className="w-full bg-e3-space-blue/50 border border-e3-white/20 rounded-lg px-4 py-3 text-e3-white placeholder-e3-white/60 focus:border-e3-azure outline-none text-base sm:text-lg"
            placeholder="e.g., Project kickoff, Strategy review, Product demo..."
            required
          />
          {!sessionTopic.trim() && (
            <p className="text-red-400 text-xs mt-1">Topic is required to proceed</p>
          )}
        </div>

        {/* Meeting Details - WHEN & WHO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WHEN Section */}
          <div className="bg-e3-space-blue/70 p-4 sm:p-6 rounded-lg border border-e3-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-e3-emerald" />
              <h3 className="text-lg font-semibold text-e3-emerald">WHEN</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-e3-azure" />
                <span className="text-e3-white text-sm sm:text-base">{dateString}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-e3-azure" />
                <span className="text-e3-white text-sm sm:text-base">{timeString}</span>
              </div>
              <div className="text-e3-white/80 text-sm">
                Duration: {meetingDuration} minutes
              </div>
              <div className="text-e3-white/80 text-sm">
                Timezone: {userTimezone}
              </div>
            </div>
          </div>

          {/* WHO Section */}
          <div className="bg-e3-space-blue/70 p-4 sm:p-6 rounded-lg border border-e3-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-e3-emerald" />
              <h3 className="text-lg font-semibold text-e3-emerald">WHO</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-e3-azure mb-1">Required Team</div>
                <div className="space-y-1">
                  {requiredTeamDisplay.map(m => (
                    <div key={m.id} className="text-e3-white text-sm">
                      {m.name} <span className="text-e3-white/60">({m.role})</span>
                    </div>
                  ))}
                </div>
              </div>
              {optionalTeamDisplay.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-e3-azure mb-1">Optional Team</div>
                  <div className="space-y-1">
                    {optionalTeamDisplay.map(m => (
                      <div key={m.id} className="text-e3-white text-sm">
                        {m.name} <span className="text-e3-white/60">({m.role})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {appState.guestEmails && appState.guestEmails.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-e3-azure mb-1">Guest Invitees</div>
                  <div className="flex flex-wrap gap-1">
                    {appState.guestEmails.map(email => (
                      <span key={email} className="text-xs bg-e3-emerald/20 px-2 py-1 rounded-full text-e3-emerald">
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Booker Information */}
        <div className="bg-e3-space-blue/70 p-4 sm:p-6 rounded-lg border border-e3-white/10">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-e3-emerald" />
            <h3 className="text-lg font-semibold text-e3-emerald">BOOKING CONTACT</h3>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-e3-azure mb-1">Booked by</div>
            <div className="text-e3-white text-sm sm:text-base">
              {appState.bookerName || 'Guest'} ({appState.bookerEmail || 'Not provided'})
            </div>
          </div>
        </div>

        {/* Optional Description Section */}
        <div className="bg-e3-space-blue/70 rounded-lg border border-e3-white/10">
          <button
            onClick={() => setShowDescription(!showDescription)}
            className="w-full p-4 sm:p-6 flex items-center justify-between text-left hover:bg-e3-white/5 transition-colors rounded-lg"
          >
            <span className="text-e3-emerald font-medium">Add description or context (optional)</span>
            {showDescription ? (
              <ChevronUp className="w-5 h-5 text-e3-white/60" />
            ) : (
              <ChevronDown className="w-5 h-5 text-e3-white/60" />
            )}
          </button>
          
          {showDescription && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <Textarea
                value={sessionDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Add meeting notes, agenda, goals, or any relevant context..."
                className="min-h-[120px] bg-e3-space-blue/50 border-e3-white/20 focus:border-e3-azure text-e3-white placeholder-e3-white/60"
              />
              <div className="text-xs text-e3-white/60 mt-2">
                You can include links, bullet points, or any information that would help participants prepare.
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-between gap-4">
          <button 
            onClick={onBack} 
            className="order-2 sm:order-1 py-3 px-6 text-e3-white/80 hover:text-e3-white transition rounded-lg border border-e3-white/20 hover:border-e3-white/40"
          >
            Back
          </button>
          <button 
            onClick={confirmBooking}
            // SAFETY FIX: Disable if IDs are selected but hook hasn't mapped them to objects yet
            disabled={isBooking || !sessionTopic.trim() || (requiredTeamDisplay.length === 0 && appState.requiredMembers.size > 0)}
            className="order-1 sm:order-2 cta disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBooking ? 'Booking...' : 'Confirm & Book Meeting'}
          </button>
        </div>

        {/* Sticky CTA for mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-sm border-t border-e3-white/10 sm:hidden z-50">
          <button 
            onClick={confirmBooking}
            disabled={isBooking || !sessionTopic.trim() || (requiredTeamDisplay.length === 0 && appState.requiredMembers.size > 0)}
            className="w-full cta disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBooking ? 'Booking...' : 'Confirm & Book Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationStep;