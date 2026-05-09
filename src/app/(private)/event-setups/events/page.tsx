import { createClient } from "@/lib/supabase/server";
import EventsClient from "./event-setups-client";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  const [{ data: events }, { data: eventTypes }, { data: employees }, { data: quizCategories }, { data: quizQuestions }, { data: bookings }] = await Promise.all([
    supabase.from("events").select("*").order("date", { ascending: false }),
    supabase.from("event_types").select("id, type, sub_type").order("id", { ascending: true }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
    supabase.from("quiz_category_configs").select("id, category_name, question_count, short_name, order_no").eq("is_active", true).order("order_no"),
    supabase.from("past_quiz_questions").select("id, events_id, quiz_category_configs_id").not("events_id", "is", null),
    supabase.from("bookings").select("id, event_id, status, group_size, group_name"),
  ]);

  return <EventsClient initialEvents={events ?? []} eventTypes={eventTypes ?? []} employees={employees ?? []} quizCategories={quizCategories ?? []} quizQuestions={quizQuestions ?? []} bookings={bookings ?? []} filter={filter} />;
}