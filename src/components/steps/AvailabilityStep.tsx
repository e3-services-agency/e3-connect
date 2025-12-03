import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Users, ChevronLeft, ChevronRight, Info, Filter } from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfMonth, endOfMonth, endOfWeek, eachDayOfInterval, eachMinuteOfInterval, isWithinInterval } from 'date-fns';
import { useTeamData } from '../../hooks/useTeamData';
import { supabase } from '../../integrations/supabase/client';
import { StepProps, TimeSlot } from '../../types/scheduling';
import { TimezoneSelector } from '../TimezoneSelector';
import { useBusinessHours } from '../../hooks/useBusinessHours';

interface AvailabilityStepProps extends StepProps {
  clientTeamFilter?: string;
}

interface BusySlot {
  start: string;
  end: string;
}

interface SchedulingWindowSettings {
  min_notice_hours: number;
  max_advance_days: number;
  availability_type: string;
}

const AvailabilityStep: React.FC<AvailabilityStepProps> = ({ appState, onNext, onBack, onStateChange, clientTeamFilter }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyBusySchedule, setMonthlyBusySchedule] = useState<Record<string, BusySlot[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyAllAvailable, setShowOnlyAllAvailable] = useState(false);
  const [schedulingSettings, setSchedulingSettings] = useState<SchedulingWindowSettings | null>(null);
  
  const { teamMembers } = useTeamData();
  const { businessHours, getWorkingHoursForDate, isWorkingDay } = useBusinessHours(clientTeamFilter);

  // Filter team members who have calendar connections
  const connectedMembers = teamMembers.filter(member => 
    member.googleCalendarConnected || member.email
  );

  // Get selected team members with calendar access - memoize to prevent infinite loops
  const selectedMembers = useMemo(() => {
    const requiredMembers = Array.from(appState.requiredMembers)
      .map(memberId => connectedMembers.find(m => m.id === memberId))
      .filter(Boolean);
    
    const optionalMembers = Array.from(appState.optionalMembers)
      .map(memberId => connectedMembers.find(m => m.id === memberId))
      .filter(Boolean);
    
    return { required: requiredMembers, optional: optionalMembers, all: [...requiredMembers, ...optionalMembers] };
  }, [appState.requiredMembers, appState.optionalMembers, connectedMembers]);

  const selectedMemberEmails = useMemo(() => {
    return {
      required: selectedMembers.required.map(member => member?.email).filter(Boolean) as string[],
      all: selectedMembers.all.map(member => member?.email).filter(Boolean) as string[]
    };
  }, [selectedMembers]);

  // Generate calendar days for full month view - start from Monday
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }); // Monday = 1
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Load scheduling window settings
  useEffect(() => {
    const loadSchedulingSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('scheduling_window_settings')
          .select('min_notice_hours, max_advance_days, availability_type')
          .eq('is_active', true)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setSchedulingSettings({
            min_notice_hours: data.min_notice_hours || 4,
            max_advance_days: data.max_advance_days || 60,
            availability_type: data.availability_type || 'available_now'
          });
        } else {
          // Default settings
          setSchedulingSettings({
            min_notice_hours: 4,
            max_advance_days: 60,
            availability_type: 'available_now'
          });
        }
      } catch (error) {
        console.error('Error loading scheduling settings:', error);
        // Use defaults on error
        setSchedulingSettings({
          min_notice_hours: 4,
          max_advance_days: 60,
          availability_type: 'available_now'
        });
      }
    };

    loadSchedulingSettings();
  }, []);

  // Load busy schedule for entire month when currentMonth or selectedMemberEmails change
  useEffect(() => {
    const loadMonthlyAvailability = async () => {
      console.log('loadMonthlyAvailability triggered, selectedMemberEmails:', selectedMemberEmails);
      
      if (selectedMemberEmails.required.length === 0) {
        console.log('No required member emails, clearing schedule');
        setMonthlyBusySchedule({});
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // Calculate time range for entire visible calendar grid - start from Monday
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        
        const timeMin = start.toISOString();
        const timeMax = end.toISOString();

        console.log('Loading monthly availability for period:', timeMin, 'to', timeMax);
        console.log('Required members:', selectedMemberEmails.required);
        console.log('All members (required + optional):', selectedMemberEmails.all);
        
        // Call google-auth edge function to get busy schedule for ALL members (required + optional)
        const { data, error } = await supabase.functions.invoke('google-auth', {
          body: {
            action: 'check_availability',
            userEmails: selectedMemberEmails.all, // Get availability for all members
            eventData: { timeMin, timeMax }
          }
        });

        console.log('API response:', data, 'error:', error);

        if (error) throw error;

        // Process the data to maintain per-member busy schedules
        const memberBusySchedules: Record<string, BusySlot[]> = {};
        
        if (data?.availability?.calendars) {
          console.log('Processing calendar data:', data.availability.calendars);
          
          // The API returns calendars keyed by email
          Object.entries(data.availability.calendars).forEach(([email, calendar]: [string, any]) => {
            if (Array.isArray(calendar.busy)) {
              memberBusySchedules[email] = calendar.busy;
              console.log(`Member ${email} has ${calendar.busy.length} busy slots`);
            } else {
              memberBusySchedules[email] = [];
              console.log(`Member ${email} has no busy slots`);
            }
          });
        }

        console.log('Member busy schedules:', memberBusySchedules);
        
        // Store the per-member busy schedules
        setMonthlyBusySchedule(memberBusySchedules);
      } catch (error) {
        console.error('Error loading monthly availability:', error);
        setError('Failed to load availability');
        setMonthlyBusySchedule({});
      } finally {
        setLoading(false);
      }
    };

    loadMonthlyAvailability();
  }, [currentMonth, selectedMemberEmails.all.length > 0 ? selectedMemberEmails.all.join(',') : 'empty']);

  // Calculate available slots for selected date with proper per-member availability checking
  useEffect(() => {
    if (!selectedDate || Object.keys(monthlyBusySchedule).length === 0 || !schedulingSettings) {
      setAvailableSlots([]);
      return;
    }

    const calculateAvailableSlots = () => {
      const duration = appState.duration || 60;
      const slots: TimeSlot[] = [];
      
      console.log('=== CORRECTED SLOT GENERATION ===');
      console.log('Selected date:', selectedDate);
      console.log('Selected timezone:', appState.timezone);
      console.log('Required members:', selectedMemberEmails.required);
      console.log('Optional member emails:', selectedMembers.optional.map(m => m.email));
      console.log('Member busy schedules:', monthlyBusySchedule);
      console.log('Business hours:', businessHours);
      
      // Get working hours for the selected date
      const workingHours = getWorkingHoursForDate(selectedDate);
      console.log('Working hours for selected date:', workingHours);
      
      if (!workingHours.start || !workingHours.end) {
        console.log('Selected date is not a working day');
        setAvailableSlots([]);
        return;
      }
      
      // Parse working hours
      const [startHour, startMinute] = workingHours.start.split(':').map(Number);
      const [endHour, endMinute] = workingHours.end.split(':').map(Number);
      
      // Define working hours using business hours configuration
      const userTimezone = appState.timezone || businessHours?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Create working hours for the selected date in the user's timezone
      const workingStart = new Date(selectedDate);
      workingStart.setHours(startHour, startMinute, 0, 0);
      
      const workingEnd = new Date(selectedDate);
      workingEnd.setHours(endHour, endMinute, 0, 0);
      
      // Apply scheduling window constraints
      const now = new Date();
      const minDateTime = new Date(now.getTime() + schedulingSettings.min_notice_hours * 60 * 60 * 1000);
      
      // Adjust start time if it's today and we need to respect minimum notice
      let effectiveStart = new Date(workingStart);
      if (selectedDate.toDateString() === now.toDateString() && effectiveStart < minDateTime) {
        effectiveStart = new Date(minDateTime);
      }
      
      console.log('Working hours start (', userTimezone, '):', workingStart.toLocaleString('en-US', { timeZone: userTimezone }));
      console.log('Working hours end (', userTimezone, '):', workingEnd.toLocaleString('en-US', { timeZone: userTimezone }));
      console.log('Effective start after min notice (', userTimezone, '):', effectiveStart.toLocaleString('en-US', { timeZone: userTimezone }));
      
      // Generate time slots
      let currentTime = new Date(effectiveStart);
      
      while (currentTime < workingEnd) {
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);
        
        console.log('\n--- Checking slot:', 
          currentTime.toLocaleString('en-US', { timeZone: userTimezone }), 
          'to', 
          slotEnd.toLocaleString('en-US', { timeZone: userTimezone }),
          '(', userTimezone, ')'
        );
        
        // Check availability for each required member individually
        const requiredMembersAvailable: string[] = [];
        let allRequiredAvailable = true;
        
        for (const email of selectedMemberEmails.required) {
          const memberBusySlots = monthlyBusySchedule[email] || [];
          
          const hasConflict = memberBusySlots.some(busySlot => {
            const busyStart = new Date(busySlot.start);
            const busyEnd = new Date(busySlot.end);
            const overlaps = currentTime < busyEnd && slotEnd > busyStart;
            
            if (overlaps) {
              console.log(`  ❌ Required member ${email} has conflict: ${busySlot.start} to ${busySlot.end}`);
            }
            
            return overlaps;
          });
          
          if (!hasConflict) {
            requiredMembersAvailable.push(email);
            console.log(`  ✅ Required member ${email} is available`);
          } else {
            allRequiredAvailable = false;
            console.log(`  ❌ Required member ${email} is NOT available`);
          }
        }
        
        // Only create slot if ALL required members are available
        if (allRequiredAvailable && slotEnd <= workingEnd) {
          // Check optional members availability
          const optionalMembersAvailable: string[] = [];
          
          for (const member of selectedMembers.optional) {
            const memberBusySlots = monthlyBusySchedule[member.email] || [];
            
            const hasConflict = memberBusySlots.some(busySlot => {
              const busyStart = new Date(busySlot.start);
              const busyEnd = new Date(busySlot.end);
              const overlaps = currentTime < busyEnd && slotEnd > busyStart;
              
              if (overlaps) {
                console.log(`  ❌ Optional member ${member.email} has conflict: ${busySlot.start} to ${busySlot.end}`);
              }
              
              return overlaps;
            });
            
            if (!hasConflict) {
              optionalMembersAvailable.push(member.email);
              console.log(`  ✅ Optional member ${member.email} is available`);
            } else {
              console.log(`  ❌ Optional member ${member.email} is NOT available`);
            }
          }
          
          // Create attendee info for display
          const attendees = [
            ...selectedMembers.required.map(member => ({
              name: member.name,
              email: member.email,
              type: 'required' as const,
              available: requiredMembersAvailable.includes(member.email)
            })),
            ...selectedMembers.optional.map(member => ({
              name: member.name,
              email: member.email,
              type: 'optional' as const,
              available: optionalMembersAvailable.includes(member.email)
            }))
          ];
          
          slots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString(),
            attendees
          });
          
          console.log(`  ✅ SLOT CREATED with ${requiredMembersAvailable.length}/${selectedMemberEmails.required.length} required and ${optionalMembersAvailable.length}/${selectedMembers.optional.length} optional available`);
        } else {
          console.log(`  ❌ SLOT REJECTED - Required members availability: ${requiredMembersAvailable.length}/${selectedMemberEmails.required.length}`);
        }
        
        // Move to next slot
        currentTime = new Date(currentTime.getTime() + duration * 60000);
      }
      
      console.log('\n=== FINAL RESULT ===');
      console.log('Generated', slots.length, 'available slots');
      setAvailableSlots(slots);
    };

    calculateAvailableSlots();
  }, [selectedDate, monthlyBusySchedule, appState.duration, appState.timezone, selectedMemberEmails.required, selectedMembers.required, selectedMembers.optional, schedulingSettings]);

  const availableDateSet = useMemo(() => {
    if (selectedMemberEmails.required.length === 0 || !businessHours || !schedulingSettings) return new Set<string>();

    const availableDates = new Set<string>();
    const duration = appState.duration || 60;
    const now = new Date();

    // Calculate min and max allowed dates based on scheduling settings
    const minDateTime = new Date(now.getTime() + schedulingSettings.min_notice_hours * 60 * 60 * 1000);
    const maxDateTime = new Date(now.getTime() + schedulingSettings.max_advance_days * 24 * 60 * 60 * 1000);

    calendarDays.forEach(date => {
      // Check scheduling window restrictions
      if (date < minDateTime || date > maxDateTime) {
        return; // Skip dates outside scheduling window
      }

      // Check if this is a working day based on business hours
      if (!isWorkingDay(date)) {
        return; // Skip non-working days
      }

      const workingHours = getWorkingHoursForDate(date);
      if (!workingHours.start || !workingHours.end) {
        return; // Skip if no working hours defined
      }

      const [startHour, startMinute] = workingHours.start.split(':').map(Number);
      const [endHour, endMinute] = workingHours.end.split(':').map(Number);

      const dateStart = new Date(date);
      dateStart.setHours(startHour, startMinute, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(endHour, endMinute, 0, 0);

      // For today, ensure the time slots are after the minimum notice period
      if (date.toDateString() === now.toDateString()) {
        if (dateStart < minDateTime) {
          dateStart.setTime(minDateTime.getTime());
        }
      }

      const slotInterval = duration;

      for (let time = new Date(dateStart); time < dateEnd; time = new Date(time.getTime() + slotInterval * 60000)) {
        const slotEnd = new Date(time.getTime() + duration * 60000);
        
        // Additional check for minimum notice on the same day
        if (time < minDateTime) {
          continue;
        }
        
        // Check if ALL required members are available for this slot
        let allRequiredAvailable = true;
        
        for (const email of selectedMemberEmails.required) {
          const memberBusySlots = monthlyBusySchedule[email] || [];
          const hasConflict = memberBusySlots.some(busySlot => {
            const busyStart = new Date(busySlot.start);
            const busyEnd = new Date(busySlot.end);
            return time < busyEnd && slotEnd > busyStart;
          });
          
          if (hasConflict) {
            allRequiredAvailable = false;
            break;
          }
        }
        
        if (allRequiredAvailable && slotEnd <= dateEnd) {
          availableDates.add(format(date, 'yyyy-MM-dd'));
          break; 
        }
      }
    });
    return availableDates;
  }, [monthlyBusySchedule, calendarDays, appState.duration, appState.timezone, selectedMemberEmails.required, businessHours, isWorkingDay, getWorkingHoursForDate, schedulingSettings]);

  const isDateAvailable = (date: Date) => {
    return availableDateSet.has(format(date, 'yyyy-MM-dd'));
  };

  const handleDateSelect = (date: Date) => {
    console.log('Date selected:', date);
    setSelectedDate(date);
    // CRITICAL FIX: Store date as simple YYYY-MM-DD string to avoid timezone shifts
    const dateString = format(date, 'yyyy-MM-dd');
    console.log('Storing date as string:', dateString);
    onStateChange({ selectedDate: dateString });
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    console.log('Time slot selected:', slot);
    console.log('Selected date object:', selectedDate);
    
    // CRITICAL FIX: Store the complete datetime properly
    const selectedDateTime = new Date(slot.start);
    const userTimezone = appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    console.log('Selected datetime (UTC):', selectedDateTime.toISOString());
    console.log('Selected datetime (user TZ):', selectedDateTime.toLocaleString("en-US", {timeZone: userTimezone}));
    
    onStateChange({ 
      selectedTime: slot.start, // This is already in ISO format from the slot
      selectedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(direction === 'next' ? 
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) : 
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const isDateSelected = (date: Date) => {
    return selectedDate && isSameDay(date, selectedDate);
  };

  const isTimeSelected = (slot: TimeSlot) => {
    return appState.selectedTime === slot.start;
  };

  const formatTimeSlot = (time: Date) => {
    // Format time in the selected timezone
    const userTimezone = appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    if (appState.timeFormat === '24h') {
      return time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false,
        timeZone: userTimezone 
      });
    }
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true,
      timeZone: userTimezone 
    });
  };

  // Check if we have any team members with calendar access
  const hasConnectedMembers = connectedMembers.length > 0;
  const hasSelectedConnectedMembers = selectedMembers.required.length > 0;

  if (!hasConnectedMembers) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-e3-white/40 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-e3-white mb-2">No Calendar Connections</h3>
          <p className="text-e3-white/60 mb-4">
            Team members need to have Google Calendar connected to show availability.
          </p>
          <p className="text-e3-white/60 text-sm">
            Go to Team Configuration to connect member calendars.
          </p>
        </div>
      </div>
    );
  }

  if (!hasSelectedConnectedMembers) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-e3-white/40 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-e3-white mb-2">No Connected Members Selected</h3>
          <p className="text-e3-white/60 mb-4">
            Please select team members who have Google Calendar connected.
          </p>
          <p className="text-e3-white/60 text-sm">
            Connected members: {connectedMembers.map(m => m.name).join(', ')}
          </p>
          <p className="text-e3-white/60 text-sm mt-2">
            <span className="text-e3-emerald">Required:</span> {selectedMembers.required.map(m => m.name).join(', ')} | 
            <span className="text-e3-azure ml-2">Optional:</span> {selectedMembers.optional.map(m => m.name).join(', ')}
          </p>
        </div>
      </div>
    );
  }

  return (
    // BALANCED LAYOUT UPDATE:
    // 1. h-full and flex-col to manage vertical space
    <div className="flex flex-col h-full gap-4">
      
      {/* Header section with compacted spacing */}
      <div className="flex-none space-y-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-e3-azure" />
          <div>
            <h2 className="text-xl font-bold text-e3-white">Select Date & Time</h2>
            <p className="text-e3-white/60 text-sm">Choose when you'd like to schedule the meeting</p>
          </div>
        </div>

        {/* Team Members Section */}
        {(selectedMembers.required.length > 0 || selectedMembers.optional.length > 0) && (
          <div className="bg-e3-space-blue/30 rounded-lg p-3 border border-e3-azure/20">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-e3-azure" />
              <span className="text-xs font-medium text-e3-azure">Checking availability for:</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedMembers.required.length > 0 && (
                <div>
                  <div className="text-[10px] text-emerald-400 font-medium mb-1">Required Members</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.required.map((member, index) => {
                      const colors = [
                        'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                        'bg-green-500/20 text-green-400 border-green-500/40',
                        'bg-teal-500/20 text-teal-400 border-teal-500/40',
                        'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                      ];
                      return (
                        <div key={member?.id} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[index % colors.length]}`}>
                          {member?.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {selectedMembers.optional.length > 0 && (
                <div>
                  <div className="text-[10px] text-blue-400 font-medium mb-1">Optional Members</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.optional.map((member, index) => {
                      const colors = [
                        'bg-blue-500/20 text-blue-400 border-blue-500/40',
                        'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
                        'bg-purple-500/20 text-purple-400 border-purple-500/40',
                        'bg-pink-500/20 text-pink-400 border-pink-500/40'
                      ];
                      return (
                        <div key={member?.id} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[index % colors.length]}`}>
                          {member?.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Main Content Area - Forces equal height columns */}
      <div className="flex-grow min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          
          {/* Calendar Column */}
          <div className="bg-e3-space-blue/50 rounded-lg p-4 border border-e3-white/10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 flex-none">
              <h3 className="font-semibold text-e3-white">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-1.5 hover:bg-e3-white/10 rounded-lg transition"
                >
                  <ChevronLeft className="w-4 h-4 text-e3-white" />
                </button>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-1.5 hover:bg-e3-white/10 rounded-lg transition"
                >
                  <ChevronRight className="w-4 h-4 text-e3-white" />
                </button>
              </div>
            </div>

            {loading && (
              <div className="text-center py-2">
                <div className="w-5 h-5 border-2 border-e3-azure/30 border-t-e3-azure rounded-full animate-spin mx-auto mb-1" />
                <p className="text-e3-white/60 text-xs">Loading availability...</p>
              </div>
            )}

            <div className="grid grid-cols-7 gap-1 flex-grow content-start">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-e3-white/60 py-2">
                  {day}
                </div>
              ))}
              
              {calendarDays.map((date, index) => {
                const isToday = isSameDay(date, new Date());
                const isSelected = isDateSelected(date);
                const isPast = date < new Date() && !isToday;
                const hasAvailability = isDateAvailable(date);
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                
                return (
                  <button
                    key={index}
                    onClick={() => !isPast && isCurrentMonth && handleDateSelect(date)}
                    disabled={isPast || !isCurrentMonth || (!hasAvailability && !loading)}
                    className={`
                      aspect-square p-1 rounded-lg text-xs font-medium transition relative flex items-center justify-center
                      ${!isCurrentMonth 
                        ? 'text-e3-white/20 cursor-not-allowed'
                        : isSelected 
                          ? 'bg-e3-emerald text-e3-space-blue font-bold shadow-lg' 
                          : isToday
                            ? 'bg-e3-emerald/20 text-e3-emerald hover:bg-e3-emerald/30'
                            : isPast
                              ? 'text-e3-white/30 cursor-not-allowed'
                              : hasAvailability
                                ? 'text-e3-white hover:bg-e3-white/10 ring-1 ring-e3-emerald/50 bg-e3-white/5'
                                : 'text-e3-white/50 cursor-not-allowed'
                      }
                    `}
                  >
                    {format(date, 'd')}
                    {hasAvailability && !isSelected && isCurrentMonth && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-e3-emerald rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots Column */}
          <div className="bg-e3-space-blue/50 rounded-lg p-4 border border-e3-white/10 flex flex-col h-full">
            {/* Duration & Format - Fixed header */}
            <div className="flex flex-col gap-3 mb-4 flex-none border-b border-e3-white/5 pb-3">
              <div className="flex items-center justify-between">
                 <h3 className="text-e3-white font-semibold text-sm">Duration</h3>
                 {/* Time Format Toggle */}
                 <div className="flex items-center gap-1 bg-e3-space-blue border border-e3-white/10 rounded-md p-0.5">
                   <button
                     onClick={() => onStateChange({ timeFormat: '12h' })}
                     className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                       appState.timeFormat === '12h'
                         ? 'bg-e3-azure text-e3-white'
                         : 'text-e3-white/50 hover:text-e3-white'
                     }`}
                   >
                     12h
                   </button>
                   <button
                     onClick={() => onStateChange({ timeFormat: '24h' })}
                     className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                       appState.timeFormat === '24h'
                         ? 'bg-e3-azure text-e3-white'
                         : 'text-e3-white/50 hover:text-e3-white'
                     }`}
                   >
                     24h
                   </button>
                 </div>
              </div>

              <div className="flex gap-2">
                {[15, 30, 45, 60, 90].map((duration) => (
                  <button
                    key={duration}
                    onClick={() => onStateChange({ duration })}
                    className={`flex-1 py-1.5 text-xs rounded-md transition-colors border ${
                      appState.duration === duration
                        ? 'bg-e3-emerald text-e3-space-blue border-e3-emerald font-medium'
                        : 'border-e3-white/10 text-e3-white/70 hover:border-e3-white/30'
                    }`}
                  >
                    {`${duration}m`}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Available Times List - Scrollable */}
            <div className="flex-grow relative overflow-hidden min-h-[200px]">
               {!selectedDate ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-e3-white/30 text-sm">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p>Select a date to see times</p>
                    </div>
                  </div>
               ) : loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-6 h-6 border-2 border-e3-azure/30 border-t-e3-azure rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-e3-white/60 text-xs">Loading availability...</p>
                    </div>
                  </div>
               ) : availableSlots.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-e3-white/40 text-xs px-4">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="mb-2">No available times</p>
                      <div className="bg-e3-flame/10 border border-e3-flame/20 rounded-lg p-2 mb-2 inline-block text-left">
                        <p className="text-e3-flame text-[10px] mb-1 font-bold">Try adjusting:</p>
                        <ul className="text-[10px] text-e3-white/70 space-y-0.5 list-disc pl-3">
                          <li>Fewer required members</li>
                          <li>Different duration</li>
                          <li>Another date</li>
                        </ul>
                      </div>
                    </div>
                  </div>
               ) : (
                  <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-2">
                    <div className="grid grid-cols-2 gap-2 pb-2">
                      {availableSlots.map((slot, index) => {
                        const startTime = new Date(slot.start);
                        const isSelected = isTimeSelected(slot);
                        
                         return (
                           <button
                             key={index}
                             onClick={() => handleTimeSelect(slot)}
                             className={`
                               relative p-2 rounded-md text-xs font-medium transition-all duration-200 flex items-center justify-between border
                               ${isSelected 
                                 ? 'bg-e3-emerald text-e3-space-blue shadow-md border-e3-emerald' 
                                 : 'bg-e3-space-blue/40 border-e3-white/10 text-e3-white hover:bg-e3-white/5 hover:border-e3-emerald/50'
                               }
                             `}
                           >
                             <span>{formatTimeSlot(startTime)}</span>
                             <div className="flex items-center gap-0.5">
                               {/* Show dots based on actual availability */}
                               {slot.attendees?.some(a => a.type === 'required' && a.available) && (
                                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-sm" title="Required members available" />
                               )}
                               {slot.attendees?.some(a => a.type === 'optional' && a.available) && (
                                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" title="Optional members available" />
                               )}
                             </div>
                           </button>
                         );
                      })}
                    </div>
                  </div>
               )}
            </div>
             
             {/* Timezone Selector - Fixed footer */}
             <div className="pt-3 border-t border-e3-white/5 mt-auto flex-none">
               <TimezoneSelector
                 value={appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                 onChange={(timezone) => onStateChange({ timezone })}
               />
             </div>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2 mt-auto border-t border-e3-white/5">
        <button
          onClick={onBack}
          className="order-2 sm:order-1 py-2.5 px-6 text-sm text-e3-white/80 hover:text-e3-white transition rounded-lg border border-e3-white/20 hover:border-e3-white/40"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!appState.selectedDate || !appState.selectedTime}
          className="order-1 sm:order-2 cta py-2.5 px-8 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-e3-emerald/20"
        >
          Continue
        </button>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-sm border-t border-e3-white/10 sm:hidden z-50">
        <button
          onClick={onNext}
          disabled={!appState.selectedDate || !appState.selectedTime}
          className="w-full cta py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default AvailabilityStep;