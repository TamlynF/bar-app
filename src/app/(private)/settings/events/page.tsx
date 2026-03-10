import { createClient } from "@/lib/supabase/server";
import EventsClient from "./events-client";

export default async function EventsPage() {
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
  }

  return <EventsClient initialEvents={events || []} />;
}