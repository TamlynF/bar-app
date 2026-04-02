import { createClient } from "@/lib/supabase/server";
import EventsClient from "./events-client";

export default async function EventsPage() {
  const supabase = await createClient();

  const [{ data: events }, { data: eventTypes }, { data: employees }] = await Promise.all([
    supabase.from("events").select("*").order("date", { ascending: false }),
    supabase.from("event_types").select("id, type, sub_type").order("id", { ascending: true }),
    supabase.from("employees").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  return <EventsClient initialEvents={events ?? []} eventTypes={eventTypes ?? []} employees={employees ?? []} />;
}