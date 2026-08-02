import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const h = vi.hoisted(() => ({ getFreeTablesForEvent: vi.fn() }));

vi.mock("@/lib/table-allocation", () => ({ getFreeTablesForEvent: h.getFreeTablesForEvent }));

import { updateFullyBookedStatus, sumConfirmedGroupSizes } from "@/lib/update-fully-booked";

type Result = { data?: unknown; count?: number };

function makeSupabase(queues: Record<string, Result[]>) {
  const updates: Array<{ table: string; payload: unknown }> = [];
  const idx: Record<string, number> = {};

  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const m of ["select", "eq", "order", "limit", "not"]) builder[m] = chain;
    builder.update = (payload: unknown) => {
      updates.push({ table, payload });
      return builder;
    };
    const next = () => {
      const queue = queues[table] ?? [];
      const i = idx[table] ?? 0;
      idx[table] = i + 1;
      return Promise.resolve(queue[i] ?? { data: null });
    };
    builder.single = next;
    builder.maybeSingle = next;
    builder.then = (resolve: (v: unknown) => unknown) => resolve(next());
    return builder;
  };

  return { client: { from } as unknown as SupabaseClient, updates };
}

const eventUpdates = (updates: Array<{ table: string; payload: unknown }>) =>
  updates.filter((u) => u.table === "events").map((u) => u.payload);

beforeEach(() => {
  h.getFreeTablesForEvent.mockReset();
});

describe("sumConfirmedGroupSizes", () => {
  it("adds up group sizes and treats a null size as zero", () => {
    expect(sumConfirmedGroupSizes([{ group_size: 4 }, { group_size: 6 }])).toBe(10);
    expect(sumConfirmedGroupSizes([{ group_size: 4 }, { group_size: null }])).toBe(4);
    expect(sumConfirmedGroupSizes([])).toBe(0);
  });
});

describe("updateFullyBookedStatus - seated events", () => {
  it("marks the event full when no table is free", async () => {
    h.getFreeTablesForEvent.mockResolvedValue([]);
    const { client, updates } = makeSupabase({
      events: [{ data: { id: 1, seating_required: true } }],
      tables: [{ count: 12 }],
    });

    await updateFullyBookedStatus(client, 1);

    expect(eventUpdates(updates)).toEqual([{ is_fully_booked: true }]);
  });

  it("clears the flag while a table is still free", async () => {
    h.getFreeTablesForEvent.mockResolvedValue([{ id: 3, max_capacity: 6 }]);
    const { client, updates } = makeSupabase({
      events: [{ data: { id: 1, seating_required: true } }],
      tables: [{ count: 12 }],
    });

    await updateFullyBookedStatus(client, 1);

    expect(eventUpdates(updates)).toEqual([{ is_fully_booked: false }]);
  });

  it("never marks full when the venue has no available tables at all", async () => {
    h.getFreeTablesForEvent.mockResolvedValue([]);
    const { client, updates } = makeSupabase({
      events: [{ data: { id: 1, seating_required: true } }],
      tables: [{ count: 0 }],
    });

    await updateFullyBookedStatus(client, 1);

    expect(eventUpdates(updates)).toEqual([{ is_fully_booked: false }]);
  });
});

describe("updateFullyBookedStatus - non-seated events", () => {
  it("marks the event full when confirmed group sizes reach venue capacity", async () => {
    const { client, updates } = makeSupabase({
      events: [{ data: { id: 2, seating_required: false } }],
      company_information: [{ data: { max_capacity: 100 } }],
      bookings: [{ data: [{ group_size: 60 }, { group_size: 40 }] }],
    });

    await updateFullyBookedStatus(client, 2);

    expect(eventUpdates(updates)).toEqual([{ is_fully_booked: true }]);
    expect(h.getFreeTablesForEvent).not.toHaveBeenCalled();
  });

  it("marks the event full when confirmed group sizes exceed venue capacity", async () => {
    const { client, updates } = makeSupabase({
      events: [{ data: { id: 2, seating_required: false } }],
      company_information: [{ data: { max_capacity: 100 } }],
      bookings: [{ data: [{ group_size: 80 }, { group_size: 45 }] }],
    });

    await updateFullyBookedStatus(client, 2);

    expect(eventUpdates(updates)).toEqual([{ is_fully_booked: true }]);
  });

  it("clears the flag while the venue still has headroom", async () => {
    const { client, updates } = makeSupabase({
      events: [{ data: { id: 2, seating_required: false } }],
      company_information: [{ data: { max_capacity: 100 } }],
      bookings: [{ data: [{ group_size: 60 }, { group_size: 39 }] }],
    });

    await updateFullyBookedStatus(client, 2);

    expect(eventUpdates(updates)).toEqual([{ is_fully_booked: false }]);
  });

  it("leaves the flag untouched when no venue capacity is configured", async () => {
    const { client, updates } = makeSupabase({
      events: [{ data: { id: 2, seating_required: false } }],
      company_information: [{ data: { max_capacity: null } }],
    });

    await updateFullyBookedStatus(client, 2);

    expect(eventUpdates(updates)).toEqual([]);
  });
});

describe("updateFullyBookedStatus - missing event", () => {
  it("does nothing when the event cannot be loaded", async () => {
    const { client, updates } = makeSupabase({ events: [{ data: null }] });

    await updateFullyBookedStatus(client, 99);

    expect(updates).toEqual([]);
  });
});
