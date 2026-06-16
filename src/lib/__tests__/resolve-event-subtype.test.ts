import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";

/**
 * Builds a minimal chainable Supabase mock. Each `.from()` call consumes the
 * next queued result; that result is returned by whichever terminal
 * (`maybeSingle`/`single`) ends the chain. `inserts` records insert payloads.
 */
function makeSupabase(results: Array<{ data: unknown }>) {
  const inserts: Array<{ table: string; payload: unknown }> = [];
  let i = 0;
  const from = (table: string) => {
    const result = results[i++] ?? { data: null };
    let pendingInsert: unknown;
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const m of ["select", "ilike", "eq"]) builder[m] = chain;
    builder.insert = (payload: unknown) => { pendingInsert = payload; inserts.push({ table, payload }); return builder; };
    builder.maybeSingle = () => Promise.resolve(result);
    builder.single = () => Promise.resolve(result);
    void pendingInsert;
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, inserts };
}

describe("resolveEventSubtype", () => {
  it("returns existing ids without inserting when both rows exist", async () => {
    const { client, inserts } = makeSupabase([
      { data: { id: 1 } },   // event_types lookup
      { data: { id: 10 } },  // event_subtypes lookup
    ]);
    const result = await resolveEventSubtype(client, "Games", "Quiz");
    expect(result).toEqual({ eventTypeId: 1, eventSubtypeId: 10 });
    expect(inserts).toHaveLength(0);
  });

  it("creates the type and subtype when missing, inheriting parent flags", async () => {
    const { client, inserts } = makeSupabase([
      { data: null },                                   // type lookup → miss
      { data: { id: 2 } },                              // type insert
      { data: null },                                   // subtype lookup → miss
      { data: { is_music_act: true, is_karaoke: false, is_private: false } }, // parent flags
      { data: { id: 20 } },                             // subtype insert
    ]);
    const result = await resolveEventSubtype(client, "music", "DJ");
    expect(result).toEqual({ eventTypeId: 2, eventSubtypeId: 20 });

    // Name is normalised to lower-case, and the new subtype inherits is_music_act.
    expect(inserts[0]).toEqual({ table: "event_types", payload: { name: "music" } });
    expect(inserts[1].table).toBe("event_subtypes");
    expect(inserts[1].payload).toMatchObject({
      event_types_id: 2,
      name: "dj",
      is_music_act: true,
      is_karaoke: false,
      is_private: false,
    });
  });
});
