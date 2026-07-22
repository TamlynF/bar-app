import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventBehavior } from "@/lib/event-behavior";

export type ResolvedTaxonomy = {
  eventTypeId: number;
  eventSubtypeId: number;
};

export async function resolveEventSubtype(
  supabase: SupabaseClient,
  typeName: string,
  subtypeName: string,
  behavior: EventBehavior = "standard",
): Promise<ResolvedTaxonomy> {
  const type = (typeName || "").trim().toLowerCase();
  const sub = (subtypeName || "other").trim().toLowerCase();

  let eventTypeId: number | null = null;
  {
    const { data: existing } = await supabase
      .from("event_types")
      .select("id")
      .ilike("name", type)
      .maybeSingle();
    if (existing) {
      eventTypeId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("event_types")
        .insert({ name: type })
        .select("id")
        .single();
      if (error) throw error;
      eventTypeId = created.id;
    }
  }

  const { data: existingSub } = await supabase
    .from("event_subtypes")
    .select("id")
    .eq("event_types_id", eventTypeId)
    .ilike("name", sub)
    .maybeSingle();
  if (existingSub) {
    return { eventTypeId: eventTypeId!, eventSubtypeId: existingSub.id };
  }

  const { data: createdSub, error: subErr } = await supabase
    .from("event_subtypes")
    .insert({
      event_types_id: eventTypeId,
      name: sub,
      behavior,
    })
    .select("id")
    .single();
  if (subErr) throw subErr;

  return { eventTypeId: eventTypeId!, eventSubtypeId: createdSub.id };
}
