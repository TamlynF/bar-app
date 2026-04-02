import { createClient } from "@/lib/supabase/server";
import EventsClient from "./events-client";

export default async function EventsPage() {
  const supabase = await createClient();

  const [{ data: events }, { data: eventTypes }] = await Promise.all([
    supabase.from("events").select("*").order("date", { ascending: true }),
    supabase.from("event_types").select("id, type, sub_type").order("id", { ascending: true }),
  ]);

  return <EventsClient initialEvents={events ?? []} eventTypes={eventTypes ?? []} />;
}