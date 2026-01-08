// useBusinessHours.ts
import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';

interface BusinessHours {
  id: string;
  name: string;
  timezone: string;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  is_active: boolean;
}

interface ClientTeamBusinessHours {
  id: string;
  client_team_id: string;
  timezone: string;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  is_active: boolean;
}

export interface WorkingHours {
  start: string | null;
  end: string | null;
}

export interface DayBusinessHours {
  monday: WorkingHours;
  tuesday: WorkingHours;
  wednesday: WorkingHours;
  thursday: WorkingHours;
  friday: WorkingHours;
  saturday: WorkingHours;
  sunday: WorkingHours;
  timezone: string;
}

export const useBusinessHours = (clientTeamId?: string) => {
  const [businessHours, setBusinessHours] = useState<DayBusinessHours | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBusinessHours();
  }, [clientTeamId]);

  const loadBusinessHours = async () => {
    try {
      setLoading(true);
      setError(null);

      let effectiveHours: BusinessHours | ClientTeamBusinessHours | null = null;

      // 1. Try to get CLIENT-SPECIFIC hours first
      if (clientTeamId) {
        const { data: clientHours, error: clientError } = await supabase
          .from('client_team_business_hours')
          .select('*')
          .eq('client_team_id', clientTeamId)
          .eq('is_active', true)
          .maybeSingle(); // ✅ CHANGED: .single() -> .maybeSingle() to prevent crash

        if (clientError) throw clientError;

        if (clientHours) {
          effectiveHours = clientHours;
        }
      }

      // 2. If no client hours found, get GLOBAL hours
      if (!effectiveHours) {
        const { data: globalHours, error: globalError } = await supabase
          .from('business_hours')
          .select('*')
          .eq('is_active', true)
          .maybeSingle(); // ✅ CHANGED: .single() -> .maybeSingle()

        if (globalError) throw globalError;

        effectiveHours = globalHours;
      }

      // 3. Convert to format or Fallback to Hardcoded Defaults
      if (effectiveHours) {
        const dayHours: DayBusinessHours = {
          monday: { start: effectiveHours.monday_start, end: effectiveHours.monday_end },
          tuesday: { start: effectiveHours.tuesday_start, end: effectiveHours.tuesday_end },
          wednesday: { start: effectiveHours.wednesday_start, end: effectiveHours.wednesday_end },
          thursday: { start: effectiveHours.thursday_start, end: effectiveHours.thursday_end },
          friday: { start: effectiveHours.friday_start, end: effectiveHours.friday_end },
          saturday: { start: effectiveHours.saturday_start, end: effectiveHours.saturday_end },
          sunday: { start: effectiveHours.sunday_start, end: effectiveHours.sunday_end },
          timezone: effectiveHours.timezone
        };
        setBusinessHours(dayHours);
      } else {
        // Fallback: 9 AM - 6 PM, Mon-Fri
        console.warn('No business hours found in DB, using defaults.');
        const defaultHours: DayBusinessHours = {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: null, end: null },
          sunday: { start: null, end: null },
          timezone: 'UTC'
        };
        setBusinessHours(defaultHours);
      }

    } catch (err) {
      console.error('Error loading business hours:', err);
      setError('Failed to load business hours');
      
      // Fallback on error
      const defaultHours: DayBusinessHours = {
        monday: { start: '09:00', end: '18:00' },
        tuesday: { start: '09:00', end: '18:00' },
        wednesday: { start: '09:00', end: '18:00' },
        thursday: { start: '09:00', end: '18:00' },
        friday: { start: '09:00', end: '18:00' },
        saturday: { start: null, end: null },
        sunday: { start: null, end: null },
        timezone: 'UTC'
      };
      setBusinessHours(defaultHours);
    } finally {
      setLoading(false);
    }
  };

  const getWorkingHoursForDate = (date: Date): WorkingHours => {
    if (!businessHours) {
      return { start: '09:00', end: '18:00' };
    }

    const dayOfWeek = date.getDay(); // 0 = Sunday
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = days[dayOfWeek] as keyof DayBusinessHours;

    if (dayKey === 'timezone') return { start: '09:00', end: '18:00' };

    return businessHours[dayKey] as WorkingHours;
  };

  const isWorkingDay = (date: Date): boolean => {
    const hours = getWorkingHoursForDate(date);
    return !!(hours.start && hours.end);
  };

  return {
    businessHours,
    loading,
    error,
    getWorkingHoursForDate,
    isWorkingDay,
    refetch: loadBusinessHours
  };
};