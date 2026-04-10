import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import type { AppState } from '../../types/scheduling';

/** Resolved entity from `resolve_booking_slug` RPC (team or member). */
export interface EmbedHostEntity {
  type?: string;
  id?: string;
  name?: string;
  description?: string;
  google_photo_url?: string;
  email?: string;
}

interface EmbedHostPanelProps {
  host: EmbedHostEntity | null;
  appState: AppState;
  variant: 'schedule' | 'details';
  onChangeTime?: () => void;
}

const EmbedHostPanel: React.FC<EmbedHostPanelProps> = ({
  host,
  appState,
  variant,
  onChangeTime,
}) => {
  const isMember = host?.type === 'member' || appState.isIndividualBooking;
  const displayName = isMember
    ? appState.individualMember?.name || host?.name
    : host?.name;
  const title = isMember
    ? `Talk to ${displayName || 'E3'}`
    : appState.bookingTitle || displayName || 'Schedule a meeting';
  const photoUrl = isMember
    ? appState.individualMember?.google_photo_url || host?.google_photo_url
    : undefined;
  const description =
    (host?.description as string | undefined)?.trim() ||
    (isMember
      ? 'Pick a time that works for you. We will send a calendar invite with a video link.'
      : 'Select a time for your session with our team.');

  const initials = (displayName || 'E3')
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const userTz = appState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const timeSummary =
    appState.selectedTime && appState.selectedDate ? (
      <div className="mt-6 rounded-lg border border-e3-white/15 bg-e3-space-blue/40 p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 text-e3-emerald font-semibold">
          <Calendar className="h-4 w-4" />
          Selected time
        </div>
        <p className="text-e3-white/90">
          {new Date(appState.selectedTime).toLocaleString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: userTz,
          })}
        </p>
        <p className="mt-1 text-e3-white/50 text-xs">
          <Clock className="mr-1 inline h-3 w-3" />
          {appState.duration || 30} min · {userTz}
        </p>
        {variant === 'details' && onChangeTime && (
          <button
            type="button"
            onClick={onChangeTime}
            className="mt-3 text-sm font-medium text-e3-azure hover:underline"
          >
            Change time
          </button>
        )}
      </div>
    ) : null;

  return (
    <div className="flex h-full min-h-[200px] flex-col">
      <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={displayName || ''}
            className="mb-4 h-24 w-24 rounded-full border-2 border-e3-emerald/50 object-cover sm:h-28 sm:w-28"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border-2 border-e3-azure/40 bg-e3-azure/15 text-xl font-bold text-e3-azure sm:h-28 sm:w-28">
            {initials}
          </div>
        )}
        <h1 className="text-xl font-bold leading-tight text-e3-white sm:text-2xl">{title}</h1>
        {displayName && !isMember && (
          <p className="mt-1 text-e3-white/70">{displayName}</p>
        )}
        <p className="mt-3 max-w-md text-sm leading-relaxed text-e3-white/65">{description}</p>
      </div>
      {variant === 'details' && timeSummary}
    </div>
  );
};

export default EmbedHostPanel;
