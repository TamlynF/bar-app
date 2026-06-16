import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedTaxonomy = {
  eventTypeId: number;
  eventSubtypeId: number;
};

/**
 * Resolve an event type + subtype by name, creating either if missing.
 *
 * Used by the public/admin booking flows that lazily create events. The split
 * schema requires every event to reference both an `event_types` row and an
 * `event_subtypes` row, so this guarantees both exist and returns their ids.
 *
 * When a subtype is created on the fly it inherits the parent type's
 * `is_music_act` / `is_karaoke` / `is_private` flags, matching the admin UI.
 */
export async function resolveEventSubtype(
  supabase: SupabaseClient,
  typeName: string,
  subtypeName: string,
): Promise<ResolvedTaxonomy> {
  const type = (typeName || "").trim().toLowerCase();
  const sub = (subtypeName || "other").trim().toLowerCase();

  // --- Resolve the parent type ---
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

  // --- Resolve the subtype within that type ---
  const { data: existingSub } = await supabase
    .from("event_subtypes")
    .select("id")
    .eq("event_types_id", eventTypeId)
    .ilike("name", sub)
    .maybeSingle();
  if (existingSub) {
    return { eventTypeId: eventTypeId!, eventSubtypeId: existingSub.id };
  }

  // Inherit flags from the parent type when creating a new subtype.
  const { data: parent } = await supabase
    .from("event_types")
    .select("is_music_act, is_karaoke, is_private")
    .eq("id", eventTypeId)
    .maybeSingle();

  const { data: createdSub, error: subErr } = await supabase
    .from("event_subtypes")
    .insert({
      event_types_id: eventTypeId,
      name: sub,
      is_music_act: parent?.is_music_act ?? false,
      is_karaoke: parent?.is_karaoke ?? false,
      is_private: parent?.is_private ?? false,
    })
    .select("id")
    .single();
  if (subErr) throw subErr;

  return { eventTypeId: eventTypeId!, eventSubtypeId: createdSub.id };
}
