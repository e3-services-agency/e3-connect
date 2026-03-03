import React, { useState, useEffect } from 'react';
import { Clock, Plus, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { TimezoneSelector } from './TimezoneSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TimeSlot {
  start: string;
  end: string;
}

interface DaySchedule {
  isOpen: boolean;
  slots: TimeSlot[];
}

interface BusinessHours {
  id: string;
  name: string;
  timezone: string;
  is_active: boolean;
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
  time_format?: '12h' | '24h';
}

const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

const ImprovedBusinessHours: React.FC = () => {
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [daySchedules, setDaySchedules] = useState<Record<string, DaySchedule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [repeatType, setRepeatType] = useState('weekly');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const { toast } = useToast();

  useEffect(() => {
    loadBusinessHours();
  }, []);

  const loadBusinessHours = async () => {
    try {
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setBusinessHours(data);
        convertToScheduleFormat(data);
        if (data.time_format) {
          setTimeFormat(data.time_format as '12h' | '24h');
        }
      }
    } catch (error) {
      console.error('Error loading business hours:', error);
      toast({
        title: "Error",
        description: "Failed to load business hours",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const convertToScheduleFormat = (hours: BusinessHours) => {
    const schedules: Record<string, DaySchedule> = {};
    
    DAYS.forEach(({ key }) => {
      const startKey = `${key}_start` as keyof BusinessHours;
      const endKey = `${key}_end` as keyof BusinessHours;
      const startTime = hours[startKey] as string | null;
      const endTime = hours[endKey] as string | null;
      
      schedules[key] = {
        isOpen: !!(startTime && endTime),
        slots: startTime && endTime ? [{ start: startTime.slice(0, 5), end: endTime.slice(0, 5) }] : []
      };
    });
    
    setDaySchedules(schedules);
  };

  const saveBusinessHours = async () => {
    if (!businessHours) return;

    setSaving(true);
    try {
      const updatedHours: any = { 
        ...businessHours,
        time_format: timeFormat 
      };
      
      DAYS.forEach(({ key }) => {
        const schedule = daySchedules[key];
        const startKey = `${key}_start` as keyof BusinessHours;
        const endKey = `${key}_end` as keyof BusinessHours;
        
        if (schedule?.isOpen && schedule.slots.length > 0) {
          updatedHours[startKey] = schedule.slots[0].start + ':00';
          updatedHours[endKey] = schedule.slots[0].end + ':00';
        } else {
          updatedHours[startKey] = null;
          updatedHours[endKey] = null;
        }
      });

      const { error } = await supabase
        .from('business_hours')
        .upsert(updatedHours, { onConflict: 'id' });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Global business hours updated successfully",
      });
      loadBusinessHours();
    } catch (error) {
      console.error('Error saving business hours:', error);
      toast({
        title: "Error",
        description: "Failed to save business hours",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayKey: string, isOpen: boolean) => {
    setDaySchedules(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        isOpen,
        slots: isOpen ? [{ start: '12:00', end: '18:00' }] : []
      }
    }));
  };

  const updateTimeSlot = (dayKey: string, slotIndex: number, field: 'start' | 'end', value: string) => {
    setDaySchedules(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.map((slot, index) =>
          index === slotIndex ? { ...slot, [field]: value } : slot
        )
      }
    }));
  };

  const addTimeSlot = (dayKey: string) => {
    setDaySchedules(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: [...(prev[dayKey]?.slots || []), { start: '12:00', end: '18:00' }]
      }
    }));
  };

  const removeTimeSlot = (dayKey: string, slotIndex: number) => {
    setDaySchedules(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.filter((_, index) => index !== slotIndex)
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-e3-emerald"></div>
      </div>
    );
  }

  if (!businessHours) {
    return (
      <div className="text-center p-8">
        <p className="text-e3-white/60">No business hours found</p>
        <Button 
          onClick={() => setBusinessHours({
            id: '',
            name: 'Default Business Hours',
            timezone: 'UTC',
            is_active: true,
            monday_start: null,
            monday_end: null,
            tuesday_start: null,
            tuesday_end: null,
            wednesday_start: null,
            wednesday_end: null,
            thursday_start: null,
            thursday_end: null,
            friday_start: null,
            friday_end: null,
            saturday_start: null,
            saturday_end: null,
            sunday_start: null,
            sunday_end: null,
          })}
          className="mt-4"
        >
          Create Business Hours
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-5 h-5 text-e3-emerald" />
        <h2 className="text-xl font-semibold text-e3-white">General availability</h2>
      </div>
      <p className="text-e3-white/60 mb-6">
        Set when you're regularly available for appointments.{' '}
        <span className="text-e3-emerald cursor-pointer hover:underline">Learn more</span>
      </p>

      <Card className="bg-e3-space-blue/30 border-e3-white/10">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Select value={repeatType} onValueChange={setRepeatType}>
              <SelectTrigger className="w-40 bg-e3-space-blue/50 border-e3-white/20 text-e3-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Repeat weekly</SelectItem>
                <SelectItem value="monthly">Repeat monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {DAYS.map(({ key, label }) => {
              const schedule = daySchedules[key] || { isOpen: false, slots: [] };
              
              return (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-12 text-e3-white font-medium">{label}</div>
                  
                  {schedule.isOpen ? (
                    <div className="flex items-center gap-3 flex-1">
                      {schedule.slots.map((slot, slotIndex) => (
                        <div key={slotIndex} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateTimeSlot(key, slotIndex, 'start', e.target.value)}
                            className="w-24 bg-e3-space-blue/50 border-e3-white/20 text-e3-white"
                          />
                          <span className="text-e3-white/60">–</span>
                          <Input
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateTimeSlot(key, slotIndex, 'end', e.target.value)}
                            className="w-24 bg-e3-space-blue/50 border-e3-white/20 text-e3-white"
                          />
                          {schedule.slots.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeTimeSlot(key, slotIndex)}
                              className="h-8 w-8 p-0 text-e3-white/60 hover:text-e3-white"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => addTimeSlot(key)}
                        className="h-8 w-8 p-0 text-e3-white/60 hover:text-e3-white"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleDay(key, false)}
                        className="h-8 w-8 p-0 text-e3-white/60 hover:text-e3-white"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-e3-white/60">Unavailable</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleDay(key, true)}
                        className="h-8 w-8 p-0 text-e3-white/60 hover:text-e3-white"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 space-y-4">
            <TimezoneSelector
              value={businessHours.timezone}
              onChange={(timezone) => setBusinessHours({ ...businessHours, timezone })}
            />
            
            <div>
              <Label className="text-e3-white">Time Format</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant={timeFormat === '12h' ? "default" : "outline"}
                  onClick={() => setTimeFormat('12h')}
                  className={timeFormat === '12h' ? "bg-e3-emerald text-e3-space-blue" : "border-e3-white/20 text-e3-white"}
                >
                  12h
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={timeFormat === '24h' ? "default" : "outline"}
                  onClick={() => setTimeFormat('24h')}
                  className={timeFormat === '24h' ? "bg-e3-emerald text-e3-space-blue" : "border-e3-white/20 text-e3-white"}
                >
                  24h
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              onClick={saveBusinessHours}
              disabled={saving}
              className="bg-e3-emerald hover:bg-e3-emerald/90 text-e3-space-blue font-medium"
            >
              {saving ? 'Saving...' : 'Save Global Hours'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImprovedBusinessHours;