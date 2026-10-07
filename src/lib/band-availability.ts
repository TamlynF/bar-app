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

const WEEKDAY_PLURALS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

export type BandDateRules = { weekdays: number[]; bankHolidays: boolean };

export const DEFAULT_BAND_DATE_RULES: BandDateRules = { weekdays: [5, 6], bankHolidays: true };

export function bandDateRules(row: {
  band_request_weekdays?: number[] | null;
  band_request_bank_holidays?: boolean | null;
} | null | undefined): BandDateRules {
  const weekdays = row?.band_request_weekdays;
  return {
    weekdays: Array.isArray(weekdays)
      ? [...new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
      : DEFAULT_BAND_DATE_RULES.weekdays,
    bankHolidays: row?.band_request_bank_holidays ?? DEFAULT_BAND_DATE_RULES.bankHolidays,
  };
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/* "Fridays, Saturdays and the night before a bank holiday" - the nights the
   public form offers, in the order a week reads (Monday first). */
export function describeBandNights(rules: BandDateRules): string {
  const weekNights = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => rules.weekdays.includes(d))
    .map((d) => WEEKDAY_PLURALS[d]);
  return joinWithAnd(rules.bankHolidays ? [...weekNights, "the night before a bank holiday"] : weekNights);
}

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

export type BandEvent = EventClashCandidate & { is_music?: boolean };

export type BandAvailabilityInput = {
  from: string;
  to: string;
  openingHours: OpeningHours | null | undefined;
  events: BandEvent[];
  rules?: BandDateRules;
};

export function isPerformanceDate(
  iso: string,
  holidays: Set<string>,
  rules: BandDateRules = DEFAULT_BAND_DATE_RULES
): boolean {
  if (rules.weekdays.includes(fromISODate(iso).getUTCDay())) return true;
  if (!rules.bankHolidays) return false;
  const nextDay = addDaysUTC(fromISODate(iso), 1);
  if (holidays.has(toISODate(nextDay))) return true;
  return holidays.has(iso) && nextDay.getUTCDay() === 6;
}

export function computeAvailableBandDates({
  from,
  to,
  openingHours,
  events,
  rules = DEFAULT_BAND_DATE_RULES,
}: BandAvailabilityInput): string[] {
  if (!openingHours || from > to) return [];

  const holidays = ukBankHolidaysBetween(from, toISODate(addDaysUTC(fromISODate(to), 1)));
  const musicNights = new Set(
    events.filter((e) => e.is_music && e.is_active !== false && e.date).map((e) => e.date)
  );
  const available: string[] = [];

  for (let day = fromISODate(from); toISODate(day) <= to; day = addDaysUTC(day, 1)) {
    const iso = toISODate(day);
    if (!isPerformanceDate(iso, holidays, rules)) continue;
    if (musicNights.has(iso)) continue;

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
