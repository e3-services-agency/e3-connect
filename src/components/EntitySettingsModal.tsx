import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import BookedAppointmentSettings from './BookedAppointmentSettings';
import SchedulingWindowSettings from './SchedulingWindowSettings';
import { BusinessHoursEditor, BusinessHoursData, DaySchedule } from './forms/BusinessHoursEditor';
import { supabase } from '../integrations/supabase/client';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';
import { Save, AlertCircle } from 'lucide-react';
import { Switch } from './ui/switch';

interface EntitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'team' | 'member';
  entityId: string;
  entityName: string;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const EntitySettingsModal: React.FC<EntitySettingsModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasCustomHours, setHasCustomHours] = useState(false);
  const [hoursId, setHoursId] = useState<string | null>(null);
  
  // Default structure for the editor
  const [hoursData, setHoursData] = useState<BusinessHoursData>({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    schedules: DAYS.reduce((acc, day) => ({
      ...acc,
      [day]: { isOpen: !['saturday', 'sunday'].includes(day), slots: [{ start: '09:00', end: '17:00' }] }
    }), {})
  });

  const tableName = entityType === 'team' ? 'client_team_business_hours' : 'team_member_business_hours';
  const columnRef = entityType === 'team' ? 'client_team_id' : 'team_member_id';

  useEffect(() => {
    if (isOpen) {
      fetchBusinessHours();
    }
  }, [isOpen, entityId]);

  const fetchBusinessHours = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(columnRef, entityId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHasCustomHours(true);
        setHoursId(data.id);
        
        const schedules: Record<string, DaySchedule> = {};
        DAYS.forEach((key) => {
          const startTime = data[`${key}_start`];
          const endTime = data[`${key}_end`];
          schedules[key] = {
            isOpen: !!(startTime && endTime),
            slots: startTime && endTime ? [{ start: startTime.slice(0, 5), end: endTime.slice(0, 5) }] : []
          };
        });
        
        setHoursData({
          timezone: data.timezone || 'UTC',
          schedules
        });
      } else {
        setHasCustomHours(false);
      }
    } catch (err) {
      console.error('Error fetching entity hours:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHours = async () => {
    setSaving(true);
    try {
      const dbRecord: any = {
        [columnRef]: entityId,
        timezone: hoursData.timezone,
        is_active: true,
        time_format: '24h'
      };

      DAYS.forEach((key) => {
        const schedule = hoursData.schedules[key];
        if (schedule?.isOpen && schedule.slots.length > 0) {
          dbRecord[`${key}_start`] = `${schedule.slots[0].start}:00`;
          dbRecord[`${key}_end`] = `${schedule.slots[0].end}:00`;
        } else {
          dbRecord[`${key}_start`] = null;
          dbRecord[`${key}_end`] = null;
        }
      });

      if (hasCustomHours && hoursId) {
        const { error } = await supabase.from(tableName).update(dbRecord).eq('id', hoursId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from(tableName).insert(dbRecord).select().single();
        if (error) throw error;
        setHoursId(data.id);
      }

      setHasCustomHours(true);
      toast({ title: 'Success', description: 'Custom business hours saved successfully.' });
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: 'Error', description: 'Failed to save business hours.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHours = async () => {
    if (!hoursId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', hoursId);
      if (error) throw error;
      
      setHasCustomHours(false);
      setHoursId(null);
      toast({ title: 'Override Removed', description: 'Entity will now use global business hours.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to remove override.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-e3-space-blue border-e3-white/20 text-e3-white max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        
        {/* Sticky Header so the admin always knows who they are editing */}
        <div className="sticky top-0 z-10 bg-e3-space-blue/95 border-b border-e3-white/10 p-6 backdrop-blur-md">
          <DialogTitle className="text-2xl font-bold text-e3-emerald">
            Rules & Overrides
          </DialogTitle>
          <p className="text-sm text-e3-white/60 mt-1">
            Configuring custom settings for <span className="font-bold text-e3-azure">{entityName}</span>. 
            If an override is disabled, it will fall back to your Global Rules.
          </p>
        </div>

        <div className="p-6 space-y-12">
          
          {/* SECTION 1: Business Hours */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-e3-white">Custom Business Hours</h3>
                <p className="text-sm text-e3-white/60">Override the default working hours</p>
              </div>
              <div className="flex items-center gap-2 bg-e3-space-blue/50 p-2 rounded-lg border border-e3-white/10">
                <Switch checked={hasCustomHours} onCheckedChange={(checked) => {
                  if(!checked) handleDeleteHours();
                  else setHasCustomHours(true);
                }} />
                <span className="text-sm font-medium">{hasCustomHours ? 'Custom Active' : 'Use Global'}</span>
              </div>
            </div>

            {hasCustomHours ? (
              <div className="bg-e3-space-blue/30 p-6 rounded-lg border border-e3-azure/30">
                {loading ? <div className="text-center py-4">Loading...</div> : (
                  <>
                    <BusinessHoursEditor value={hoursData} onChange={setHoursData} />
                    <div className="flex justify-end mt-4">
                      <Button onClick={handleSaveHours} disabled={saving} className="bg-e3-azure hover:bg-e3-azure/90 text-white">
                        {saving ? 'Saving...' : 'Save Hours Override'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-e3-space-blue/30 p-6 rounded-lg border border-e3-white/10 flex items-center gap-3 text-e3-white/60">
                <AlertCircle className="w-5 h-5" />
                <p>Currently using Global Business Hours. Toggle the switch above to create custom hours.</p>
              </div>
            )}
          </section>

          <div className="h-px bg-e3-white/10 w-full" />

          {/* SECTION 2: Scheduling Window */}
          <section>
            <SchedulingWindowSettings 
              clientTeamId={entityType === 'team' ? entityId : undefined}
              teamMemberId={entityType === 'member' ? entityId : undefined}
            />
          </section>

          <div className="h-px bg-e3-white/10 w-full" />

          {/* SECTION 3: Appointment Settings */}
          <section>
            <BookedAppointmentSettings 
              clientTeamId={entityType === 'team' ? entityId : undefined}
              teamMemberId={entityType === 'member' ? entityId : undefined}
            />
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EntitySettingsModal;