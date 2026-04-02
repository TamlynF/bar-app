import { createClient } from "@/lib/supabase/server";
import EventTypesClient from "./event-types-client";

export default async function EventTypesPage() {
  const supabase = await createClient();

  const { data: eventTypes, error } = await supabase
    .from("event_types")
    .select(`
      *,
      event_information (*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching event types:", error);
  }

  return <EventTypesClient initialEventTypes={eventTypes || []} />;
}
