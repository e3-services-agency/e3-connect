import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import BookedAppointmentSettings from './BookedAppointmentSettings';
import SchedulingWindowSettings from './SchedulingWindowSettings';

interface EntitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'team' | 'member';
  entityId: string;
  entityName: string;
}

const EntitySettingsModal: React.FC<EntitySettingsModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-e3-space-blue border-e3-white/10 text-e3-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-e3-emerald mb-2">
            Settings for {entityName}
          </DialogTitle>
          <p className="text-sm text-e3-white/60">
            Override global booking and scheduling settings for this specific {entityType === 'team' ? 'client team' : 'team member'}.
          </p>
        </DialogHeader>

        <div className="mt-6 space-y-8 pb-8">
          <BookedAppointmentSettings 
            clientTeamId={entityType === 'team' ? entityId : undefined}
            teamMemberId={entityType === 'member' ? entityId : undefined}
          />
          <div className="h-px bg-e3-white/10 w-full" />
          <SchedulingWindowSettings 
            clientTeamId={entityType === 'team' ? entityId : undefined}
            teamMemberId={entityType === 'member' ? entityId : undefined}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EntitySettingsModal;