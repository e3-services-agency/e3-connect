import React, { useState, useEffect } from 'react';
import { StepProps } from '../../types/scheduling';
import { useTeamData } from '../../hooks/useTeamData';
import { Loader } from 'lucide-react';

interface TeamStepProps extends StepProps {
  clientTeamFilter?: string;
}

const TeamStep: React.FC<TeamStepProps> = ({ appState, onNext, onBack, onStateChange, clientTeamFilter }) => {
  const [error, setError] = useState('');
  const { teamMembers, loading, error: dataError } = useTeamData();

  // --- URL AUTO-REDIRECT LOGIC ---
  useEffect(() => {
    // 1. Wait for team members to finish loading
    if (loading || teamMembers.length === 0) return;

    // 2. Check URL params
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get('step');

    // 3. Only auto-advance if URL specifically says "step=availability"
    if (stepParam === 'availability') {
      const requiredParam = params.get('required');
      const optionalParam = params.get('optional');

      const newRequired = new Set<string>();
      const newOptional = new Set<string>();

      // Helper to find a member ID by their email
      const findMember = (email: string) => 
        teamMembers.find(m => m.email.toLowerCase() === email.trim().toLowerCase());

      // Parse 'required' emails from URL
      if (requiredParam) {
        decodeURIComponent(requiredParam).split(',').forEach(email => {
          const m = findMember(email);
          if (m) newRequired.add(m.id);
        });
      }

      // Parse 'optional' emails from URL
      if (optionalParam) {
        decodeURIComponent(optionalParam).split(',').forEach(email => {
          const m = findMember(email);
          if (m && !newRequired.has(m.id)) newOptional.add(m.id);
        });
      }

      // 4. If we found members, update state and JUMP to next step
      if (newRequired.size > 0 || newOptional.size > 0) {
        onStateChange({
          requiredMembers: newRequired,
          optionalMembers: newOptional
        });

        // The required/optional params will stay in the URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('step');
        window.history.replaceState(null, '', newUrl.toString());

        // Jump to next step
        onNext(); 
      }
    }
  }, [loading, teamMembers, onNext, onStateChange]);

  // --- Robust Filter Logic Helper ---
  // Matches "sunday" against "Sunday Natural" or "sunday" slug
  const getFilteredMembers = () => {
    if (!clientTeamFilter) return teamMembers;

    return teamMembers.filter(member => 
      member.clientTeams.some(team => {
        // Handle booking_slug which matches your DB column
        const bookingSlug = (team as any).booking_slug?.toLowerCase();
        const oldSlug = (team as any).slug?.toLowerCase();
        const normalizedName = team.name.toLowerCase().replace(/ /g, '-');
        
        // Check all possible variations
        return team.id === clientTeamFilter || 
               bookingSlug === clientTeamFilter ||
               oldSlug === clientTeamFilter ||
               normalizedName === clientTeamFilter ||
               normalizedName.startsWith(clientTeamFilter);
      })
    );
  };

  // Use the helper to get the list to display
  const filteredTeamMembers = getFilteredMembers();

  // Select all team members functionality
  const handleSelectAll = () => {
    const allMemberIds = filteredTeamMembers.map(m => m.id);
    onStateChange({
      requiredMembers: new Set(allMemberIds),
      optionalMembers: new Set<string>()
    });
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
        newOptionalMembers.delete(memberId); // Cannot be both
      }
    } else if (type === 'optional') {
      if (newOptionalMembers.has(memberId)) {
        newOptionalMembers.delete(memberId);
      } else {
        newOptionalMembers.add(memberId);
        newRequiredMembers.delete(memberId); // Cannot be both
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
    <div className="step animate-fade-in" aria-labelledby="step1-heading">
      <h2 id="step1-heading" className="sub-heading mb-6">1. Choose Team Members</h2>
      
      {/* Select All Checkbox */}
      <div className="mb-4 p-4 bg-e3-space-blue/50 rounded-lg border border-e3-white/10">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            onChange={handleSelectAll}
            className="form-checkbox h-5 w-5 text-e3-emerald bg-e3-space-blue border-e3-emerald rounded focus:ring-e3-emerald mr-3"
          />
          <span className="text-e3-emerald font-medium">Select All Team Members as Required</span>
        </label>
      </div>
      
      <div id="team-list" className="space-y-4">
        {filteredTeamMembers.map(member => {
          const isRequired = appState.requiredMembers.has(member.id);
          const isOptional = appState.optionalMembers.has(member.id);
          
          return (
            <div key={member.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-e3-space-blue/70 rounded-lg border border-e3-white/10">
              <div className="flex items-center gap-3 flex-1">
                {/* Profile Photo - handle Google photos properly */}
                {member.google_photo_url ? (
                  <img 
                    src={member.google_photo_url} 
                    alt={member.name}
                    className="w-12 h-12 rounded-full border-2 border-e3-azure/30 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : null}
                <div className={`w-12 h-12 rounded-full bg-e3-azure/20 flex items-center justify-center text-e3-azure font-bold border-2 border-e3-azure/30 ${member.google_photo_url ? 'hidden' : ''}`}>
                  {member.name.split(' ').map(n => n.charAt(0)).join('')}
                </div>
                
                <div className="flex-1">
                  <p className="font-bold">{member.name}</p>
                  <p className="text-sm text-e3-white/70">{member.role}</p>
                  {member.clientTeams.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {/* Only show client teams that match the filter */}
                        {clientTeamFilter ? (
                          member.clientTeams
                            .filter(team => {
                                // Match logic for display badges
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
      <div className="mt-8 flex justify-end">
        <button onClick={confirmTeamSelection} className="cta focusable">
          Find Availability
        </button>
      </div>
      
      {/* Sticky CTA for mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-sm border-t border-e3-white/10 sm:hidden z-50">
        <button onClick={confirmTeamSelection} className="w-full cta focusable">
          Find Availability
        </button>
      </div>
    </div>
  );
};

export default TeamStep;