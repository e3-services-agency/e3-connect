import React, { useState, useEffect, useRef } from 'react';
import { StepProps } from '../../types/scheduling';
import { useTeamData } from '../../hooks/useTeamData';
import { Loader } from 'lucide-react';

interface TeamStepProps extends StepProps {
  clientTeamFilter?: string;
}

const TeamStep: React.FC<TeamStepProps> = ({ appState, onNext, onBack, onStateChange, clientTeamFilter }) => {

  console.log('RENDER TeamStep');
  console.log(' - Filter Prop:', clientTeamFilter);
  const { teamMembers, loading, error: dataError } = useTeamData(clientTeamFilter);
  console.log(' - Hook State:', { loading, count: teamMembers.length });

  const [error, setError] = useState('');
  
  // --- BUG FIX: Add a ref to prevent infinite URL-sync loops ---
  const hasSyncedFromUrl = useRef(false);

  // --- HELPER: ROBUST FILTER LOGIC ---
  const getFilteredMembers = () => {
    if (!clientTeamFilter) return teamMembers;

    return teamMembers.filter(member => 
      member.clientTeams.some(team => {
        const bookingSlug = (team as any).booking_slug?.toLowerCase();
        const oldSlug = (team as any).slug?.toLowerCase();
        const normalizedName = team.name.toLowerCase().replace(/ /g, '-');
        
        return team.id === clientTeamFilter || 
               bookingSlug === clientTeamFilter ||
               oldSlug === clientTeamFilter ||
               normalizedName === clientTeamFilter ||
               normalizedName.startsWith(clientTeamFilter);
      })
    );
  };

  const filteredTeamMembers = getFilteredMembers();
  
  // --- BUG FIX: Calculate if all are selected for the toggle ---
  const allFilteredSelected = filteredTeamMembers.length > 0 && 
    filteredTeamMembers.every(m => appState.requiredMembers.has(m.id));

  // --- 1. INITIALIZATION LOGIC (Parse URL Params) ---
  useEffect(() => {
    // BUG FIX: Added `hasSyncedFromUrl.current` so this only runs ONCE
    if (loading || teamMembers.length === 0 || hasSyncedFromUrl.current) return;

    const params = new URLSearchParams(window.location.search);
    const requiredParam = params.get('required');
    const optionalParam = params.get('optional');
    const stepParam = params.get('step');

    const findMember = (email: string) => 
      teamMembers.find(m => m.email.toLowerCase() === email.trim().toLowerCase());

    const newRequired = new Set<string>();
    const newOptional = new Set<string>();

    if (requiredParam) {
      decodeURIComponent(requiredParam).split(',').forEach(email => {
        const m = findMember(email);
        if (m) newRequired.add(m.id);
      });
    }

    if (optionalParam) {
      decodeURIComponent(optionalParam).split(',').forEach(email => {
        const m = findMember(email);
        if (m && !newRequired.has(m.id)) newOptional.add(m.id);
      });
    }

    if (newRequired.size > 0 || newOptional.size > 0) {
      onStateChange({
        requiredMembers: newRequired,
        optionalMembers: newOptional
      });

      if (stepParam === 'availability') {
        onNext(); 
      }
    }
    
    // BUG FIX: Lock the initialization so it doesn't fight the user's clicks
    hasSyncedFromUrl.current = true;
  }, [loading, teamMembers, onNext, onStateChange]);

  // --- 2. URL SYNC LOGIC (Update URL when user clicks checkboxes) ---
  useEffect(() => {
    if (loading || teamMembers.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    
    if (params.get('step') === 'availability') return;

    const reqEmails = Array.from(appState.requiredMembers)
      .map(id => teamMembers.find(m => m.id === id)?.email)
      .filter(Boolean)
      .sort()
      .join(',');
      
    const optEmails = Array.from(appState.optionalMembers)
      .map(id => teamMembers.find(m => m.id === id)?.email)
      .filter(Boolean)
      .sort()
      .join(',');

    const currentReq = params.get('required') || '';
    const currentOpt = params.get('optional') || '';

    if (reqEmails !== currentReq || optEmails !== currentOpt) {
      if (reqEmails) params.set('required', reqEmails);
      else params.delete('required');

      if (optEmails) params.set('optional', optEmails);
      else params.delete('optional');

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ ...window.history.state }, '', newUrl);
    }

  }, [appState.requiredMembers, appState.optionalMembers, teamMembers, loading]);


  // --- HANDLERS ---

  // BUG FIX: Upgraded to toggle on/off instead of just selecting all
  const handleToggleAll = () => {
    if (allFilteredSelected) {
      onStateChange({
        requiredMembers: new Set<string>(),
        optionalMembers: new Set<string>()
      });
    } else {
      const allMemberIds = filteredTeamMembers.map(m => m.id);
      onStateChange({
        requiredMembers: new Set(allMemberIds),
        optionalMembers: new Set<string>()
      });
    }
    setError('');
  };

  const toggleMember = (memberId: string, type: 'required' | 'optional') => {
    const newRequiredMembers = new Set(appState.requiredMembers);
    const newOptionalMembers = new Set(appState.optionalMembers);
    
    if (type === 'required') {
      if (newRequiredMembers.has(memberId)) {
        newRequiredMembers.delete(memberId);
      } else {
        newRequiredMembers.add(memberId);
        newOptionalMembers.delete(memberId);
      }
    } else if (type === 'optional') {
      if (newOptionalMembers.has(memberId)) {
        newOptionalMembers.delete(memberId);
      } else {
        newOptionalMembers.add(memberId);
        newRequiredMembers.delete(memberId);
      }
    }
    
    onStateChange({
      requiredMembers: newRequiredMembers,
      optionalMembers: newOptionalMembers
    });
    setError('');
  };

  const confirmTeamSelection = () => {
    if (appState.requiredMembers.size === 0) {
      setError('Please select at least one required team member to find common availability.');
      return;
    }
    onNext();
  };

  if (loading) {
    return (
      <div className="step animate-fade-in flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-e3-white">
          <Loader className="w-6 h-6 animate-spin" />
          <span>Loading team members...</span>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="step animate-fade-in">
        <h2 className="sub-heading mb-6">1. Choose Team Members</h2>
        <div className="text-center py-12">
          <p className="text-e3-flame mb-4">{dataError}</p>
          <p className="text-e3-white/60">Please check your database connection and try again.</p>
        </div>
      </div>
    );
  }

  if (filteredTeamMembers.length === 0) {
    return (
      <div className="step animate-fade-in">
        <h2 className="sub-heading mb-6">1. Choose Team Members</h2>
        <div className="text-center py-12">
          <p className="text-e3-white/60 mb-4">No team members available for this client.</p>
          <p className="text-e3-white/60">Please contact support if this seems incorrect.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="step animate-fade-in pb-48 relative" aria-labelledby="step1-heading">
      <h2 id="step1-heading" className="sub-heading mb-6">1. Choose Team Members</h2>
      
      {/* Select All Checkbox */}
      <div className="mb-4 p-4 bg-e3-space-blue/50 rounded-lg border border-e3-white/10">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={handleToggleAll}
            className="form-checkbox h-5 w-5 text-e3-emerald bg-e3-space-blue border-e3-emerald rounded focus:ring-e3-emerald mr-3"
          />
          <span className="text-e3-emerald font-medium">
            {allFilteredSelected ? 'Unselect All Team Members' : 'Select All Team Members as Required'}
          </span>
        </label>
      </div>
      
      <div id="team-list" className="space-y-4">
        {filteredTeamMembers.map(member => {
          const isRequired = appState.requiredMembers.has(member.id);
          const isOptional = appState.optionalMembers.has(member.id);
          
          return (
            <div key={member.id} className="flex flex-col fsm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-e3-space-blue/70 rounded-lg border border-e3-white/10">
              <div className="flex items-center gap-3 flex-1">
                {/* Profile Photo */}
                {member.google_photo_url ? (
                  <img 
                    src={member.google_photo_url} 
                    alt={member.name}
                    className="w-10 h-10 rounded-full border-2 border-e3-azure/30 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : null}
                <div className={`w-10 h-10 rounded-full bg-e3-azure/20 flex items-center justify-center text-e3-azure text-sm font-bold border-2 border-e3-azure/30 ${member.google_photo_url ? 'hidden' : ''}`}>
                  {member.name.split(' ').map(n => n.charAt(0)).join('')}
                </div>
                
                <div className="flex-1">
                  <p className="font-bold">{member.name}</p>
                  <p className="text-sm text-e3-white/70">{member.role}</p>
                  {member.clientTeams.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {clientTeamFilter ? (
                          member.clientTeams
                            .filter(team => {
                                const bookingSlug = (team as any).booking_slug?.toLowerCase();
                                const normSlug = (team as any).slug?.toLowerCase();
                                const normName = team.name.toLowerCase().replace(/ /g, '-');
                                return team.id === clientTeamFilter || 
                                       bookingSlug === clientTeamFilter ||
                                       normSlug === clientTeamFilter ||
                                       normName.includes(clientTeamFilter);
                            })
                            .slice(0, 3)
                            .map(team => (
                              <span
                                key={team.id}
                                className="px-2 py-0.5 bg-e3-azure/20 text-e3-azure text-xs rounded-full"
                              >
                                {team.name}
                              </span>
                            ))
                        ) : (
                          member.clientTeams.slice(0, 3).map(team => (
                            <span
                              key={team.id}
                              className="px-2 py-0.5 bg-e3-azure/20 text-e3-azure text-xs rounded-full"
                            >
                              {team.name}
                            </span>
                          ))
                        )}
                        {!clientTeamFilter && member.clientTeams.length > 3 && (
                        <span className="px-2 py-0.5 text-e3-white/40 text-xs">
                          +{member.clientTeams.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 sm:mt-0">
                <button
                  onClick={() => toggleMember(member.id, 'required')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isRequired 
                      ? 'bg-emerald-500 text-white border-emerald-500' 
                      : 'bg-e3-space-blue border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  Required
                </button>
                <button
                  onClick={() => toggleMember(member.id, 'optional')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isOptional 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-e3-space-blue border border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
                  }`}
                >
                  Optional
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <div className="text-e3-flame text-sm mt-4">{error}</div>}
      
      {/* Unified Sticky Footer - Fixed at bottom-0 like Availability Step */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-md border-t border-e3-white/10 z-50">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
          <div className="hidden sm:block"></div> {/* Spacer to keep primary button on the right */}
          <button 
            onClick={confirmTeamSelection} 
            className="w-full sm:w-auto cta"
          >
            Find Availability
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamStep;