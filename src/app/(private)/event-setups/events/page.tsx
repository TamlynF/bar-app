import { createClient } from "@/lib/supabase/server";
import EventsClient from "./event-setups-client";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  const [{ data: events }, { data: eventTypes }, { data: eventSubtypes }, { data: employees }, { data: quizCategories }, { data: quizQuestions }, { data: bookings }] = await Promise.all([
    supabase.from("events").select("*").order("date", { ascending: false }),
    supabase.from("event_types").select("id, name, color, booking_grouping").order("name"),
    supabase.from("event_subtypes").select("id, event_types_id, name, color, default_event_title, tagline, behavior, host_required, seating_required, is_bookable, payment_required, default_payment_amount, default_booking_config").order("name"),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
    supabase.from("quiz_category_configs").select("id, category_name, question_count, short_name, order_no").eq("is_active", true).order("order_no"),
    supabase.from("past_quiz_questions").select("id, events_id, quiz_category_configs_id").not("events_id", "is", null),
    supabase.from("bookings").select("id, event_id, status, group_size, group_name"),
  ]);

  return <EventsClient initialEvents={events ?? []} eventTypes={eventTypes ?? []} eventSubtypes={eventSubtypes ?? []} employees={employees ?? []} quizCategories={quizCategories ?? []} quizQuestions={quizQuestions ?? []} bookings={bookings ?? []} filter={filter} />;
}