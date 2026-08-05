import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ContactBooking = {
  id: number;
  subtype: string;
  title: string;
  date: string | null;
  groupName: string | null;
  isQuiz: boolean;
  isWinner: boolean;
};

export type ContactBandRequest = {
  id: string;
  type: string;
  genre: string;
  date: string | null;
  status: string;
};

export type ContactPrivateHire = {
  id: string;
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

// `events` sits on both sides of `bookings` - bookings.event_id points at it and
// events.booking_id points back - so the relationship has to be named or
// PostgREST cannot tell which one is meant.
const BOOKING_SELECT =
  "id, contact_id, group_name, created_at, events!bookings_event_id_fkey(title, date, event_subtypes(name, is_quiz)), booking_scores(is_winner)";

type Nested<T> = T | T[] | null;

function first<T>(value: Nested<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type BookingRow = {
  id: number;
  contact_id: number | null;
  group_name: string | null;
  events: Nested<{
    title: string | null;
    date: string | null;
    event_subtypes: Nested<{ name: string | null; is_quiz: boolean | null }>;
  }>;
  booking_scores: { is_winner: boolean | null }[] | null;
};

type BandRow = {
  id: string;
  email: string | null;
  contact_id: number | null;
  type: string | null;
  genre: string | null;
  status: string | null;
  created_at: string;
  selected_date: string | null;
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
};

function bucket(map: ActivityByContact, contactId: number): ContactActivity {
  if (!map[contactId]) map[contactId] = emptyActivity();
  return map[contactId];
}

export async function readContactActivity(
  supabase: ServerClient,
  contacts: { id: number; email: string }[],
): Promise<ActivityByContact> {
  const byEmail = new Map<string, number>();
  contacts.forEach((c) => {
    if (c.email) byEmail.set(c.email.trim().toLowerCase(), c.id);
  });

  const [{ data: bookings }, { data: bands }, { data: hires }] = await Promise.all([
    supabase.from("bookings").select(BOOKING_SELECT),
    supabase
      .from("band_booking_requests")
      .select("id, email, contact_id, type, genre, status, created_at, selected_date"),
    supabase
      .from("private_hire_requests")
      .select(
        "id, email, contact_id, reason_for_hire, reason, guest_count, status, created_at, selected_date, preferred_date",
      ),
  ]);

  const map: ActivityByContact = {};

  // The id is the link; the address is only a fallback for rows written before
  // the column existed.
  const ownerOf = (row: { contact_id: number | null; email: string | null }) =>
    row.contact_id ?? byEmail.get((row.email ?? "").trim().toLowerCase()) ?? null;

  ((bookings as BookingRow[] | null) ?? []).forEach((row) => {
    if (row.contact_id == null) return;
    const event = first(row.events);
    const subtype = first(event?.event_subtypes ?? null);
    bucket(map, row.contact_id).bookings.push({
      id: row.id,
      subtype: subtype?.name?.trim() || "Other",
      title: event?.title?.trim() || "Untitled event",
      date: event?.date ?? null,
      groupName: row.group_name,
      isQuiz: !!subtype?.is_quiz,
      isWinner: (row.booking_scores ?? []).some((s) => s.is_winner),
    });
  });

  ((bands as BandRow[] | null) ?? []).forEach((row) => {
    const contactId = ownerOf(row);
    if (contactId == null) return;
    bucket(map, contactId).bandRequests.push({
      id: row.id,
      type: row.type?.trim() || "Act",
      genre: row.genre?.trim() || "Unspecified",
      date: row.selected_date ?? row.created_at,
      status: row.status?.trim() || "new",
    });
  });

  ((hires as HireRow[] | null) ?? []).forEach((row) => {
    const contactId = ownerOf(row);
    if (contactId == null) return;
    bucket(map, contactId).privateHires.push({
      id: row.id,
      reason: row.reason_for_hire?.trim() || row.reason?.trim() || "Not given",
      date: row.selected_date ?? row.preferred_date ?? row.created_at,
      guests: row.guest_count ?? 0,
      status: row.status?.trim() || "pending_review",
    });
  });

  return map;
}
