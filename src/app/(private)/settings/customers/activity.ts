import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ContactBooking = {
  id: number;
  eventId: number | null;
  subtype: string;
  title: string;
  date: string | null;
  groupName: string | null;
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

type EventRow = { id: number; title: string | null; date: string | null; event_subtypes_id: number | null };
type SubtypeRow = { id: number; name: string | null; is_quiz: boolean | null };
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
  const [subtypes, events, bookings, scores, bands, hires] = await Promise.all([
    supabase.from("event_subtypes").select("id, name, is_quiz"),
    supabase.from("events").select("id, title, date, event_subtypes_id"),
    supabase.from("bookings").select("id, contact_id, group_name, status, event_id"),
    supabase.from("booking_scores").select("booking_id, is_winner"),
    supabase
      .from("band_booking_requests")
      .select(
        "id, email, contact_id, group_name, type, genre, status, created_at, selected_date, event_id",
      ),
    supabase
      .from("private_hire_requests")
      .select(
        "id, email, contact_id, reason_for_hire, reason, guest_count, status, created_at, selected_date, preferred_date, event_id, event_subtypes_id",
      ),
  ]);

  [subtypes, events, bookings, scores, bands, hires].forEach((result) => {
    if (result.error) console.error("Contact activity read failed:", result.error);
  });

  const subtypeById = new Map(
    ((subtypes.data as SubtypeRow[] | null) ?? []).map((s) => [s.id, s] as const),
  );
  const eventById = new Map(
    ((events.data as EventRow[] | null) ?? []).map((e) => [e.id, e] as const),
  );
  const winners = new Set(
    ((scores.data as ScoreRow[] | null) ?? []).filter((s) => s.is_winner).map((s) => s.booking_id),
  );

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

  ((bookings.data as BookingRow[] | null) ?? []).forEach((row) => {
    if (row.contact_id == null) return;
    const subtype = subtypeOf(row.event_id);
    bucket(map, row.contact_id).bookings.push({
      id: row.id,
      eventId: row.event_id,
      subtype: subtype?.name?.trim() || "Other",
      title: eventTitle(row.event_id),
      date: eventDate(row.event_id),
      groupName: row.group_name,
      status: row.status?.trim() || "confirmed",
      isQuiz: !!subtype?.is_quiz,
      isWinner: winners.has(row.id),
    });
  });

  ((bands.data as BandRow[] | null) ?? []).forEach((row) => {
    const contactId = ownerOf(row);
    if (contactId == null) return;
    bucket(map, contactId).bandRequests.push({
      id: row.id,
      eventId: row.event_id,
      actName: row.group_name?.trim() || "Unnamed act",
      type: row.type?.trim() || "Act",
      genre: row.genre?.trim() || "Unspecified",
      title: eventTitle(row.event_id),
      date: eventDate(row.event_id) ?? row.selected_date ?? row.created_at,
      status: row.status?.trim() || "new",
    });
  });

  ((hires.data as HireRow[] | null) ?? []).forEach((row) => {
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
      date: eventDate(row.event_id) ?? row.selected_date ?? row.preferred_date ?? row.created_at,
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
