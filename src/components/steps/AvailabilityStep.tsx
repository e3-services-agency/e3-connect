import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X, Trash2, GripHorizontal, Loader, List, LayoutGrid } from 'lucide-react';
import { format, startOfWeek, startOfMonth, endOfMonth, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import luxon3Plugin from '@fullcalendar/luxon3';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DateTime } from 'luxon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamData } from '../../hooks/useTeamData';
import { supabase } from '../../integrations/supabase/client';
import { StepProps, TimeSlot } from '../../types/scheduling';
import type { ClientTeam, TeamMemberConfig } from '../../types/team';
import { TimezoneSelector } from '../TimezoneSelector';
import { useBusinessHours } from '../../hooks/useBusinessHours';
import EmbedHostPanel, { type EmbedHostEntity } from '../embed/EmbedHostPanel';
import enGbLocale from '@fullcalendar/core/locales/en-gb';

interface AvailabilityStepProps extends StepProps {
  clientTeamFilter?: string;
  /** Embedded iframe: split layout + no wizard footer */
  isEmbed?: boolean;
  embedHost?: EmbedHostEntity | null;
}

interface BusySlot {
  start: string;
  end: string;
}

type SlotAttendee = NonNullable<TimeSlot['attendees']>[number] & { color?: { hex?: string } };

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

const monthCalendarSpan = (month: Date) => {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return { start, end };
};

/** Darker edge for busy blocks (Google-style border). */
const darkenBorderHex = (hex: string, factor = 0.62): string => {
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const r = Math.round(parseInt(n.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(n.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(n.slice(4, 6), 16) * factor);
  return `rgb(${r},${g},${b})`;
};

/** Split multi-day / overnight busy into per-day segments, then clip to calendar grid window (matches FullCalendar slotMin/slotMax). */
const splitBusySlotsForCalendar = (
  startIso: string,
  endIso: string,
  zone: string,
  slotMinHour: number,
  slotMaxHour: number
): { start: string; end: string }[] => {
  const start = DateTime.fromISO(startIso).setZone(zone);
  const end = DateTime.fromISO(endIso).setZone(zone);
  if (!start.isValid || !end.isValid || end <= start) return [];

  const out: { start: string; end: string }[] = [];
  let segStart = start;

  while (segStart < end) {
    const nextMidnight = segStart.startOf('day').plus({ days: 1 });
    const segEnd = DateTime.min(end, nextMidnight);
    if (segEnd > segStart) {
      const dayStart = segStart.startOf('day');
      const windowOpen = dayStart.set({ hour: slotMinHour, minute: 0, second: 0, millisecond: 0 });
      const windowClose = dayStart.set({ hour: slotMaxHour, minute: 0, second: 0, millisecond: 0 });
      const clipStart = DateTime.max(segStart, windowOpen);
      const clipEnd = DateTime.min(segEnd, windowClose);
      if (clipEnd > clipStart) {
        out.push({ start: clipStart.toISO()!, end: clipEnd.toISO()! });
      }
    }
    segStart = nextMidnight;
  }

  return out;
};

/** Build background segments for times outside configured business hours (within calendar grid 09–18). */
const buildNonBusinessBackgroundEvents = (
  daysInRange: Date[],
  fcTimezone: string,
  gridStartHour: number,
  gridEndHour: number,
  getWorkingHoursForDate: (d: Date) => { start: string | null; end: string | null }
): EventInput[] => {
  const out: EventInput[] = [];
  daysInRange.forEach(day => {
    const d0 = DateTime.fromJSDate(day).setZone(fcTimezone).startOf('day');
    const gridOpen = d0.set({ hour: gridStartHour, minute: 0, second: 0, millisecond: 0 });
    const gridClose = d0.set({ hour: gridEndHour, minute: 0, second: 0, millisecond: 0 });
    const work = getWorkingHoursForDate(day);

    const pushBg = (start: DateTime, end: DateTime, seg: number) => {
      if (end <= start) return;
      out.push({
        id: `nonbiz-${d0.toISODate()}-${seg}-${start.toMillis()}`,
        display: 'background',
        start: start.toISO()!,
        end: end.toISO()!,
        classNames: ['fc-non-business-bg'],
        groupId: 'nonbiz',
      });
    };

    if (!work.start || !work.end) {
      pushBg(gridOpen, gridClose, 0);
      return;
    }

    const [wsH, wsM] = work.start.split(':').map(Number);
    const [weH, weM] = work.end.split(':').map(Number);
    let wStart = d0.set({ hour: wsH, minute: wsM || 0, second: 0, millisecond: 0 });
    let wEnd = d0.set({ hour: weH, minute: weM || 0, second: 0, millisecond: 0 });
    wStart = DateTime.max(wStart, gridOpen);
    wEnd = DateTime.min(wEnd, gridClose);

    if (wEnd <= wStart) {
      pushBg(gridOpen, gridClose, 0);
      return;
    }
    if (wStart > gridOpen) {
      pushBg(gridOpen, wStart, 1);
    }
    if (wEnd < gridClose) {
      pushBg(wEnd, gridClose, 2);
    }
  });
  return out;
};

const AvailabilityStep: React.FC<AvailabilityStepProps> = ({
  appState,
  onNext,
  onBack,
  onStateChange,
  clientTeamFilter,
  isEmbed,
  embedHost,
}) => {
  
  const activeFilter = useMemo(() => {
    if (clientTeamFilter) return clientTeamFilter;
    const pathParts = window.location.pathname.split('/');
    const bookIndex = pathParts.indexOf('book');
    if (bookIndex !== -1 && pathParts[bookIndex + 1]) {
        return pathParts[bookIndex + 1];
    }
    return undefined;
  }, [clientTeamFilter]);

  const { teamMembers, loading: membersLoading } = useTeamData(activeFilter);

  const resolvedTeamId = useMemo(() => {
    if (appState.isIndividualBooking) return undefined; 
    if (!activeFilter) return undefined;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeFilter);
    if (isUUID) return activeFilter;
    if (teamMembers.length > 0) {
       const team = teamMembers[0].clientTeams?.find((t: ClientTeam) => 
         t.booking_slug === activeFilter || 
         t.name.toLowerCase().replace(/ /g, '-') === activeFilter
       );
       return team?.id || teamMembers[0].clientTeams?.[0]?.id;
    }
    return undefined;
  }, [activeFilter, teamMembers, appState.isIndividualBooking]);

  const { getWorkingHoursForDate, isWorkingDay, businessHours } = useBusinessHours(
    resolvedTeamId, 
    appState.isIndividualBooking ? appState.individualMember?.id : undefined
  );

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilityView, setAvailabilityView] = useState<'list' | 'calendar'>('list');
  const [busyFetchRange, setBusyFetchRange] = useState(() => monthCalendarSpan(new Date()));
  const [monthlyBusySchedule, setMonthlyBusySchedule] = useState<Record<string, BusySlot[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedulingSettings, setSchedulingSettings] = useState<SchedulingWindowSettings | null>(null);
  const [draggedMember, setDraggedMember] = useState<{ id: string, from: 'required' | 'optional' | 'pool' } | null>(null);
  
  const hasInitialized = useRef(false);

  const connectedMembers = useMemo(() => {
    if (appState.isIndividualBooking && appState.individualMember) {
      return [appState.individualMember]; 
    }
    return teamMembers.filter(member => !!member.email);
  }, [teamMembers, appState.isIndividualBooking, appState.individualMember]);

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

  useEffect(() => {
    if (availabilityView !== 'list') return;
    setBusyFetchRange(monthCalendarSpan(currentMonth));
  }, [currentMonth, availabilityView]);

  const selectedMembers = useMemo(() => {
    const requiredMembers = Array.from(appState.requiredMembers)
      .map(memberId => connectedMembers.find(m => m.id === memberId))
      .filter(Boolean);
    
    const optionalMembers = Array.from(appState.optionalMembers)
      .map(memberId => connectedMembers.find(m => m.id === memberId))
      .filter(Boolean);
    
    const allSelectedIds = new Set([...appState.requiredMembers, ...appState.optionalMembers]);
    const poolMembers = connectedMembers.filter(m => !allSelectedIds.has(m.id));

    const sortedAllMembers = [...connectedMembers].sort((a, b) => a.name.localeCompare(b.name));
    
    const assignColor = (memberId: string): MemberColor => {
       const index = sortedAllMembers.findIndex(m => m.id === memberId);
       return MEMBER_COLORS[Math.max(0, index) % MEMBER_COLORS.length];
    };

    const enhanceMember = (m: TeamMemberConfig) => ({ ...m, color: assignColor(m.id) });

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

  /** Same color assignment as list view — keyed by email for busy calendar blocks. */
  const memberDisplayByEmail = useMemo(() => {
    const sortedAllMembers = [...connectedMembers].sort((a, b) => a.name.localeCompare(b.name));
    const assignColor = (memberId: string): MemberColor => {
      const index = sortedAllMembers.findIndex(m => m.id === memberId);
      return MEMBER_COLORS[Math.max(0, index) % MEMBER_COLORS.length];
    };
    const map = new Map<string, { name: string; color: MemberColor }>();
    for (const m of connectedMembers) {
      if (!m.email) continue;
      map.set(m.email.toLowerCase().trim(), { name: m.name, color: assignColor(m.id) });
    }
    return map;
  }, [connectedMembers]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  useEffect(() => {
    const loadSchedulingSettings = async () => {
      try {
        let foundSettings = null;

        // 1. Try Individual Member Override
        if (appState.isIndividualBooking && appState.individualMember?.id) {
          const { data } = await supabase
            .from('scheduling_window_settings')
            .select('min_notice_hours, max_advance_days, availability_type')
            .eq('team_member_id', appState.individualMember.id)
            .eq('is_active', true)
            .maybeSingle();
          if (data) foundSettings = data;
        }

        // 2. Try Client Team Override
        if (!foundSettings && resolvedTeamId) {
          const { data } = await supabase
            .from('scheduling_window_settings')
            .select('min_notice_hours, max_advance_days, availability_type')
            .eq('client_team_id', resolvedTeamId)
            .eq('is_active', true)
            .maybeSingle();
          if (data) foundSettings = data;
        }

        // 3. Fallback to Global Defaults
        if (!foundSettings) {
          const { data } = await supabase
            .from('scheduling_window_settings')
            .select('min_notice_hours, max_advance_days, availability_type')
            .is('client_team_id', null)
            .is('team_member_id', null)
            .eq('is_active', true)
            .maybeSingle();
          if (data) foundSettings = data;
        }

        // Apply whatever settings we found
        if (foundSettings) {
          setSchedulingSettings({
            min_notice_hours: foundSettings.min_notice_hours || 4,
            max_advance_days: foundSettings.max_advance_days || 60,
            availability_type: foundSettings.availability_type || 'available_now'
          });
        } else {
          setSchedulingSettings({ min_notice_hours: 4, max_advance_days: 60, availability_type: 'available_now' });
        }
      } catch (err) {
        console.error('Error fetching scheduling settings:', err);
        setSchedulingSettings({ min_notice_hours: 4, max_advance_days: 60, availability_type: 'available_now' });
      }
    };
    loadSchedulingSettings();
  }, [appState.isIndividualBooking, appState.individualMember?.id, resolvedTeamId]);

  const busyRangeStartMs = busyFetchRange.start.getTime();
  const busyRangeEndMs = busyFetchRange.end.getTime();
  const availabilityEmailsKey =
    selectedMemberEmails.all.length > 0 ? [...selectedMemberEmails.all].sort().join(',') : 'empty';

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
        const start = busyFetchRange.start;
        const end = busyFetchRange.end;
        
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
          Object.entries(data.availability.calendars).forEach(([email, calendar]) => {
            const cal = calendar as { busy?: BusySlot[] };
            memberBusySchedules[email] = Array.isArray(cal.busy) ? cal.busy : [];
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- busyRange* + availabilityEmailsKey mirror range & member list
  }, [busyRangeStartMs, busyRangeEndMs, availabilityEmailsKey]);

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
      const minutes = effectiveStart.getMinutes();
      const remainder = minutes % 15;
      if (remainder !== 0) {
        effectiveStart.setMinutes(minutes + (15 - remainder));
      }
      effectiveStart.setSeconds(0);
      effectiveStart.setMilliseconds(0);
    }
    
    let currentTime = new Date(effectiveStart);
    
    while (currentTime < workingEnd) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60000);
      if (slotEnd > workingEnd) break;

      const requiredMembersAvailable: string[] = [];
      let allRequiredAvailable = true;
      
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
  }, [
    schedulingSettings,
    appState.duration,
    appState.requiredMembers,
    appState.optionalMembers,
    selectedMemberEmails.required,
    monthlyBusySchedule,
    getWorkingHoursForDate,
    selectedMembers,
  ]);

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

  useEffect(() => {
    if (!selectedDate || !schedulingSettings) {
      setAvailableSlots([]);
      return;
    }
    if (loading) return;
    const slots = generateSlotsForDate(selectedDate);
    setAvailableSlots(slots);
  }, [selectedDate, generateSlotsForDate, schedulingSettings, loading, monthlyBusySchedule]);

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

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    onStateChange({ selectedDate: format(date, 'yyyy-MM-dd') });
  }, [onStateChange]);

  const formatTimeSlot = useCallback((time: Date) => {
    const userTimezone = appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return time.toLocaleTimeString('en-US', { 
      hour: appState.timeFormat === '24h' ? '2-digit' : 'numeric', 
      minute: '2-digit', 
      hour12: appState.timeFormat !== '24h', 
      timeZone: userTimezone 
    });
  }, [appState.timezone, appState.timeFormat]);

  const handleTimeSelect = useCallback((slot: TimeSlot) => {
    const d = new Date(slot.start);
    setSelectedDate(d);
    onStateChange({ 
      selectedTime: slot.start, 
      selectedDate: format(d, 'yyyy-MM-dd')
    });
  }, [onStateChange]);

  const firstAvailableCalendarDate = useMemo(() => {
    if (!schedulingSettings || selectedMemberEmails.required.length === 0) return null;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    for (const date of calendarDays) {
      if (date < todayStart && !isSameDay(date, now)) continue;
      const key = format(date, 'yyyy-MM-dd');
      if (dailyAvailabilityMap.has(key)) return date;
    }
    return null;
  }, [calendarDays, dailyAvailabilityMap, schedulingSettings, selectedMemberEmails.required]);

  const embedAutoDatePicked = useRef(false);
  const embedAutoTimePicked = useRef(false);

  useEffect(() => {
    if (!isEmbed || embedAutoDatePicked.current || selectedDate || !firstAvailableCalendarDate) return;
    if (loading || membersLoading) return;
    handleDateSelect(firstAvailableCalendarDate);
    embedAutoDatePicked.current = true;
  }, [
    isEmbed,
    firstAvailableCalendarDate,
    selectedDate,
    loading,
    membersLoading,
    handleDateSelect,
  ]);

  useEffect(() => {
    if (!isEmbed || embedAutoTimePicked.current || appState.selectedTime) return;
    if (loading || !schedulingSettings) return;
    if (!selectedDate || availableSlots.length === 0) return;
    handleTimeSelect(availableSlots[0]);
    embedAutoTimePicked.current = true;
  }, [
    isEmbed,
    loading,
    schedulingSettings,
    selectedDate,
    availableSlots,
    appState.selectedTime,
    handleTimeSelect,
  ]);

  const fcTimezone = appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fullCalendarEvents: EventInput[] = useMemo(() => {
    if (!schedulingSettings) return [];

    const endInclusive = new Date(busyFetchRange.end.getTime() - 1);
    if (endInclusive < busyFetchRange.start) return [];

    const daysInRange = eachDayOfInterval({ start: busyFetchRange.start, end: endInclusive });
    const now = new Date();

    /** Matches `<FullCalendar slotMinTime` / `slotMaxTime` (09:00–18:00). */
    const FC_SLOT_MIN_H = 9;
    const FC_SLOT_MAX_H = 18;

    const nonBizEvents = buildNonBusinessBackgroundEvents(
      daysInRange,
      fcTimezone,
      FC_SLOT_MIN_H,
      FC_SLOT_MAX_H,
      getWorkingHoursForDate
    );

    const busyEvents: EventInput[] = [];
    Object.entries(monthlyBusySchedule).forEach(([email, slots]) => {
      const key = email.toLowerCase().trim();
      const display = memberDisplayByEmail.get(key);
      const hex = display?.color.hex ?? '#64748b';
      const memberName = display?.name ?? email.split('@')[0] ?? email;
      slots.forEach((busy, i) => {
        const segments = splitBusySlotsForCalendar(
          busy.start,
          busy.end,
          fcTimezone,
          FC_SLOT_MIN_H,
          FC_SLOT_MAX_H
        );
        segments.forEach((seg, segIdx) => {
          busyEvents.push({
            id: `busy-${email}-${i}-${segIdx}-${seg.start}`,
            title: memberName,
            start: seg.start,
            end: seg.end,
            backgroundColor: hex,
            borderColor: darkenBorderHex(hex),
            textColor: '#ffffff',
            extendedProps: { kind: 'busy' as const },
            classNames: ['fc-slot-busy'],
          });
        });
      });
    });

    const slotEvents: EventInput[] = [];
    if (!loading) {
      daysInRange.forEach(day => {
        if (day < now && !isSameDay(day, now)) return;
        const slots = generateSlotsForDate(day);
        slots.forEach((slot, idx) => {
          const isSelected = appState.selectedTime === slot.start;
          slotEvents.push({
            id: `avail-${slot.start}-${idx}`,
            title: '',
            start: slot.start,
            end: slot.end,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            extendedProps: { slot, kind: 'available' as const },
            classNames: isSelected ? ['fc-slot-selected-event'] : ['fc-slot-available-event'],
          });
        });
      });
    }

    return [...nonBizEvents, ...busyEvents, ...slotEvents];
  }, [
    schedulingSettings,
    loading,
    busyFetchRange.start,
    busyFetchRange.end,
    monthlyBusySchedule,
    generateSlotsForDate,
    getWorkingHoursForDate,
    businessHours,
    appState.selectedTime,
    appState.requiredMembers,
    appState.optionalMembers,
    memberDisplayByEmail,
    fcTimezone,
  ]);

  const fcTeamCompositionKey = useMemo(() => {
    const req = [...appState.requiredMembers].sort().join('|');
    const opt = [...appState.optionalMembers].sort().join('|');
    return `${req}__${opt}`;
  }, [appState.requiredMembers, appState.optionalMembers]);

  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null);
  const [fcToolbarTitle, setFcToolbarTitle] = useState('');
  const [fcActiveView, setFcActiveView] = useState<'timeGridDay' | 'timeGridWeek'>('timeGridWeek');

  const handleFcDatesSet = useCallback(
    (info: DatesSetArg) => {
      setBusyFetchRange({ start: info.start, end: info.end });
      setFcActiveView(info.view.type === 'timeGridDay' ? 'timeGridDay' : 'timeGridWeek');
      const start = DateTime.fromJSDate(info.start).setZone(fcTimezone);
      const endExclusive = DateTime.fromJSDate(info.end).setZone(fcTimezone);
      const end = endExclusive.minus({ milliseconds: 1 });
      if (!start.isValid || !end.isValid) return;

      if (info.view.type === 'timeGridDay') {
        setFcToolbarTitle(start.setLocale('en-GB').toFormat('EEEE d MMMM yyyy'));
        return;
      }

      if (start.month === end.month && start.year === end.year) {
        setFcToolbarTitle(`${start.day} – ${end.day} ${start.setLocale('en-GB').toFormat('MMMM yyyy')}`);
      } else {
        setFcToolbarTitle(`${start.toFormat('d/M/yyyy')} – ${end.toFormat('d/M/yyyy')}`);
      }
    },
    [fcTimezone]
  );

  const handleFcEventClick = useCallback((info: EventClickArg) => {
    const kind = info.event.extendedProps?.kind;
    if (kind === 'busy') {
      info.jsEvent.preventDefault();
      return;
    }
    const slot = info.event.extendedProps?.slot as TimeSlot | undefined;
    if (kind !== 'available' || !slot) return;
    info.jsEvent.preventDefault();
    handleTimeSelect(slot);
  }, [handleTimeSelect]);

  const fcFormats = useMemo(() => {
    const is24 = appState.timeFormat === '24h';
    return {
      slotLabelFormat: is24
        ? { hour: '2-digit', minute: '2-digit', hour12: false }
        : { hour: 'numeric', minute: '2-digit', meridiem: 'short' as const },
      eventTimeFormat: is24
        ? { hour: '2-digit', minute: '2-digit', hour12: false }
        : { hour: 'numeric', minute: '2-digit', meridiem: 'short' as const },
    };
  }, [appState.timeFormat]);

  const renderFcEventContent = useCallback(
    (arg: EventContentArg) => {
      const kind = arg.event.extendedProps?.kind;

      if (kind === 'busy') {
        const title = arg.event.title || '';
        const start = arg.event.start;
        const end = arg.event.end;
        if (!start || !end) return null;
        const startDt = start instanceof Date ? start : new Date(start);
        const endDt = end instanceof Date ? end : new Date(end);
        const timeLabel = `${formatTimeSlot(startDt)} – ${formatTimeSlot(endDt)}`;
        return (
          <div
            className={`fc-busy-inner flex h-full min-h-full flex-col gap-0.5 overflow-hidden px-0.5 py-0.5 text-[10px] leading-tight ${
              isEmbed ? 'text-slate-900' : 'text-white'
            }`}
            style={isEmbed ? undefined : { textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
          >
            <div className="truncate font-semibold">{title}</div>
            <div className={`truncate ${isEmbed ? 'text-slate-700' : 'text-white/90'}`}>{timeLabel}</div>
          </div>
        );
      }

      const slot = arg.event.extendedProps?.slot as TimeSlot | undefined;
      if (kind !== 'available' || !slot) {
        return null;
      }
      const startDt = new Date(slot.start);
      const endDt = new Date(slot.end);
      const timeLabel = `${formatTimeSlot(startDt)} – ${formatTimeSlot(endDt)}`;
      return (
        <div className="fc-custom-slot-inner flex h-full min-h-0 w-full min-w-0 flex-col justify-center gap-1 px-1 py-0.5">
          <div
            className="fc-avail-time max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[9px] font-semibold leading-none text-inherit"
            title={timeLabel}
          >
            {timeLabel}
          </div>
          <div className="flex shrink-0 flex-nowrap justify-center gap-0.5 overflow-hidden">
            {slot.attendees
              ?.filter((a): a is SlotAttendee => a.available)
              .map((attendee) => (
                <span
                  key={attendee.email}
                  title={attendee.name}
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/50"
                  style={{ backgroundColor: attendee.color?.hex }}
                />
              ))}
          </div>
        </div>
      );
    },
    [formatTimeSlot, isEmbed]
  );

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(direction === 'next' ? 
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) : 
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const handleBack = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('step'); 
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
    onBack();
  };

  const handleNextWithLogs = () => {
    onNext();
  };

  if (membersLoading && !appState.isIndividualBooking) {
    return (
      <div className="flex items-center justify-center py-12 text-e3-white/60 gap-3">
        <Loader className="w-6 h-6 animate-spin" />
        <span>Loading availability...</span>
      </div>
    );
  }

  if (connectedMembers.length === 0) {
     return <div className="text-center py-12 text-e3-white/60">No members found for this team.</div>;
  }

  const gridCols = (appState.duration || 60) <= 30 ? 'grid-cols-3' : 'grid-cols-2';

  const tx = {
    h2: isEmbed ? 'text-slate-900' : 'text-e3-white',
    h3: isEmbed ? 'text-slate-900' : 'text-e3-white',
    muted: isEmbed ? 'text-slate-500' : 'text-e3-white/60',
    subtle: isEmbed ? 'text-slate-400' : 'text-e3-white/40',
    icon: isEmbed ? 'text-e3-azure' : 'text-e3-azure',
    panel: isEmbed
      ? 'rounded-lg border border-slate-200 bg-slate-50'
      : 'bg-e3-space-blue/50 rounded-lg p-4 border border-e3-white/10',
    slotPanel: isEmbed
      ? 'rounded-lg border border-slate-200 bg-white p-4 flex flex-col h-full'
      : 'bg-e3-space-blue/50 rounded-lg p-4 border border-e3-white/10 flex flex-col h-full',
    tabsList: isEmbed
      ? 'grid w-full grid-cols-2 lg:inline-flex h-9 bg-slate-100 border border-slate-200 p-1'
      : 'grid w-full grid-cols-2 lg:inline-flex h-9 bg-e3-space-blue/50 border border-e3-white/10 p-1',
    poolWrap: isEmbed ? 'bg-slate-100 border-slate-200' : 'bg-e3-space-blue/30 border-e3-white/10',
    memberBox: (base: 'required' | 'optional') =>
      isEmbed
        ? `rounded-lg p-3 border min-h-[80px] border-slate-200 ${base === 'required' ? 'bg-slate-50' : 'bg-slate-50'}`
        : `rounded-lg p-3 border border-e3-azure/20 transition-colors min-h-[80px] ${base === 'required' ? 'bg-e3-space-blue/30' : 'bg-e3-space-blue/30'}`,
  };

  const scheduleColumn = (
    <>
      <div className="flex flex-col gap-3 mb-2 flex-none">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="flex-none flex items-center gap-3 pt-1 min-w-[200px]">
            <Calendar className={`w-6 h-6 ${tx.icon}`} />
            <div>
              <h2 className={`text-xl font-bold ${tx.h2}`}>Select Date & Time</h2>
              {!appState.isIndividualBooking && (
                <p className={`${tx.muted} text-sm`}>Drag members to change status</p>
              )}
            </div>
          </div>

          <Tabs
            value={availabilityView}
            onValueChange={(v) => setAvailabilityView(v as 'list' | 'calendar')}
            className="w-full lg:w-auto lg:shrink-0"
          >
            <TabsList className={tx.tabsList}>
              <TabsTrigger
                value="list"
                className="gap-1.5 px-3 text-xs data-[state=active]:bg-e3-emerald data-[state=active]:text-e3-space-blue"
              >
                <List className="w-3.5 h-3.5 shrink-0" /> List view
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="gap-1.5 px-3 text-xs data-[state=active]:bg-e3-emerald data-[state=active]:text-e3-space-blue"
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" /> Calendar view
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {!appState.isIndividualBooking && (
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
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">
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
        )}
      </div>

      {!appState.isIndividualBooking && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-none">
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
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px]">
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
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px]">
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
      )}

      {error && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}

      <div className="flex-grow min-h-0">
        {availabilityView === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          <div className={`${tx.panel} p-4 flex flex-col h-full`}>
            <div className="flex items-center justify-between mb-4 flex-none">
              <h3 className={`font-semibold text-sm ${tx.h3}`}>{format(currentMonth, 'MMMM yyyy')}</h3>
              <div className="flex gap-2">
                <button type="button" onClick={() => navigateMonth('prev')} className={`p-1.5 rounded-lg transition ${isEmbed ? 'hover:bg-slate-200' : 'hover:bg-e3-white/10'}`}><ChevronLeft className={`w-4 h-4 ${isEmbed ? 'text-slate-700' : 'text-e3-white'}`} /></button>
                <button type="button" onClick={() => navigateMonth('next')} className={`p-1.5 rounded-lg transition ${isEmbed ? 'hover:bg-slate-200' : 'hover:bg-e3-white/10'}`}><ChevronRight className={`w-4 h-4 ${isEmbed ? 'text-slate-700' : 'text-e3-white'}`} /></button>
              </div>
            </div>

            {loading && (
              <div className="text-center py-2">
                <div className="w-5 h-5 border-2 border-e3-azure/30 border-t-e3-azure rounded-full animate-spin mx-auto mb-1" />
                <p className={`${tx.muted} text-xs`}>Checking calendars...</p>
              </div>
            )}

            <div className="grid grid-cols-7 gap-1 flex-grow content-start">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => (
                <div key={day} className={`text-center text-xs font-medium py-2 ${isEmbed ? 'text-slate-400' : 'text-e3-white/40'}`}>{day}</div>
              ))}
              {calendarDays.map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isWorkDay = isWorkingDay(date);
                const isPast = date < new Date() && !isSameDay(date, new Date());
                const dateStr = format(date, 'yyyy-MM-dd');
                const freeMembersForDay = dailyAvailabilityMap.get(dateStr) || new Set();
                const hasAvailability = freeMembersForDay.size > 0;

                return (
                  <button
                    key={index}
                    onClick={() => !isPast && isWorkDay && handleDateSelect(date)}
                    disabled={isPast || !isWorkDay || !isCurrentMonth}
                    className={`
                      h-10 sm:h-9 md:h-10 w-full rounded-md text-xs font-medium relative flex flex-col items-center justify-center gap-1 transition-all
                      ${!isCurrentMonth ? (isEmbed ? 'text-slate-300' : 'text-e3-white/10')
                        : isSelected ? 'bg-e3-emerald text-e3-space-blue font-bold shadow-lg' 
                        : isWorkDay && !isPast && hasAvailability
                          ? (isEmbed ? 'text-slate-800 bg-slate-100 hover:bg-slate-200' : 'text-e3-white bg-e3-white/5 hover:bg-e3-white/10')
                        : (isEmbed ? 'text-slate-300 cursor-not-allowed' : 'text-e3-white/20 cursor-not-allowed')}
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

          <div className={`${tx.slotPanel}`}>
            <div className={`flex flex-col gap-3 mb-4 flex-none border-b pb-3 ${isEmbed ? 'border-slate-200' : 'border-e3-white/5'}`}>
              <div className="flex items-center justify-between">
                 <h3 className={`${tx.h3} font-semibold text-sm`}>Duration</h3>
                 <div className={`flex items-center gap-1 rounded-md border p-0.5 ${isEmbed ? 'border-slate-200 bg-slate-100' : 'bg-e3-space-blue border-e3-white/10'}`}>
                   <button type="button" onClick={() => onStateChange({ timeFormat: '12h' })} className={`px-2 py-0.5 text-[10px] rounded ${appState.timeFormat === '12h' ? 'bg-e3-azure text-white' : isEmbed ? 'text-slate-500' : 'text-e3-white/50'}`}>12h</button>
                   <button type="button" onClick={() => onStateChange({ timeFormat: '24h' })} className={`px-2 py-0.5 text-[10px] rounded ${appState.timeFormat === '24h' ? 'bg-e3-azure text-white' : isEmbed ? 'text-slate-500' : 'text-e3-white/50'}`}>24h</button>
                 </div>
              </div>
              <div className="flex gap-2">
                {[15, 30, 45, 60, 90].map(dur => (
                  <button 
                    type="button"
                    key={dur} 
                    onClick={() => onStateChange({ duration: dur })}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${appState.duration === dur ? 'bg-e3-emerald text-e3-space-blue border-e3-emerald font-medium' : isEmbed ? 'border-slate-200 text-slate-700 hover:border-slate-300' : 'border-e3-white/10 text-e3-white/70 hover:border-e3-white/30'}`}
                  >
                    {dur}m
                  </button>
                ))}
              </div>
            </div>

            <h3 className={`${tx.h3} font-semibold text-sm mb-2 flex-none`}>Available times</h3>

            <div className="flex-grow relative overflow-hidden min-h-[200px]">
               {!selectedDate ? (
                  <div className={`absolute inset-0 flex flex-col items-center justify-center ${isEmbed ? 'text-slate-400' : 'text-e3-white/30'}`}>
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
                  <div className="absolute inset-0 overflow-y-auto pr-1">
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
                                    ?.filter((a): a is SlotAttendee => a.available)
                                    .map((attendee) => (
                                        <div 
                                            key={attendee.email}
                                            style={{ backgroundColor: attendee.color?.hex }}
                                            className="w-1.5 h-1.5 rounded-full"
                                        />
                                    ))}
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
        ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-e3-space-blue/50 rounded-lg p-4 border border-e3-white/10">
            <div className="flex flex-col gap-3 flex-none border-b border-e3-white/5 pb-3 mb-1">
              <div className="flex items-center justify-between">
                <h3 className="text-e3-white font-semibold text-sm">Duration</h3>
                <div className="flex items-center gap-1 bg-e3-space-blue border border-e3-white/10 rounded-md p-0.5">
                  <button type="button" onClick={() => onStateChange({ timeFormat: '12h' })} className={`px-2 py-0.5 text-[10px] rounded ${appState.timeFormat === '12h' ? 'bg-e3-azure text-white' : 'text-e3-white/50'}`}>12h</button>
                  <button type="button" onClick={() => onStateChange({ timeFormat: '24h' })} className={`px-2 py-0.5 text-[10px] rounded ${appState.timeFormat === '24h' ? 'bg-e3-azure text-white' : 'text-e3-white/50'}`}>24h</button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[15, 30, 45, 60, 90].map(dur => (
                  <button
                    type="button"
                    key={dur}
                    onClick={() => onStateChange({ duration: dur })}
                    className={`flex-1 min-w-[52px] py-1.5 text-xs rounded border transition-colors ${appState.duration === dur ? 'bg-e3-emerald text-e3-space-blue border-e3-emerald font-medium' : 'border-e3-white/10 text-e3-white/70 hover:border-e3-white/30'}`}
                  >
                    {dur}m
                  </button>
                ))}
              </div>
            </div>
            <p className="text-e3-white/50 text-xs mt-2">
              Colored blocks are busy times. Shaded areas are outside business hours. Dashed outlines mark bookable slots — click one to select.
            </p>
          </div>

          <div className="relative bg-e3-space-blue/50 rounded-lg border border-e3-white/10 p-2 overflow-hidden min-h-[320px] sm:min-h-[400px]">
            {loading && (
              <div className="pointer-events-none absolute right-2 top-2 z-[6] flex items-center gap-1.5 rounded-md border border-e3-white/10 bg-e3-space-blue/90 px-2 py-1 shadow-sm backdrop-blur-sm">
                <Loader className="h-3.5 w-3.5 shrink-0 animate-spin text-e3-azure" />
                <span className="text-[10px] text-e3-white/75">Updating calendars…</span>
              </div>
            )}
            <div
              className={`availability-fc -mx-1 overflow-x-auto px-1 pb-1 ${isEmbed ? 'availability-fc--embed' : ''}`}
            >
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-center gap-1 sm:justify-start">
                  <button
                    type="button"
                    aria-label="Previous"
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-e3-white/20 bg-e3-space-blue/60 text-e3-white hover:bg-e3-white/10"
                    onClick={() => calendarRef.current?.getApi().prev()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next"
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-e3-white/20 bg-e3-space-blue/60 text-e3-white hover:bg-e3-white/10"
                    onClick={() => calendarRef.current?.getApi().next()}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded border border-e3-white/20 bg-e3-space-blue/60 px-2.5 py-1.5 text-xs text-e3-white hover:bg-e3-white/10"
                    onClick={() => calendarRef.current?.getApi().today()}
                  >
                    Today
                  </button>
                </div>
                <h2 className="order-first min-w-0 truncate text-center text-sm font-semibold text-e3-white sm:order-none sm:flex-1 sm:px-2">
                  {fcToolbarTitle}
                </h2>
                <div className="flex items-center justify-center gap-1 sm:justify-end">
                  <button
                    type="button"
                    className={`rounded border px-2.5 py-1.5 text-xs ${
                      fcActiveView === 'timeGridDay'
                        ? 'border-e3-emerald bg-e3-emerald/25 text-white'
                        : 'border-e3-white/20 bg-e3-space-blue/60 text-e3-white/85 hover:bg-e3-white/10'
                    }`}
                    onClick={() => calendarRef.current?.getApi().changeView('timeGridDay')}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    className={`rounded border px-2.5 py-1.5 text-xs ${
                      fcActiveView === 'timeGridWeek'
                        ? 'border-e3-emerald bg-e3-emerald/25 text-white'
                        : 'border-e3-white/20 bg-e3-space-blue/60 text-e3-white/85 hover:bg-e3-white/10'
                    }`}
                    onClick={() => calendarRef.current?.getApi().changeView('timeGridWeek')}
                  >
                    Week
                  </button>
                </div>
              </div>
              <FullCalendar
                ref={calendarRef}
                key={`fc-${fcTimezone}-${appState.timeFormat}-${fcTeamCompositionKey}`}
                plugins={[luxon3Plugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={false}
                locale={enGbLocale}
                events={fullCalendarEvents}
                datesSet={handleFcDatesSet}
                eventClick={handleFcEventClick}
                eventContent={renderFcEventContent}
                selectable={false}
                timeZone={fcTimezone}
                firstDay={1}
                nowIndicator
                slotMinTime="09:00:00"
                slotMaxTime="18:00:00"
                slotDuration="00:30:00"
                snapDuration="00:15:00"
                slotLabelInterval="00:30:00"
                slotLabelFormat={fcFormats.slotLabelFormat}
                eventTimeFormat={fcFormats.eventTimeFormat}
                dayHeaderFormat="EEE d/M"
                allDaySlot={false}
                contentHeight="auto"
                scrollTime="09:00:00"
                eventOrder="start"
                displayEventTime={false}
              />
            </div>
          </div>

          <div className="bg-e3-space-blue/50 rounded-lg p-4 border border-e3-white/10">
            <TimezoneSelector
              value={appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              onChange={(timezone) => onStateChange({ timezone })}
            />
          </div>
        </div>
        )}
      </div>

      {!isEmbed && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-md border-t border-e3-white/10 z-50">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="order-2 sm:order-1 w-full sm:w-auto py-3 px-6 text-e3-white/80 hover:text-e3-white transition rounded-lg border border-e3-white/20 hover:border-e3-white/40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNextWithLogs}
              disabled={
                !appState.selectedDate ||
                !appState.selectedTime ||
                (appState.requiredMembers.size > 0 && selectedMembers.required.length === 0)
              }
              className="order-1 sm:order-2 w-full sm:w-auto cta disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      className={
        isEmbed
          ? 'flex h-full min-h-[480px] flex-col gap-0 pb-4 lg:grid lg:grid-cols-2 lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-sm'
          : 'flex h-full flex-col gap-4 pb-28'
      }
    >
      {isEmbed && (
        <div className="flex flex-col border-b border-white/10 bg-e3-space-blue p-5 lg:min-h-0 lg:border-b-0 lg:border-r lg:border-white/10">
          <EmbedHostPanel host={embedHost ?? undefined} appState={appState} variant="schedule" />
        </div>
      )}
      <div
        className={
          isEmbed
            ? 'flex min-h-0 flex-1 flex-col bg-white p-4 text-slate-900 lg:p-6'
            : 'flex min-h-0 flex-1 flex-col'
        }
      >
        {scheduleColumn}
      </div>
    </div>
  );
};

export default AvailabilityStep;