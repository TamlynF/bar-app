export type DayHours = { open?: string | null; close?: string | null };
export type OpeningHours = Partial<Record<string, DayHours>>;

export type OpenState = {
  isOpen: boolean;
  label: string;
};

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const VENUE_TIME_ZONE = "Europe/London";

export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hour = Number(h);
  const minute = Number(m ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function formatClock(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const ampm = hour24 >= 12 ? "pm" : "am";
  const hour = hour24 % 12 || 12;
  return minute === 0 ? `${hour}${ampm}` : `${hour}:${String(minute).padStart(2, "0")}${ampm}`;
}

export function venueNow(now: Date): { dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VENUE_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value.toLowerCase() ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dayIndex = DAY_KEYS.indexOf(weekday as (typeof DAY_KEYS)[number]);

  return { dayIndex: dayIndex === -1 ? 0 : dayIndex, minutes: hour * 60 + minute };
}

function sessionFor(hours: OpeningHours, dayIndex: number) {
  const day = hours[DAY_KEYS[((dayIndex % 7) + 7) % 7]];
  const open = toMinutes(day?.open);
  const close = toMinutes(day?.close);
  if (open == null || close == null) return null;
  return { open, close, isOvernight: close <= open };
}

type SessionState =
  | { kind: "open"; close: number }
  | { kind: "later-today"; open: number }
  | { kind: "later-day"; dayIndex: number; open: number };

function sessionState(hours: OpeningHours | null | undefined, now: Date): SessionState | null {
  if (!hours) return null;
  const { dayIndex, minutes } = venueNow(now);

  const yesterday = sessionFor(hours, dayIndex - 1);
  if (yesterday?.isOvernight && minutes < yesterday.close) {
    return { kind: "open", close: yesterday.close };
  }

  const today = sessionFor(hours, dayIndex);
  if (today) {
    const closesAt = today.isOvernight ? today.close + 1440 : today.close;
    if (minutes >= today.open && minutes < closesAt) return { kind: "open", close: today.close };
    if (minutes < today.open) return { kind: "later-today", open: today.open };
  }

  for (let ahead = 1; ahead <= 7; ahead++) {
    const next = sessionFor(hours, dayIndex + ahead);
    if (next) return { kind: "later-day", dayIndex: (dayIndex + ahead) % 7, open: next.open };
  }

  return null;
}

export function describeOpenState(
  hours: OpeningHours | null | undefined,
  now: Date
): OpenState | null {
  const state = sessionState(hours, now);
  if (!state) return null;
  if (state.kind === "open") return { isOpen: true, label: `Open now · til ${formatClock(state.close)}` };
  if (state.kind === "later-today") return { isOpen: false, label: `Opens ${formatClock(state.open)}` };
  return { isOpen: false, label: `Opens ${DAY_SHORT[state.dayIndex]} ${formatClock(state.open)}` };
}

export type BarStatus = OpenState & { shortLabel: string };

/* The top-bar pill: "Open until 2am", "Open today from 7pm" or
   "Open Thursday at 7pm", with a short form for the narrowest phones. */
export function describeBarStatus(
  hours: OpeningHours | null | undefined,
  now: Date
): BarStatus | null {
  const state = sessionState(hours, now);
  if (!state) return null;
  if (state.kind === "open") {
    const close = formatClock(state.close);
    return { isOpen: true, label: `Open until ${close}`, shortLabel: `Open til ${close}` };
  }
  const open = formatClock(state.open);
  if (state.kind === "later-today") {
    return { isOpen: false, label: `Open today from ${open}`, shortLabel: `Opens ${open}` };
  }
  return {
    isOpen: false,
    label: `Open ${DAY_LONG[state.dayIndex]} at ${open}`,
    shortLabel: `Opens ${DAY_SHORT[state.dayIndex]} ${open}`,
  };
}

const UK_POSTCODE = /\s+[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function shortLocation(address: string | null | undefined): string | null {
  if (!address) return null;
  const cleaned = address.replace(/\s+/g, " ").trim().replace(UK_POSTCODE, "");
  const parts = cleaned
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.slice(-2).join(", ");
}

const WEEK_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const WEEK_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function sessionLabel(day: DayHours | undefined): string | null {
  const open = toMinutes(day?.open);
  const close = toMinutes(day?.close);
  if (open == null || close == null) return null;
  return `${formatClock(open)}–${formatClock(close)}`;
}

/* "Mon–Thu 5pm–12am", "Fri–Sat 5pm–2am", "Sun 5pm–11pm": consecutive days
   with the same session collapse into one range; closed days are skipped. */
export function summariseOpeningHours(hours: OpeningHours | null | undefined): string[] {
  if (!hours) return [];
  const out: string[] = [];
  let runStart = -1;
  let runLabel: string | null = null;

  const flush = (end: number) => {
    if (runStart < 0 || !runLabel) return;
    const days = runStart === end ? WEEK_SHORT[runStart] : `${WEEK_SHORT[runStart]}–${WEEK_SHORT[end]}`;
    out.push(`${days} ${runLabel}`);
  };

  WEEK_ORDER.forEach((key, i) => {
    const label = sessionLabel(hours[key]);
    if (label && label === runLabel) return;
    flush(i - 1);
    runStart = label ? i : -1;
    runLabel = label;
  });
  flush(WEEK_ORDER.length - 1);
  return out;
}

export type OpenSessionClash = { dayIndex: number; open: number; close: number };

/* The public opening session that a private hire slot on `dateIso` would run
   into, if any. Times are minutes from midnight; an end at or before the start
   runs past midnight. The previous night's session counts too, so 1am on a
   Saturday clashes with Friday's 7pm–2am. */
export function openSessionClash(
  hours: OpeningHours | null | undefined,
  dateIso: string,
  start: number,
  end: number,
): OpenSessionClash | null {
  if (!hours) return null;
  const dayIndex = new Date(`${dateIso}T00:00:00`).getDay();
  if (Number.isNaN(dayIndex)) return null;
  const slotEnd = end <= start ? end + 1440 : end;

  for (const offset of [-1, 0, 1]) {
    const session = sessionFor(hours, dayIndex + offset);
    if (!session) continue;
    const sessionStart = offset * 1440 + session.open;
    const sessionEnd = offset * 1440 + session.close + (session.isOvernight ? 1440 : 0);
    if (start < sessionEnd && sessionStart < slotEnd) {
      return { dayIndex: (((dayIndex + offset) % 7) + 7) % 7, open: session.open, close: session.close };
    }
  }
  return null;
}

export function describeOpenSessionClash(clash: OpenSessionClash): string {
  return `The bar is open to the public on ${DAY_LONG[clash.dayIndex]}s from ${formatClock(clash.open)} to ${formatClock(clash.close)}, so private hire can't overlap those hours. Please pick a different date or time.`;
}
