export type DayHours = { open?: string; close?: string };
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

export function describeOpenState(
  hours: OpeningHours | null | undefined,
  now: Date
): OpenState | null {
  if (!hours) return null;
  const { dayIndex, minutes } = venueNow(now);

  const yesterday = sessionFor(hours, dayIndex - 1);
  if (yesterday?.isOvernight && minutes < yesterday.close) {
    return { isOpen: true, label: `Open now · til ${formatClock(yesterday.close)}` };
  }

  const today = sessionFor(hours, dayIndex);
  if (today) {
    const closesAt = today.isOvernight ? today.close + 1440 : today.close;
    if (minutes >= today.open && minutes < closesAt) {
      return { isOpen: true, label: `Open now · til ${formatClock(today.close)}` };
    }
    if (minutes < today.open) {
      return { isOpen: false, label: `Opens ${formatClock(today.open)}` };
    }
  }

  for (let ahead = 1; ahead <= 7; ahead++) {
    const next = sessionFor(hours, dayIndex + ahead);
    if (!next) continue;
    const label = DAY_SHORT[(dayIndex + ahead) % 7];
    return { isOpen: false, label: `Opens ${label} ${formatClock(next.open)}` };
  }

  return null;
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
