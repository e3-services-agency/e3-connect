import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppState } from '../types/scheduling';
import ProgressBar from '../components/ProgressBar';
import TeamStep from '../components/steps/TeamStep';
import AvailabilityStep from '../components/steps/AvailabilityStep';
import BookerInfoStep from '../components/steps/BookerInfoStep';
import InviteStep from '../components/steps/InviteStep';
import ConfirmationStep from '../components/steps/ConfirmationStep';
import { supabase } from '../integrations/supabase/client';
import e3Logo from '../assets/e3-logo.png';

const ClientBooking: React.FC = () => {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();
  const [clientTeam, setClientTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check if we are rendering inside a website iframe
  const searchParams = new URLSearchParams(window.location.search);
  const isEmbedded = searchParams.get('embed') === 'true';

  const initialState: AppState = {
    currentStep: 1,
    totalSteps: 5,
    duration: 30, // Default to 30 minutes
    requiredMembers: new Set<string>(),
    optionalMembers: new Set<string>(),
    selectedDate: null,
    selectedTime: null,
    guestEmails: [],
    timezone: 'UTC',
    timeFormat: '24h',
    bookingTitle: '',
    bookingDescription: '',
    clientTeamId: '',
    steps: [
      { name: 'TEAM' },
      { name: 'WHEN' },
      { name: 'INFO' },
      { name: 'GUESTS' },
      { name: 'CONFIRM' }
    ]
  };

  const [appState, setAppState] = useState<AppState>(initialState);

  useEffect(() => {
    // Auto-detect user timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setAppState(prev => ({ ...prev, timezone: userTimezone }));

    const loadClientTeam = async () => {
      if (!clientSlug) {
        navigate('/');
        return;
      }

      try {
        console.log('Fetching entity for slug:', clientSlug);
        
        // Use our secure backend function instead of querying tables directly!
        const { data, error } = await supabase.rpc('resolve_booking_slug', { 
          lookup_slug: clientSlug 
        });

        if (error) throw error;

        // 1. Handle Client Team
        if (data && data.type === 'team') {
          console.log('Found team:', data);
          setClientTeam(data);
          setAppState(prev => ({ 
            ...prev, 
            clientTeamId: data.id,
            bookingTitle: `${data.name} x E3`,
            isIndividualBooking: false
          }));
          setLoading(false);
          return;
        }

        // 2. Handle Individual Member
        if (data && data.type === 'member') {
          console.log('Found individual member:', data);
          setClientTeam(data); 
          
          setAppState(prev => ({
            ...prev,
            isIndividualBooking: true,
            individualMember: data,
            requiredMembers: new Set([data.id]), 
            currentStep: 1, 
            totalSteps: 4,  
            bookingTitle: `Meeting with ${data.name}`,
            steps: [
              { name: 'WHEN' },
              { name: 'INFO' },
              { name: 'GUESTS' },
              { name: 'CONFIRM' }
            ]
          }));
          setLoading(false);
          return;
        }

        // Neither found (slug is invalid or inactive)
        console.log('No team or individual found for slug:', clientSlug);
        setLoading(false);

      } catch (error) {
        console.error('An unexpected error occurred while loading:', error);
        navigate('/');
      }
    };

    loadClientTeam();
  }, [clientSlug, navigate]);

  const goNext = () => {
    if (appState.currentStep < appState.totalSteps) {
      setAppState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const goBack = () => {
    if (appState.currentStep > 1) {
      setAppState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  // Using useCallback prevents the infinite state-update loop in child components
  const handleStateChange = useCallback((updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  }, []);

  const renderStep = () => {
    const stepProps = {
      appState,
      onNext: goNext,
      onBack: goBack,
      onStateChange: handleStateChange
    };

    if (appState.isIndividualBooking) {
      switch (appState.currentStep) {
        case 1: return <AvailabilityStep {...stepProps} />;
        case 2: return <BookerInfoStep {...stepProps} />;
        case 3: return <InviteStep {...stepProps} />;
        case 4: return <ConfirmationStep {...stepProps} />;
        default: return <AvailabilityStep {...stepProps} />;
      }
    }

    switch (appState.currentStep) {
      case 1: return <TeamStep {...stepProps} clientTeamFilter={clientTeam?.id} />;
      case 2: return <AvailabilityStep {...stepProps} />;
      case 3: return <BookerInfoStep {...stepProps} />;
      case 4: return <InviteStep {...stepProps} />;
      case 5: return <ConfirmationStep {...stepProps} />;
      default: return <TeamStep {...stepProps} clientTeamFilter={clientTeam?.id} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-e3-space-blue p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-e3-white">
          <div className="w-6 h-6 border-2 border-e3-white/30 border-t-e3-white rounded-full animate-spin" />
          <span>Loading booking page...</span>
        </div>
      </div>
    );
  }

  if (!clientTeam) {
    return (
      <div className="min-h-screen bg-e3-space-blue p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-e3-flame mb-4">Member/Client Not Found</h1>
          <p className="text-e3-white/80">The requested client booking page could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    // Dynamic styling based on whether it is embedded or full screen
    <div className={isEmbedded ? "bg-transparent w-full p-0 sm:p-2" : "min-h-screen bg-e3-space-blue p-4 sm:p-6"}>
      <div className={isEmbedded ? "w-full mx-auto" : "max-w-4xl mx-auto"}>
        
        {!isEmbedded && (
          <header className="mb-4 sm:mb-6 mt-2">
            <div className="flex flex-row items-center justify-between gap-3 sm:gap-6 px-1">
              {/* Logo - Significantly smaller on mobile */}
              <div className="flex-none">
                <a 
                  href={`https://e3-services.com?utm_source=booking&utm_medium=referral&utm_campaign=${clientSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img 
                    src={e3Logo} 
                    alt="E3 Logo" 
                    className="h-6 sm:h-10 hover:opacity-90 transition-opacity cursor-pointer"
                  />
                </a>
              </div>
              
              <div className="flex-1 min-w-0 text-left sm:text-center">
                {/* Title - Compact size to prevent layout breaks */}
                <h1 className="text-base sm:text-2xl font-bold text-e3-emerald leading-tight truncate">
                  {appState.isIndividualBooking ? `Meeting with ${appState.individualMember?.name}` : 'Schedule a Meeting'}
                </h1>
                <p className="text-e3-white/60 text-[10px] sm:text-xs">Follow the steps below to book.</p>
              </div>

              {/* Profile Photo - Compacted for single-row layout */}
              {appState.isIndividualBooking && (
                <div className="flex-none">
                  {appState.individualMember?.google_photo_url ? (
                    <img 
                      src={appState.individualMember.google_photo_url} 
                      alt={appState.individualMember.name} 
                      className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border border-e3-emerald object-cover"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border border-e3-azure bg-e3-azure/20 flex items-center justify-center text-e3-azure font-bold text-[10px]">
                      {appState.individualMember?.name?.split(' ').map((n: string) => n.charAt(0)).join('')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>
        )}
        
        <div className="mb-4">
          <ProgressBar appState={appState} />
        </div>
        
        <main className={isEmbedded ? "px-0" : "px-2 sm:px-0"}>
          {renderStep()}
        </main>
      </div>
    </div>
  );
};

export default ClientBooking;