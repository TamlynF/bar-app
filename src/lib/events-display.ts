import { swatchHexFromColor } from "@/lib/event-type-colors";
import { isEventBehavior, type EventBehavior } from "@/lib/event-behavior";


export type TypeJoin = { name: string; color: string | null };
export type SubtypeJoin = {
  name: string;
  color: string | null;
  behavior: string | null;
  tagline?: string | null;
};

export type EventTypeJoin = {
  type: string | null;
  sub_type: string | null;
  badge_color: string | null;
  behavior: EventBehavior;
  tagline: string | null;
};

export type EventRow = {
  id: number;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  is_fully_booked: boolean;
  is_bookable: boolean;
  external_link: string | null;
  booking_page_url: string | null;
  karaoke_request_url: string | null;
  tagline?: string | null;
  image_url?: string | null;
  payment_amount?: number | null;
  event_types: TypeJoin | TypeJoin[];
  event_subtypes: SubtypeJoin | SubtypeJoin[];
};

export function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

export function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const minute = m ?? "00";
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute}${ampm}`;
}

export function getEventType(event: EventRow): EventTypeJoin | null {
  const t = Array.isArray(event.event_types) ? event.event_types[0] : event.event_types;
  const s = Array.isArray(event.event_subtypes) ? event.event_subtypes[0] : event.event_subtypes;
  if (!t && !s) return null;
  return {
    type: t?.name ?? null,
    sub_type: s?.name ?? null,
    badge_color: s?.color ?? null,
    behavior: isEventBehavior(s?.behavior) ? s.behavior : "standard",
    tagline: s?.tagline ?? null,
  };
}

export function brightenForDark(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);

  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const TARGET = 165;

  if (lum >= TARGET) return hex;

  const t = Math.min(0.7, (TARGET - lum) / 255 + 0.25);
  r = Math.round(r + (255 - r) * t);
  g = Math.round(g + (255 - g) * t);
  b = Math.round(b + (255 - b) * t);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function eventBadgeColor(event: EventRow): string {
  const et = getEventType(event);
  const base = swatchHexFromColor(et?.badge_color) ?? "#FDCC4B";
  return brightenForDark(base);
}

export type BandInfo = {
  socialLinks: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  };
  videos: { url: string; description: string }[];
};

export type SerializedEvent = {
  id: number;
  title: string;
  date: string;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  externalLink: string | null;
  isFullyBooked: boolean;
  isBookable: boolean;
  bookingPageUrl: string | null;
  color: string;
  subType: string | null;
  tagline: string | null;
  imageUrl: string | null;
  price: number | null;
  isKaraoke: boolean;
  karaokeRequestUrl: string | null;
  behavior: EventBehavior;
  band: BandInfo | null;
};

export function serializeEvent(e: EventRow, band: BandInfo | null = null): SerializedEvent {
  const et = getEventType(e);
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    startTimeLabel: formatTime(e.start_time),
    endTimeLabel: formatTime(e.end_time),
    externalLink: e.external_link,
    isFullyBooked: e.is_fully_booked,
    isBookable: e.is_bookable ?? false,
    bookingPageUrl: e.booking_page_url ?? null,
    color: eventBadgeColor(e),
    subType: et?.sub_type ?? null,
    tagline: e.tagline ?? et?.tagline ?? null,
    imageUrl: e.image_url ?? null,
    price: e.payment_amount ?? null,
    isKaraoke: et?.behavior === "karaoke",
    karaokeRequestUrl: e.karaoke_request_url ?? null,
    behavior: et?.behavior ?? "standard",
    band,
  };
}
