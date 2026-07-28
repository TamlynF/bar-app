import { findActiveEventClashes, type EventClashCandidate } from "./event-form-validation";
import { toMinutes, type OpeningHours } from "./opening-hours";
import { addDaysUTC, fromISODate, toISODate, ukBankHolidaysBetween } from "./uk-holidays";

export const BAND_SLOT_START_TIMES = ["20:00", "21:00"] as const;
export const BAND_SLOT_HOURS = 2;

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const PERFORMANCE_WEEKDAYS = new Set([5, 6]);

function addHoursToClock(time: string, hours: number): string {
  const minutes = (toMinutes(time) ?? 0) + hours * 60;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function slotWindow(start: string): { open: number; close: number } {
  const open = toMinutes(start) ?? 0;
  return { open, close: open + BAND_SLOT_HOURS * 60 };
}

function openWindowFor(hours: OpeningHours, weekday: number): { open: number; close: number } | null {
  const day = hours[DAY_KEYS[weekday]];
  const open = toMinutes(day?.open);
  const close = toMinutes(day?.close);
  if (open == null || close == null) return null;
  return { open, close: close <= open ? close + 1440 : close };
}

export function slotsWithinOpeningHours(
  hours: OpeningHours | null | undefined,
  weekday: number
): string[] {
  if (!hours) return [];
  const venue = openWindowFor(hours, weekday);
  if (!venue) return [];
  return BAND_SLOT_START_TIMES.filter((start) => {
    const slot = slotWindow(start);
    return slot.open >= venue.open && slot.close <= venue.close;
  });
}

export type BandAvailabilityInput = {
  from: string;
  to: string;
  openingHours: OpeningHours | null | undefined;
  events: EventClashCandidate[];
};

export function isPerformanceDate(iso: string, holidays: Set<string>): boolean {
  const weekday = fromISODate(iso).getUTCDay();
  if (PERFORMANCE_WEEKDAYS.has(weekday)) return true;
  if (holidays.has(iso)) return true;
  return holidays.has(toISODate(addDaysUTC(fromISODate(iso), 1)));
}

export function computeAvailableBandDates({
  from,
  to,
  openingHours,
  events,
}: BandAvailabilityInput): string[] {
  if (!openingHours || from > to) return [];

  const holidays = ukBankHolidaysBetween(from, toISODate(addDaysUTC(fromISODate(to), 1)));
  const available: string[] = [];

  for (let day = fromISODate(from); toISODate(day) <= to; day = addDaysUTC(day, 1)) {
    const iso = toISODate(day);
    if (!isPerformanceDate(iso, holidays)) continue;

    const slots = slotsWithinOpeningHours(openingHours, day.getUTCDay());
    if (slots.length === 0) continue;

    const free = slots.some(
      (start) =>
        findActiveEventClashes(
          { date: iso, start, end: addHoursToClock(start, BAND_SLOT_HOURS) },
          events
        ).length === 0
    );

    if (free) available.push(iso);
  }

  return available;
}
