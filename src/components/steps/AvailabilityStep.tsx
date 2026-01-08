import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Calendar, Clock, Users, ChevronLeft, ChevronRight, Info, X, Trash2, GripHorizontal } from 'lucide-react';
import { format, startOfWeek, startOfMonth, endOfMonth, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { useTeamData } from '../../hooks/useTeamData';
import { supabase } from '../../integrations/supabase/client';
import { StepProps, TimeSlot } from '../../types/scheduling';
import { TimezoneSelector } from '../TimezoneSelector';
import { useBusinessHours } from '../../hooks/useBusinessHours';

// --- TYPES ---
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

interface MemberColor {
  border: string;
  bg: string;
  text: string;
  hex: string;
}

// HIGH CONTRAST PALETTE
const MEMBER_COLORS: MemberColor[] = [
  { border: 'border-blue-500/40', bg: 'bg-blue-500/20', text: 'text-blue-400', hex: '#60a5fa' },
  { border: 'border-orange-500/40', bg: 'bg-orange-500/20', text: 'text-orange-400', hex: '#fb923c' },
  { border: 'border-emerald-500/40', bg: 'bg-emerald-500/20', text: 'text-emerald-400', hex: '#34d399' },
  { border: 'border-purple-500/40', bg: 'bg-purple-500/20', text: 'text-purple-400', hex: '#c084fc' },
  { border: 'border-yellow-500/40', bg: 'bg-yellow-500/20', text: 'text-yellow-400', hex: '#facc15' },
  { border: 'border-pink-500/40', bg: 'bg-pink-500/20', text: 'text-pink-400', hex: '#f472b6' },
  { border: 'border-cyan-500/40', bg: 'bg-cyan-500/20', text: 'text-cyan-400', hex: '#22d3ee' },
  { border: 'border-rose-500/40', bg: 'bg-rose-500/20', text: 'text-rose-400', hex: '#fb7185' },
  { border: 'border-lime-500/40', bg: 'bg-lime-500/20', text: 'text-lime-400', hex: '#a3e635' },
  { border: 'border-indigo-500/40', bg: 'bg-indigo-500/20', text: 'text-indigo-400', hex: '#818cf8' },
  { border: 'border-teal-500/40', bg: 'bg-teal-500/20', text: 'text-teal-400', hex: '#2dd4bf' },
  { border: 'border-fuchsia-500/40', bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', hex: '#e879f9' },
];

const AvailabilityStep: React.FC<AvailabilityStepProps> = ({ appState, onNext, onBack, onStateChange, clientTeamFilter }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyBusySchedule, setMonthlyBusySchedule] = useState<Record<string, BusySlot[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedulingSettings, setSchedulingSettings] = useState<SchedulingWindowSettings | null>(null);
  const [draggedMember, setDraggedMember] = useState<{ id: string, from: 'required' | 'optional' | 'pool' } | null>(null);
  
  const hasInitialized = useRef(false);

  const { teamMembers, loading: membersLoading } = useTeamData();
  const { businessHours, getWorkingHoursForDate, isWorkingDay } = useBusinessHours(clientTeamFilter);

  // 1. ROBUST MEMBER FILTERING
  const connectedMembers = useMemo(() => {
    let activeFilter = clientTeamFilter;
    
    if (!activeFilter) {
        // Fallback: Parse URL manually
        const pathParts = window.location.pathname.split('/');
        const bookIndex = pathParts.indexOf('book');
        if (bookIndex !== -1 && pathParts[bookIndex + 1]) {
            activeFilter = pathParts[bookIndex + 1];
        }
    }

    return teamMembers.filter(member => {
      const hasCalendar = member.googleCalendarConnected || member.email;
      let matchesClient = true;
      if (activeFilter) {
          matchesClient = member.clientTeams.some(team => {
              const normalizedName = team.name.toLowerCase().replace(/ /g, '-');
              const bookingSlug = (team as any).booking_slug?.toLowerCase();
              const oldSlug = (team as any).slug?.toLowerCase(); // Keep as fallback if needed

              return team.id === activeFilter || 
                     bookingSlug === activeFilter || 
                     oldSlug === activeFilter ||
                     normalizedName === activeFilter;
          });
      }
      return hasCalendar && matchesClient;
    });
  }, [teamMembers, clientTeamFilter]);

  // 2. INITIALIZATION
  useEffect(() => {
    if (membersLoading || connectedMembers.length === 0) return;
    if (hasInitialized.current) return;

    const params = new URLSearchParams(window.location.search);
    const requiredParam = params.get('required');
    const optionalParam = params.get('optional');

    const newRequired = new Set<string>();
    const newOptional = new Set<string>();

    const findMember = (identifier: string) => 
      connectedMembers.find(m => m.email === identifier || m.id === identifier);

    if (requiredParam || optionalParam) {
      if (requiredParam) {
        requiredParam.split(',').forEach(email => {
          const member = findMember(email.trim());
          if (member) newRequired.add(member.id);
        });
      }
      if (optionalParam) {
        optionalParam.split(',').forEach(email => {
          const member = findMember(email.trim());
          if (member && !newRequired.has(member.id)) newOptional.add(member.id);
        });
      }
    } else if (appState.requiredMembers.size === 0 && appState.optionalMembers.size === 0) {
      connectedMembers.forEach(m => newRequired.add(m.id));
    } else {
      hasInitialized.current = true;
      return;
    }

    if (newRequired.size > 0 || newOptional.size > 0) {
      onStateChange({ requiredMembers: newRequired, optionalMembers: newOptional });
    }
    hasInitialized.current = true;
  }, [connectedMembers, membersLoading, appState.requiredMembers, appState.optionalMembers, onStateChange]);

  // 3. URL SYNC
  useEffect(() => {
    if (!hasInitialized.current) return;

    const params = new URLSearchParams(window.location.search);
    const reqEmails = Array.from(appState.requiredMembers)
      .map(id => connectedMembers.find(m => m.id === id)?.email)
      .filter(Boolean)
      .join(',');
      
    const optEmails = Array.from(appState.optionalMembers)
      .map(id => connectedMembers.find(m => m.id === id)?.email)
      .filter(Boolean)
      .join(',');

    if (reqEmails) params.set('required', reqEmails);
    else params.delete('required');

    if (optEmails) params.set('optional', optEmails);
    else params.delete('optional');

    params.set('step', 'availability');

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);

  }, [appState.requiredMembers, appState.optionalMembers, connectedMembers]);

  // 4. SELECTED MEMBERS
  const selectedMembers = useMemo(() => {
    const requiredMembers = Array.from(appState.requiredMembers)
      .map(memberId => connectedMembers.find(m => m.id === memberId))
      .filter(Boolean);
    
    const optionalMembers = Array.from(appState.optionalMembers)
      .map(memberId => connectedMembers.find(m => m.id === memberId))
      .filter(Boolean);
    
    const allSelectedIds = new Set([...appState.requiredMembers, ...appState.optionalMembers]);
    const poolMembers = connectedMembers.filter(m => !allSelectedIds.has(m.id));

    // Sort to ensure consistent colors
    const sortedAllMembers = [...connectedMembers].sort((a, b) => a.name.localeCompare(b.name));
    
    const assignColor = (memberId: string): MemberColor => {
       const index = sortedAllMembers.findIndex(m => m.id === memberId);
       return MEMBER_COLORS[Math.max(0, index) % MEMBER_COLORS.length];
    };

    const enhanceMember = (m: any) => ({ ...m, color: assignColor(m.id) });

    return { 
      required: requiredMembers.map(enhanceMember), 
      optional: optionalMembers.map(enhanceMember),
      pool: poolMembers.map(enhanceMember),
      all: [...requiredMembers, ...optionalMembers].map(enhanceMember) 
    };
  }, [appState.requiredMembers, appState.optionalMembers, connectedMembers]);

  const selectedMemberEmails = useMemo(() => {
    return {
      required: selectedMembers.required.map(member => member?.email).filter(Boolean) as string[],
      all: selectedMembers.all.map(member => member?.email).filter(Boolean) as string[]
    };
  }, [selectedMembers]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // --- DATA LOADING ---
  useEffect(() => {
    const loadSchedulingSettings = async () => {
      try {
        const { data } = await supabase
          .from('scheduling_window_settings')
          .select('min_notice_hours, max_advance_days, availability_type')
          .eq('is_active', true)
          .maybeSingle();
        
        if (data) {
          setSchedulingSettings({
            min_notice_hours: data.min_notice_hours || 4,
            max_advance_days: data.max_advance_days || 60,
            availability_type: data.availability_type || 'available_now'
          });
        } else {
          setSchedulingSettings({ min_notice_hours: 4, max_advance_days: 60, availability_type: 'available_now' });
        }
      } catch {
        setSchedulingSettings({ min_notice_hours: 4, max_advance_days: 60, availability_type: 'available_now' });
      }
    };
    loadSchedulingSettings();
  }, []);

  useEffect(() => {
    const loadMonthlyAvailability = async () => {
      if (selectedMemberEmails.all.length === 0) {
        setMonthlyBusySchedule({});
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        
        const { data, error } = await supabase.functions.invoke('google-auth', {
          body: {
            action: 'check_availability',
            userEmails: selectedMemberEmails.all,
            eventData: { timeMin: start.toISOString(), timeMax: end.toISOString() }
          }
        });

        if (error) throw error;

        const memberBusySchedules: Record<string, BusySlot[]> = {};
        if (data?.availability?.calendars) {
          Object.entries(data.availability.calendars).forEach(([email, calendar]: [string, any]) => {
            memberBusySchedules[email] = Array.isArray(calendar.busy) ? calendar.busy : [];
          });
        }
        setMonthlyBusySchedule(memberBusySchedules);
      } catch {
        setMonthlyBusySchedule({});
      } finally {
        setLoading(false);
      }
    };
    loadMonthlyAvailability();
  }, [currentMonth, selectedMemberEmails.all.length > 0 ? selectedMemberEmails.all.join(',') : 'empty']);

  // --- STRICT SLOT GENERATOR ---
  const generateSlotsForDate = useCallback((date: Date): TimeSlot[] => {
    if (!schedulingSettings) return [];

    const duration = appState.duration || 60;
    const slots: TimeSlot[] = [];
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const workingHours = getWorkingHoursForDate(startOfDay);
    
    if (!workingHours.start || !workingHours.end) return [];
    
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = workingHours.end.split(':').map(Number);
    
    const now = new Date();
    const minDateTime = new Date(now.getTime() + schedulingSettings.min_notice_hours * 60 * 60 * 1000);
    
    const workingStart = new Date(startOfDay);
    workingStart.setHours(startHour, startMinute, 0, 0);
    
    const workingEnd = new Date(startOfDay);
    workingEnd.setHours(endHour, endMinute, 0, 0);
    
    let effectiveStart = new Date(workingStart);
    if (startOfDay.toDateString() === now.toDateString() && effectiveStart < minDateTime) {
      effectiveStart = new Date(minDateTime);
    }
    
    let currentTime = new Date(effectiveStart);
    
    while (currentTime < workingEnd) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60000);
      if (slotEnd > workingEnd) break;

      const requiredMembersAvailable: string[] = [];
      let allRequiredAvailable = true;
      
      // Check Required
      for (const email of selectedMemberEmails.required) {
        const memberBusySlots = monthlyBusySchedule[email] || [];
        const hasConflict = memberBusySlots.some(busySlot => {
          const busyStart = new Date(busySlot.start);
          const busyEnd = new Date(busySlot.end);
          return currentTime < busyEnd && slotEnd > busyStart;
        });
        
        if (!hasConflict) {
          requiredMembersAvailable.push(email);
        } else {
          allRequiredAvailable = false;
        }
      }
      
      if (allRequiredAvailable) {
        // Check Optional
        const optionalMembersAvailable: string[] = [];
        for (const member of selectedMembers.optional) {
          const memberBusySlots = monthlyBusySchedule[member.email] || [];
          const hasConflict = memberBusySlots.some(busySlot => {
            const busyStart = new Date(busySlot.start);
            const busyEnd = new Date(busySlot.end);
            return currentTime < busyEnd && slotEnd > busyStart;
          });
          if (!hasConflict) optionalMembersAvailable.push(member.email);
        }
        
        slots.push({
          start: currentTime.toISOString(),
          end: slotEnd.toISOString(),
          attendees: [
            ...selectedMembers.required.map(m => ({ 
              name: m.name, email: m.email, type: 'required' as const, available: true, color: m.color 
            })),
            ...selectedMembers.optional.map(m => ({ 
              name: m.name, email: m.email, type: 'optional' as const, available: optionalMembersAvailable.includes(m.email), color: m.color 
            }))
          ]
        });
      }
      currentTime = new Date(currentTime.getTime() + duration * 60000);
    }
    return slots;
  }, [schedulingSettings, appState.duration, selectedMemberEmails.required, monthlyBusySchedule, getWorkingHoursForDate, selectedMembers]);

  // --- CALENDAR DOTS ---
  const dailyAvailabilityMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (selectedMemberEmails.required.length === 0 || !schedulingSettings) return map;

    calendarDays.forEach(date => {
        if (isSameDay(date, new Date()) || date > new Date()) {
            const slots = generateSlotsForDate(date);
            const availableSet = new Set<string>();
            
            slots.forEach(slot => {
                slot.attendees?.forEach(att => {
                    if (att.available) availableSet.add(att.email);
                });
            });
            
            if (availableSet.size > 0) {
                map.set(format(date, 'yyyy-MM-dd'), availableSet);
            }
        }
    });
    return map;
  }, [calendarDays, generateSlotsForDate, selectedMemberEmails.required, schedulingSettings]);

  // --- SLOTS FOR SELECTED DATE ---
  useEffect(() => {
    if (!selectedDate || Object.keys(monthlyBusySchedule).length === 0) {
      setAvailableSlots([]);
      return;
    }
    const slots = generateSlotsForDate(selectedDate);
    setAvailableSlots(slots);
  }, [selectedDate, generateSlotsForDate]);

  // --- HANDLERS ---

  const handleDragStart = (e: React.DragEvent, memberId: string, from: 'required' | 'optional' | 'pool') => {
    setDraggedMember({ id: memberId, from });
    e.dataTransfer.setData('text/plain', memberId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, to: 'required' | 'optional' | 'pool') => {
    e.preventDefault();
    if (!draggedMember) return;

    if (draggedMember.from !== to) {
        const newRequired = new Set(appState.requiredMembers);
        const newOptional = new Set(appState.optionalMembers);

        if (draggedMember.from === 'required') newRequired.delete(draggedMember.id);
        else if (draggedMember.from === 'optional') newOptional.delete(draggedMember.id);

        if (to === 'required') newRequired.add(draggedMember.id);
        else if (to === 'optional') newOptional.add(draggedMember.id);

        onStateChange({ requiredMembers: newRequired, optionalMembers: newOptional });
    }
    setDraggedMember(null);
  };

  const removeMember = (id: string) => {
    const newRequired = new Set(appState.requiredMembers);
    const newOptional = new Set(appState.optionalMembers);
    newRequired.delete(id);
    newOptional.delete(id);
    onStateChange({ requiredMembers: newRequired, optionalMembers: newOptional });
  };

  const clearSection = (section: 'required' | 'optional') => {
    const newRequired = new Set(appState.requiredMembers);
    const newOptional = new Set(appState.optionalMembers);
    if (section === 'required') newRequired.clear();
    if (section === 'optional') newOptional.clear();
    onStateChange({ requiredMembers: newRequired, optionalMembers: newOptional });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    onStateChange({ selectedDate: format(date, 'yyyy-MM-dd') });
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    onStateChange({ 
      selectedTime: slot.start, 
      selectedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
    });
  };

  const formatTimeSlot = (time: Date) => {
    const userTimezone = appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return time.toLocaleTimeString('en-US', { 
      hour: appState.timeFormat === '24h' ? '2-digit' : 'numeric', 
      minute: '2-digit', 
      hour12: appState.timeFormat !== '24h', 
      timeZone: userTimezone 
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(direction === 'next' ? 
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) : 
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const handleBack = () => {
    // Clean the URL to prevent infinite loop when landing on Team Step
    const params = new URLSearchParams(window.location.search);
    params.delete('step'); 
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
    
    // Navigate back
    onBack();
  };

  if (membersLoading) return <div className="text-center py-12 text-e3-white/60">Loading team...</div>;
  if (connectedMembers.length === 0) return <div className="text-center py-12 text-e3-white/60">No connected team members found.</div>;

  // DYNAMIC GRID LAYOUT
  const gridCols = (appState.duration || 60) <= 30 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="flex flex-col h-full gap-4">
      {/* 1. FLEX HEADER - Widened Pool */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-2 flex-none">
        
        {/* Left: Title */}
        <div className="flex-none flex items-center gap-3 pt-1 min-w-[200px]">
          <Calendar className="w-6 h-6 text-e3-azure" />
          <div>
            <h2 className="text-xl font-bold text-e3-white">Select Date & Time</h2>
            <p className="text-e3-white/60 text-sm">Drag members to change status</p>
          </div>
        </div>

        {/* Right: Pool Zone (Fills remaining space) */}
        <div className="flex-grow min-w-0 w-full md:w-auto">
            {selectedMembers.pool.length > 0 && (
                <div 
                    className="w-full bg-e3-space-blue/30 rounded-lg p-2.5 border border-e3-white/10 flex flex-col"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'pool')}
                >
                    <div className="text-[10px] font-bold text-e3-white/40 mb-1.5 uppercase tracking-wider flex items-center">
                        <GripHorizontal className="w-3 h-3 mr-1" /> Available Team Members
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedMembers.pool.map(m => (
                            <div 
                                key={m.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, m.id, 'pool')}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border border-dashed border-e3-white/30 cursor-grab active:cursor-grabbing hover:bg-e3-white/10 transition-all ${m.color.text}`}
                            >
                                {m.google_photo_url ? (
                                  <img 
                                    src={m.google_photo_url} 
                                    alt={m.name} 
                                    className="w-4 h-4 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const next = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (next) next.style.display = 'flex';
                                    }}
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">
                                    {m.name.charAt(0)}
                                  </div>
                                )}
                                {m.google_photo_url && (
                                  <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] hidden">
                                    {m.name.charAt(0)}
                                  </div>
                                )}
                                {m.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* 2. DRAG ZONES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-none">
            {/* REQUIRED */}
            <div 
                className={`rounded-lg p-3 border border-e3-azure/20 transition-colors min-h-[80px] ${draggedMember ? 'bg-e3-space-blue/40 border-dashed border-e3-emerald/50' : 'bg-e3-space-blue/30'}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'required')}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="text-xs font-bold text-e3-white uppercase tracking-wider">Required</span>
                        <span className="text-[10px] text-e3-white/40">(Must be available)</span>
                    </div>
                    {selectedMembers.required.length > 0 && (
                        <button onClick={() => clearSection('required')} className="text-[10px] text-e3-white/40 hover:text-e3-flame flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {selectedMembers.required.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-e3-white/20 italic py-2">
                            Drop required members here
                        </div>
                    ) : (
                        selectedMembers.required.map(m => (
                            <div 
                                key={m.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, m.id, 'required')}
                                className={`flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-[11px] font-medium border cursor-grab active:cursor-grabbing hover:brightness-110 transition-all ${m.color.bg} ${m.color.text} ${m.color.border}`}
                            >
                                {m.google_photo_url ? (
                                  <img 
                                    src={m.google_photo_url} 
                                    alt={m.name} 
                                    className="w-4 h-4 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const next = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (next) next.style.display = 'flex';
                                    }}
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px]">
                                    {m.name.charAt(0)}
                                  </div>
                                )}
                                {m.google_photo_url && (
                                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] hidden">
                                    {m.name.charAt(0)}
                                  </div>
                                )}
                                {m.name}
                                <button onClick={() => removeMember(m.id)} className="p-0.5 hover:bg-black/10 rounded-full"><X className="w-3 h-3 opacity-70" /></button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* OPTIONAL */}
            <div 
                className={`rounded-lg p-3 border border-e3-azure/20 transition-colors min-h-[80px] ${draggedMember ? 'bg-e3-space-blue/40 border-dashed border-blue-400/50' : 'bg-e3-space-blue/30'}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'optional')}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span className="text-xs font-bold text-e3-white uppercase tracking-wider">Optional</span>
                        <span className="text-[10px] text-e3-white/40">(Invited if free)</span>
                    </div>
                    {selectedMembers.optional.length > 0 && (
                        <button onClick={() => clearSection('optional')} className="text-[10px] text-e3-white/40 hover:text-e3-flame flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {selectedMembers.optional.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-e3-white/20 italic py-2">
                            Drop optional members here
                        </div>
                    ) : (
                        selectedMembers.optional.map(m => (
                            <div 
                                key={m.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, m.id, 'optional')}
                                className={`flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-[11px] font-medium border cursor-grab active:cursor-grabbing hover:brightness-110 transition-all ${m.color.bg} ${m.color.text} ${m.color.border}`}
                            >
                                {m.google_photo_url ? (
                                  <img 
                                    src={m.google_photo_url} 
                                    alt={m.name} 
                                    className="w-4 h-4 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const next = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (next) next.style.display = 'flex';
                                    }}
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px]">
                                    {m.name.charAt(0)}
                                  </div>
                                )}
                                {m.google_photo_url && (
                                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] hidden">
                                    {m.name.charAt(0)}
                                  </div>
                                )}
                                {m.name}
                                <button onClick={() => removeMember(m.id)} className="p-0.5 hover:bg-black/10 rounded-full"><X className="w-3 h-3 opacity-70" /></button>
                            </div>
                        ))
                    )}
                </div>
            </div>
      </div>

      {error && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}

      <div className="flex-grow min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          {/* CALENDAR */}
          <div className="bg-e3-space-blue/50 rounded-lg p-4 border border-e3-white/10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 flex-none">
              <h3 className="font-semibold text-e3-white text-sm">{format(currentMonth, 'MMMM yyyy')}</h3>
              <div className="flex gap-2">
                <button onClick={() => navigateMonth('prev')} className="p-1.5 hover:bg-e3-white/10 rounded-lg transition"><ChevronLeft className="w-4 h-4 text-e3-white" /></button>
                <button onClick={() => navigateMonth('next')} className="p-1.5 hover:bg-e3-white/10 rounded-lg transition"><ChevronRight className="w-4 h-4 text-e3-white" /></button>
              </div>
            </div>

            {loading && (
              <div className="text-center py-2">
                <div className="w-5 h-5 border-2 border-e3-azure/30 border-t-e3-azure rounded-full animate-spin mx-auto mb-1" />
                <p className="text-e3-white/60 text-xs">Checking calendars...</p>
              </div>
            )}

            <div className="grid grid-cols-7 gap-1 flex-grow content-start">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-e3-white/40 py-2">{day}</div>
              ))}
              {calendarDays.map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isWorkDay = isWorkingDay(date);
                const isPast = date < new Date() && !isSameDay(date, new Date());
                
                // Get pre-calculated available members for this day
                const dateStr = format(date, 'yyyy-MM-dd');
                const freeMembersForDay = dailyAvailabilityMap.get(dateStr) || new Set();
                const hasAvailability = freeMembersForDay.size > 0;

                return (
                  <button
                    key={index}
                    onClick={() => !isPast && isWorkDay && handleDateSelect(date)}
                    disabled={isPast || !isWorkDay || !isCurrentMonth}
                    className={`
                      aspect-square rounded-md text-xs font-medium relative flex flex-col items-center justify-center gap-1 transition-all
                      ${!isCurrentMonth ? 'text-e3-white/10' 
                        : isSelected ? 'bg-e3-emerald text-e3-space-blue font-bold shadow-lg' 
                        : isWorkDay && !isPast && hasAvailability ? 'text-e3-white bg-e3-white/5 hover:bg-e3-white/10' 
                        : 'text-e3-white/20 cursor-not-allowed'}
                    `}
                  >
                    <span>{format(date, 'd')}</span>
                    
                    {!loading && isCurrentMonth && isWorkDay && !isPast && hasAvailability && (
                        <div className="flex gap-0.5 justify-center flex-wrap px-1 max-w-full">
                           {selectedMembers.all.map(m => {
                               if (!freeMembersForDay.has(m.email)) return null;
                               return (
                                   <div 
                                     key={m.id} 
                                     style={{ backgroundColor: m.color.hex }}
                                     className="w-1 h-1 rounded-full" 
                                   />
                               )
                           })}
                        </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SLOTS - COMPACT & NO SCROLLBAR */}
          <div className="bg-e3-space-blue/50 rounded-lg p-4 border border-e3-white/10 flex flex-col h-full">
            <div className="flex flex-col gap-3 mb-4 flex-none border-b border-e3-white/5 pb-3">
              <div className="flex items-center justify-between">
                 <h3 className="text-e3-white font-semibold text-sm">Duration</h3>
                 <div className="flex items-center gap-1 bg-e3-space-blue border border-e3-white/10 rounded-md p-0.5">
                   <button onClick={() => onStateChange({ timeFormat: '12h' })} className={`px-2 py-0.5 text-[10px] rounded ${appState.timeFormat === '12h' ? 'bg-e3-azure text-white' : 'text-e3-white/50'}`}>12h</button>
                   <button onClick={() => onStateChange({ timeFormat: '24h' })} className={`px-2 py-0.5 text-[10px] rounded ${appState.timeFormat === '24h' ? 'bg-e3-azure text-white' : 'text-e3-white/50'}`}>24h</button>
                 </div>
              </div>
              <div className="flex gap-2">
                {[15, 30, 45, 60, 90].map(dur => (
                  <button 
                    key={dur} 
                    onClick={() => onStateChange({ duration: dur })}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${appState.duration === dur ? 'bg-e3-emerald text-e3-space-blue border-e3-emerald font-medium' : 'border-e3-white/10 text-e3-white/70 hover:border-e3-white/30'}`}
                  >
                    {dur}m
                  </button>
                ))}
              </div>
            </div>

            <h3 className="text-e3-white font-semibold text-sm mb-2 flex-none">Available Times</h3>

            <div className="flex-grow relative overflow-hidden min-h-[200px]">
               {!selectedDate ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-e3-white/30">
                    <Calendar className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-xs">Select a date on the left</p>
                  </div>
               ) : loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-e3-azure/30 border-t-e3-azure rounded-full animate-spin" />
                  </div>
               ) : availableSlots.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-e3-white/40 px-4 text-center">
                    <Clock className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-xs">No slots available.</p>
                    <p className="text-[10px] opacity-70 mt-1">Try removing required members.</p>
                  </div>
               ) : (
                  <div className="absolute inset-0 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    <div className={`grid ${gridCols} gap-2 pb-2`}>
                      {availableSlots.map((slot, index) => {
                        const isSelected = appState.selectedTime === slot.start;
                         return (
                           <button
                             key={index}
                             onClick={() => handleTimeSelect(slot)}
                             className={`
                               py-2 px-2 rounded-md text-xs font-medium border transition-all flex flex-col items-start gap-1
                               ${isSelected 
                                 ? 'bg-e3-emerald text-e3-space-blue border-e3-emerald shadow-md' 
                                 : 'bg-e3-space-blue/40 border-e3-white/10 text-e3-white hover:border-e3-emerald/50 hover:bg-e3-white/5'}
                             `}
                           >
                             <div className="flex justify-between w-full items-center">
                                <span>{formatTimeSlot(new Date(slot.start))}</span>
                                {isSelected && <div className="w-1 h-1 bg-e3-space-blue rounded-full" />}
                             </div>
                             
                             <div className="flex flex-wrap gap-1">
                                {slot.attendees
                                    .filter(a => a.available)
                                    .map((attendee: any) => (
                                        <div 
                                            key={attendee.email}
                                            style={{ backgroundColor: attendee.color?.hex }}
                                            className="w-1.5 h-1.5 rounded-full"
                                            title={`${attendee.name} is available`}
                                        />
                                    ))
                                }
                             </div>
                           </button>
                         );
                      })}
                    </div>
                  </div>
               )}
            </div>
             
             <div className="pt-3 border-t border-e3-white/5 mt-auto flex-none">
               <TimezoneSelector
                 value={appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                 onChange={(timezone) => onStateChange({ timezone })}
               />
             </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4 mt-2 flex-none pt-4 border-t border-e3-white/10">
        <button onClick={handleBack} className="order-2 sm:order-1 py-2.5 px-6 text-sm text-e3-white/80 hover:text-e3-white transition rounded-lg border border-e3-white/20 hover:border-e3-white/40">
          Back
        </button>
        <button onClick={onNext} disabled={!appState.selectedDate || !appState.selectedTime} className="order-1 sm:order-2 cta py-2.5 px-8 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-e3-emerald/20">
          Continue
        </button>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-sm border-t border-e3-white/10 sm:hidden z-50">
        <button onClick={onNext} disabled={!appState.selectedDate || !appState.selectedTime} className="w-full cta py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          Continue
        </button>
      </div>
    </div>
  );
};

export default AvailabilityStep;