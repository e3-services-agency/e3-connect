import { DateTime } from 'luxon';
import type { DayBusinessHours, WorkingHours } from '../hooks/useBusinessHours';

/**
 * RFC3339 instants for FullCalendar when using the Luxon plugin + named `timeZone`.
 * Always derive from zoned Luxon DateTimes — do not use `new Date(...).toISOString()` for grid events.
 */
export function zonedRangeToIso(start: DateTime, end: DateTime): { start: string; end: string } {
  return { start: start.toISO()!, end: end.toISO()! };
}

/** Each calendar day (start-of-day in `zone`) intersecting [viewStart, viewEndExclusive). */
export function enumerateZonedDaysInView(viewStart: Date, viewEndExclusive: Date, zone: string): DateTime[] {
  const endLast = DateTime.fromJSDate(viewEndExclusive, { zone }).minus({ milliseconds: 1 });
  let d = DateTime.fromJSDate(viewStart, { zone }).startOf('day');
  const lastDay = endLast.startOf('day');
  const out: DateTime[] = [];
  if (!d.isValid || !lastDay.isValid) return out;
  while (d <= lastDay) {
    out.push(d);
    d = d.plus({ days: 1 });
  }
  return out;
}

/**
 * Working hours for a wall date in `dayStart`'s zone, using DB weekday columns (Mon–Sun).
 * Avoids `Date#getDay()` in the browser TZ when `fcTimezone` differs from the device.
 */
export function workingHoursForZonedWeekday(
  dayStart: DateTime,
  businessHours: DayBusinessHours | null,
  fallback: (d: Date) => WorkingHours
): WorkingHours {
  if (!businessHours) return fallback(dayStart.toJSDate());
  const keys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const key = keys[dayStart.weekday - 1];
  return businessHours[key] as WorkingHours;
}

/** Split multi-day / overnight busy, clip to [slotMinHour, slotMaxHour) on each day in `zone`. */
export function splitBusySlotsForCalendar(
  startIso: string,
  endIso: string,
  zone: string,
  slotMinHour: number,
  slotMaxHour: number
): { start: string; end: string }[] {
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
        out.push(zonedRangeToIso(clipStart, clipEnd));
      }
    }
    segStart = nextMidnight;
  }

  return out;
}
