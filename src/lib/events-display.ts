import { swatchHexFromColor } from "@/lib/event-type-colors";
import { isEventBehavior, type EventBehavior } from "@/lib/event-behavior";
import { resolveEventImage } from "@/lib/event-image";


export type TypeJoin = { name: string; color: string | null };
export type SubtypeJoin = {
  name: string;
  color: string | null;
  behavior: string | null;
  tagline?: string | null;
  default_image_url?: string | null;
};

export type ActCoverJoin = {
  music_acts: { cover_image_url: string | null } | { cover_image_url: string | null }[] | null;
};

export type EventTypeJoin = {
  type: string | null;
  sub_type: string | null;
  badge_color: string | null;
  behavior: EventBehavior;
  tagline: string | null;
  default_image_url: string | null;
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
  seating_required?: boolean | null;
  tagline?: string | null;
  image_url?: string | null;
  payment_amount?: number | null;
  event_types: TypeJoin | TypeJoin[];
  event_subtypes: SubtypeJoin | SubtypeJoin[];
  band_booking_requests?: ActCoverJoin[] | null;
};

export const PUBLIC_EVENT_SELECT =
  "id, title, date, start_time, end_time, tagline, image_url, is_active, is_fully_booked, is_bookable, seating_required, payment_amount, external_link, booking_page_url, karaoke_request_url, event_types!inner(name, color), event_subtypes!inner(name, color, behavior, tagline, default_image_url), band_booking_requests!band_booking_requests_event_id_fkey(music_acts(cover_image_url))" as const;

export const BOOKED_BAND_FILTER = "band_booking_requests.status";

export function actCoverFromRow(event: EventRow): string | null {
  for (const request of event.band_booking_requests ?? []) {
    const act = Array.isArray(request.music_acts)
      ? request.music_acts[0]
      : request.music_acts;
    if (act?.cover_image_url) return act.cover_image_url;
  }
  return null;
}

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
    default_image_url: s?.default_image_url ?? null,
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
  requiresSeating: boolean;
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

export function formatGBP(n: number): string {
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}

export function priceLabel(event: SerializedEvent): string | null {
  if (event.isFullyBooked || event.price == null) return null;
  return event.price > 0 ? formatGBP(event.price) : "FREE";
}

export function entryText(event: SerializedEvent): string {
  if (event.isFullyBooked) return "Sold out";
  if (event.price != null && event.price > 0) return `${formatGBP(event.price)} entry`;
  if (event.isKaraoke)
    return event.karaokeRequestUrl ? "Karaoke · requests open" : "Karaoke night";
  if (event.externalLink) return "Tickets via link";
  return "Free entry · walk in";
}

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
    requiresSeating: e.seating_required ?? true,
    bookingPageUrl: e.booking_page_url ?? null,
    color: eventBadgeColor(e),
    subType: et?.sub_type ?? null,
    tagline: e.tagline ?? et?.tagline ?? null,
    imageUrl: resolveEventImage({
      eventImageUrl: e.image_url,
      actCoverUrl: actCoverFromRow(e),
      subtypeDefaultUrl: et?.default_image_url,
    }).url,
    price: e.payment_amount ?? null,
    isKaraoke: et?.behavior === "karaoke",
    karaokeRequestUrl: e.karaoke_request_url ?? null,
    behavior: et?.behavior ?? "standard",
    band,
  };
}
