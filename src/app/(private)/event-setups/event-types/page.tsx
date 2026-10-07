import { createClient } from "@/lib/supabase/server";
import { loadEmailVersions } from "@/lib/email/booking-email-choice";
import EventTypesClient from "./event-types-client";

export default async function EventTypesPage() {
  const supabase = await createClient();

  const emailVersionsLoad = loadEmailVersions(supabase);
  const { data: eventTypes, error } = await supabase
    .from("event_types")
    .select(`
      *,
      event_subtypes (
        *,
        event_subtype_badges (*)
      )
    `)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching event types:", error);
  }

  return <EventTypesClient initialEventTypes={eventTypes || []} emailVersions={await emailVersionsLoad} />;
}
