import { createClient } from "@/lib/supabase/server";
import { getVenueMaxCapacity } from "@/lib/update-fully-booked";
import { loadEmailVersions } from "@/lib/email/booking-email-choice";
import { coverUrlFromJoin } from "@/lib/act-images";
import EventsClient, { type LinkedRequest } from "./event-setups-client";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; from?: string; to?: string; quick?: string }>;
}) {
  const { filter, from, to, quick } = await searchParams;
  const supabase = await createClient();

  const [{ data: events }, { data: eventTypes }, { data: eventSubtypes }, { data: employees }, { data: quizCategories }, { data: quizQuestions }, { data: bookings }, { data: actCovers }, { data: bandLinks }, { data: privateLinks }, { data: winnerRows }, emailVersions] = await Promise.all([
    supabase.from("events").select("*").order("date", { ascending: false }),
    supabase.from("event_types").select("id, name, color, booking_grouping, is_bookable, booking_config, booking_emails").order("name"),
    supabase.from("event_subtypes").select("id, event_types_id, name, color, default_event_title, tagline, behavior, host_required, seating_required, is_bookable, payment_required, default_payment_amount, booking_config, booking_emails, default_image_url").order("name"),
    supabase.from("employees").select("id, full_name, status").order("full_name", { ascending: true }),
    supabase.from("quiz_category_configs").select("id, category_name, question_count, short_name, order_no").eq("is_active", true).order("order_no"),
    supabase.from("past_quiz_questions").select("id, events_id, quiz_category_configs_id").not("events_id", "is", null),
    supabase.from("bookings").select("id, event_id, status, group_size, group_name"),
    supabase
      .from("band_booking_requests")
      .select("event_id, cover_image:music_act_images!band_booking_requests_cover_image_id_fkey(url), music_acts(cover_image:music_act_images!music_acts_cover_image_id_fkey(url))")
      .eq("status", "booked")
      .not("event_id", "is", null)
      .order("created_at", { ascending: true }),
    supabase.from("band_booking_requests").select("id, event_id").not("event_id", "is", null),
    supabase.from("private_hire_requests").select("id, event_id").not("event_id", "is", null),
    supabase.from("booking_scores").select("booking_id, event_id").eq("is_winner", true),
    loadEmailVersions(supabase),
  ]);

  const [venueCapacity, { count: tableCount }] = await Promise.all([
    getVenueMaxCapacity(supabase),
    supabase.from("tables").select("id", { count: "exact", head: true }).eq("available", true),
  ]);

  const actCoverByEvent: Record<number, string> = {};
  for (const row of actCovers ?? []) {
    const act = Array.isArray(row.music_acts) ? row.music_acts[0] : row.music_acts;
    const url = coverUrlFromJoin(row.cover_image) ?? coverUrlFromJoin(act?.cover_image);
    if (row.event_id != null && url && !actCoverByEvent[row.event_id]) {
      actCoverByEvent[row.event_id] = url;
    }
  }

  const winnerByEvent: Record<number, number> = {};
  for (const row of winnerRows ?? []) {
    if (row.event_id != null && row.booking_id != null) winnerByEvent[row.event_id] = row.booking_id;
  }

  const linkedRequestByEvent: Record<number, LinkedRequest> = {};
  for (const row of bandLinks ?? []) {
    if (row.event_id != null) linkedRequestByEvent[row.event_id] = { kind: "band", id: row.id };
  }
  for (const row of privateLinks ?? []) {
    if (row.event_id != null) linkedRequestByEvent[row.event_id] = { kind: "private", id: row.id };
  }

  return <EventsClient initialEvents={events ?? []} eventTypes={eventTypes ?? []} eventSubtypes={eventSubtypes ?? []} employees={employees ?? []} quizCategories={quizCategories ?? []} quizQuestions={quizQuestions ?? []} bookings={bookings ?? []} actCoverByEvent={actCoverByEvent} linkedRequestByEvent={linkedRequestByEvent} winnerByEvent={winnerByEvent} venueCapacity={venueCapacity} tableCount={tableCount ?? 0} emailVersions={emailVersions} filter={filter} initialFrom={from} initialTo={to} initialQuick={quick} />;
}