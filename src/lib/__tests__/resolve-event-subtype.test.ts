import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";

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

  it("creates the type and subtype when missing, stamping the given behavior", async () => {
    const { client, inserts } = makeSupabase([
      { data: null },                                   // type lookup → miss
      { data: { id: 2 } },                              // type insert
      { data: null },                                   // subtype lookup → miss
      { data: { id: 20 } },                             // subtype insert
    ]);
    const result = await resolveEventSubtype(client, "music", "DJ", "music_act");
    expect(result).toEqual({ eventTypeId: 2, eventSubtypeId: 20 });

    expect(inserts[0]).toEqual({ table: "event_types", payload: { name: "music" } });
    expect(inserts[1].table).toBe("event_subtypes");
    expect(inserts[1].payload).toMatchObject({
      event_types_id: 2,
      name: "dj",
      behavior: "music_act",
    });
  });
});
