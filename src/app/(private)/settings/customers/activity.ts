import type { createClient } from "@/lib/supabase/server";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";
import { resolveOwningBookingConfig } from "@/lib/resolve-booking-config";
import type { BookingGrouping } from "@/lib/booking-grouping";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ContactBooking = {
  id: number;
  eventId: number | null;
  subtype: string;
  title: string;
  date: string | null;
  groupName: string | null;
  // False when the booking form never asked for a group name, in which case the
  // column is holding the booker's own name.
  collectsGroupName: boolean;
  status: string;
  isQuiz: boolean;
  isWinner: boolean;
};

export type ContactBandRequest = {
  id: string;
  eventId: number | null;
  actName: string;
  type: string;
  genre: string;
  title: string;
  date: string | null;
  status: string;
};

export type ContactPrivateHire = {
  id: string;
  eventId: number | null;
  subtype: string;
  title: string;
  reason: string;
  date: string | null;
  guests: number;
  status: string;
};

export type ContactActivity = {
  bookings: ContactBooking[];
  bandRequests: ContactBandRequest[];
  privateHires: ContactPrivateHire[];
};

export type ActivityByContact = Record<number, ContactActivity>;

export function emptyActivity(): ContactActivity {
  return { bookings: [], bandRequests: [], privateHires: [] };
}

export function activityTotal(activity: ContactActivity): number {
  return activity.bookings.length + activity.bandRequests.length + activity.privateHires.length;
}

type EventRow = {
  id: number;
  title: string | null;
  date: string | null;
  event_subtypes_id: number | null;
  event_types_id: number | null;
  booking_config: BookingConfig | null;
};
type SubtypeRow = {
  id: number;
  name: string | null;
  behavior: string | null;
  booking_config: BookingConfig | null;
};
type TypeRow = {
  id: number;
  booking_grouping: string | null;
  booking_config: BookingConfig | null;
};

// PostgREST answers with at most 1000 rows, so a single select quietly returns a
// slice of a busy venue's history. Every read here pages to the end.
const PAGE_SIZE = 1000;

type PageQuery = PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function fetchAll<T>(
  label: string,
  page: (from: number, to: number) => PageQuery,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`Contact activity: reading ${label} failed:`, error);
      break;
    }
    const batch = (data as T[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

// Private hires and music acts already have their own sections; counting their
// events under Bookings as well would say the same thing twice.
function belongsInBookings(subtype?: SubtypeRow): boolean {
  return subtype?.behavior !== "private" && subtype?.behavior !== "music_act";
}
type BookingRow = {
  id: number;
  contact_id: number | null;
  group_name: string | null;
  status: string | null;
  event_id: number | null;
};
type ScoreRow = { booking_id: number; is_winner: boolean | null };
type BandRow = {
  id: string;
  email: string | null;
  contact_id: number | null;
  group_name: string | null;
  type: string | null;
  genre: string | null;
  status: string | null;
  created_at: string;
  selected_date: string | null;
  event_id: number | null;
};
type HireRow = {
  id: string;
  email: string | null;
  contact_id: number | null;
  reason_for_hire: string | null;
  reason: string | null;
  guest_count: number | null;
  status: string | null;
  created_at: string;
  selected_date: string | null;
  preferred_date: string | null;
  event_id: number | null;
  event_subtypes_id: number | null;
};

function bucket(map: ActivityByContact, contactId: number): ContactActivity {
  if (!map[contactId]) map[contactId] = emptyActivity();
  return map[contactId];
}

// Oldest first, so a customer's history reads as a story. Undated rows trail.
function byDateAscending(a: { date: string | null }, z: { date: string | null }): number {
  if (!a.date) return 1;
  if (!z.date) return -1;
  return a.date.localeCompare(z.date);
}

export async function readContactActivity(
  supabase: ServerClient,
  contacts: { id: number; email: string }[],
): Promise<ActivityByContact> {
  const byEmail = new Map<string, number>();
  contacts.forEach((c) => {
    if (c.email) byEmail.set(c.email.trim().toLowerCase(), c.id);
  });

  // Read flat and join here. `events` sits on both sides of `bookings` -
  // bookings.event_id points at it and events.booking_id points back - so an
  // embedded select is ambiguous and fails for the whole table.
  const [subtypeRows, typeRows, eventRows, bookingRows, scoreRows, bandRows, hireRows] =
    await Promise.all([
    fetchAll<SubtypeRow>("event subtypes", (from, to) =>
      supabase
        .from("event_subtypes")
        .select("id, name, behavior, booking_config")
        .range(from, to),
    ),
    fetchAll<TypeRow>("event types", (from, to) =>
      supabase.from("event_types").select("id, booking_grouping, booking_config").range(from, to),
    ),
    fetchAll<EventRow>("events", (from, to) =>
      supabase
        .from("events")
        .select("id, title, date, event_subtypes_id, event_types_id, booking_config")
        .range(from, to),
    ),
    fetchAll<BookingRow>("bookings", (from, to) =>
      supabase
        .from("bookings")
        .select("id, contact_id, group_name, status, event_id")
        .range(from, to),
    ),
    fetchAll<ScoreRow>("booking scores", (from, to) =>
      supabase.from("booking_scores").select("booking_id, is_winner").range(from, to),
    ),
    fetchAll<BandRow>("band requests", (from, to) =>
      supabase
        .from("band_booking_requests")
        .select(
          "id, email, contact_id, group_name, type, genre, status, created_at, selected_date, event_id",
        )
        .range(from, to),
    ),
    fetchAll<HireRow>("private hire requests", (from, to) =>
      supabase
        .from("private_hire_requests")
        .select(
          "id, email, contact_id, reason_for_hire, reason, guest_count, status, created_at, selected_date, preferred_date, event_id, event_subtypes_id",
        )
        .range(from, to),
    ),
  ]);

  const subtypeById = new Map(subtypeRows.map((s) => [s.id, s] as const));
  const typeById = new Map(typeRows.map((t) => [t.id, t] as const));
  const eventById = new Map(eventRows.map((e) => [e.id, e] as const));
  const winners = new Set(scoreRows.filter((s) => s.is_winner).map((s) => s.booking_id));

  // Which config owns the form depends on the type's grouping, so the answer to
  // "did this booking ask for a group name" has to be resolved per event.
  const collectsGroupName = (eventId: number | null): boolean => {
    const event = eventId != null ? eventById.get(eventId) : undefined;
    if (!event) return true;
    const type = event.event_types_id != null ? typeById.get(event.event_types_id) : undefined;
    const subtype =
      event.event_subtypes_id != null ? subtypeById.get(event.event_subtypes_id) : undefined;
    const owning = resolveOwningBookingConfig({
      grouping: (type?.booking_grouping ?? null) as BookingGrouping | null,
      eventConfig: event.booking_config,
      typeConfig: type?.booking_config,
      subtypeConfig: subtype?.booking_config,
    });
    return normalizeBookingConfig(owning).fields.group_name.visible;
  };

  const eventTitle = (eventId: number | null) =>
    (eventId != null ? eventById.get(eventId)?.title?.trim() : "") || "No event yet";
  const eventDate = (eventId: number | null) =>
    (eventId != null ? eventById.get(eventId)?.date : null) ?? null;
  const subtypeOf = (eventId: number | null) =>
    eventId != null
      ? subtypeById.get(eventById.get(eventId)?.event_subtypes_id ?? -1)
      : undefined;

  const map: ActivityByContact = {};

  // The id is the link; the address is only a fallback for rows written before
  // the column existed.
  const ownerOf = (row: { contact_id: number | null; email: string | null }) =>
    row.contact_id ?? byEmail.get((row.email ?? "").trim().toLowerCase()) ?? null;

  bookingRows.forEach((row) => {
    if (row.contact_id == null) return;
    const subtype = subtypeOf(row.event_id);
    if (!belongsInBookings(subtype)) return;
    bucket(map, row.contact_id).bookings.push({
      id: row.id,
      eventId: row.event_id,
      subtype: subtype?.name?.trim() || "Other",
      title: eventTitle(row.event_id),
      date: eventDate(row.event_id),
      groupName: row.group_name,
      collectsGroupName: collectsGroupName(row.event_id),
      status: row.status?.trim() || "confirmed",
      isQuiz: subtype?.behavior === "quiz",
      isWinner: winners.has(row.id),
    });
  });

  bandRows.forEach((row) => {
    const contactId = ownerOf(row);
    if (contactId == null) return;
    bucket(map, contactId).bandRequests.push({
      id: row.id,
      eventId: row.event_id,
      actName: row.group_name?.trim() || "Unnamed act",
      type: row.type?.trim() || "Act",
      genre: row.genre?.trim() || "Unspecified",
      title: eventTitle(row.event_id),
      // Only the date the venue actually settled on. A request still under
      // review has none, and says so rather than borrowing another date.
      date: row.selected_date,
      status: row.status?.trim() || "new",
    });
  });

  hireRows.forEach((row) => {
    const contactId = ownerOf(row);
    if (contactId == null) return;
    const subtype =
      subtypeById.get(row.event_subtypes_id ?? -1) ?? subtypeOf(row.event_id) ?? undefined;
    bucket(map, contactId).privateHires.push({
      id: row.id,
      eventId: row.event_id,
      subtype: subtype?.name?.trim() || "Private hire",
      title: eventTitle(row.event_id),
      reason: row.reason_for_hire?.trim() || row.reason?.trim() || "Not given",
      date: row.selected_date,
      guests: row.guest_count ?? 0,
      status: row.status?.trim() || "pending_review",
    });
  });

  Object.values(map).forEach((activity) => {
    activity.bookings.sort(byDateAscending);
    activity.bandRequests.sort(byDateAscending);
    activity.privateHires.sort(byDateAscending);
  });

  return map;
}
