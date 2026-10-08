import { createClient } from "@/lib/supabase/server";

/* The name shown on the banner for a grouped booking page: the sub-type's
   or type's booking card title, falling back to its plain name. */
export async function bookingGroupHeading(scope: string, id: string): Promise<string> {
  if (scope !== "type" && scope !== "subtype") return "Book a night";
  const supabase = await createClient();
  const table = scope === "subtype" ? "event_subtypes" : "event_types";
  const { data } = await supabase.from(table).select("name, booking_card_title").eq("id", id).maybeSingle();
  return data?.booking_card_title?.trim() || data?.name?.trim() || "Book a night";
}
