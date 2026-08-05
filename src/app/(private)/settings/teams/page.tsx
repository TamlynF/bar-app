import { createClient } from "@/lib/supabase/server";
import TeamsClient, { type RawQuizBooking } from "./teams-client";

// PostgREST answers with at most 1000 rows, so a single select quietly returns a
// slice of a busy venue's quiz history.
const PAGE_SIZE = 1000;

const BOOKING_SELECT = `
  id,
  group_name,
  contact_id,
  status,
  created_at,
  contacts!bookings_contact_id_fkey (
    id,
    full_name,
    email
  ),
  events!bookings_event_id_fkey!inner (
    id,
    title,
    date,
    event_subtypes!inner ( behavior )
  ),
  booking_scores (
    id,
    score,
    is_winner
  )
`;

export default async function TeamsPage() {
  const supabase = await createClient();

  const bookings: RawQuizBooking[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("events.event_subtypes.behavior", "quiz")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching quiz bookings:", error.message, error);
      break;
    }

    const batch = (data as unknown as RawQuizBooking[] | null) ?? [];
    bookings.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return <TeamsClient initialBookings={bookings} />;
}
