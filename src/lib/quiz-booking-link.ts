import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { publicBookingUrl } from "@/lib/booking-links";
import { isBookingGrouping } from "@/lib/booking-grouping";

type TypeRel = { booking_grouping: string | null };

export async function quizBookingHref(
  supabase: SupabaseClient,
  today: Date = new Date()
): Promise<string | null> {
  const { data, error } = await supabase
    .from("events")
    .select("id, event_types_id, event_subtypes_id, event_types!inner(booking_grouping), event_subtypes!inner(behavior)")
    .eq("event_subtypes.behavior", "quiz")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .gte("date", format(today, "yyyy-MM-dd"))
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[quiz link] could not find the next quiz:", error.message);
    return null;
  }
  if (!data) return null;

  const typeRel = data.event_types as unknown as TypeRel | TypeRel[] | null;
  const grouping = (Array.isArray(typeRel) ? typeRel[0] : typeRel)?.booking_grouping;

  return publicBookingUrl({
    grouping: isBookingGrouping(grouping) ? grouping : "per_event",
    isBookable: true,
    manualUrl: null,
    siteUrl: "",
    eventTypesId: data.event_types_id as number,
    eventSubtypesId: (data.event_subtypes_id as number | null) ?? null,
    eventId: data.id as number,
  });
}
