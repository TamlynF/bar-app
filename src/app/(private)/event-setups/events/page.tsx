import { createClient } from "@/lib/supabase/server";
import { getVenueMaxCapacity } from "@/lib/update-fully-booked";
import EventsClient, { type LinkedRequest } from "./event-setups-client";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; from?: string; to?: string; quick?: string }>;
}) {
  const { filter, from, to, quick } = await searchParams;
  const supabase = await createClient();

  const [{ data: events }, { data: eventTypes }, { data: eventSubtypes }, { data: employees }, { data: quizCategories }, { data: quizQuestions }, { data: bookings }, { data: actCovers }, { data: bandLinks }, { data: privateLinks }] = await Promise.all([
    supabase.from("events").select("*").order("date", { ascending: false }),
    supabase.from("event_types").select("id, name, color, booking_grouping, is_bookable, booking_config").order("name"),
    supabase.from("event_subtypes").select("id, event_types_id, name, color, default_event_title, tagline, behavior, host_required, seating_required, is_bookable, payment_required, default_payment_amount, booking_config, default_image_url").order("name"),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
    supabase.from("quiz_category_configs").select("id, category_name, question_count, short_name, order_no").eq("is_active", true).order("order_no"),
    supabase.from("past_quiz_questions").select("id, events_id, quiz_category_configs_id").not("events_id", "is", null),
    supabase.from("bookings").select("id, event_id, status, group_size, group_name"),
    supabase
      .from("band_booking_requests")
      .select("event_id, music_acts(cover_image_url)")
      .eq("status", "booked")
      .not("event_id", "is", null)
      .order("created_at", { ascending: true }),
    supabase.from("band_booking_requests").select("id, event_id").not("event_id", "is", null),
    supabase.from("private_hire_requests").select("id, event_id").not("event_id", "is", null),
  ]);

  const venueCapacity = await getVenueMaxCapacity(supabase);

  const actCoverByEvent: Record<number, string> = {};
  for (const row of actCovers ?? []) {
    const act = Array.isArray(row.music_acts) ? row.music_acts[0] : row.music_acts;
    if (row.event_id != null && act?.cover_image_url && !actCoverByEvent[row.event_id]) {
      actCoverByEvent[row.event_id] = act.cover_image_url;
    }
  }

  const linkedRequestByEvent: Record<number, LinkedRequest> = {};
  for (const row of bandLinks ?? []) {
    if (row.event_id != null) linkedRequestByEvent[row.event_id] = { kind: "band", id: row.id };
  }
  for (const row of privateLinks ?? []) {
    if (row.event_id != null) linkedRequestByEvent[row.event_id] = { kind: "private", id: row.id };
  }

  return <EventsClient initialEvents={events ?? []} eventTypes={eventTypes ?? []} eventSubtypes={eventSubtypes ?? []} employees={employees ?? []} quizCategories={quizCategories ?? []} quizQuestions={quizQuestions ?? []} bookings={bookings ?? []} actCoverByEvent={actCoverByEvent} linkedRequestByEvent={linkedRequestByEvent} venueCapacity={venueCapacity} filter={filter} initialFrom={from} initialTo={to} initialQuick={quick} />;
}