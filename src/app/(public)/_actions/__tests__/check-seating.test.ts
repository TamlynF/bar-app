import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  client: null as unknown,
  getFreeTablesForEvent: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.client) }));
vi.mock("@/lib/table-allocation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/table-allocation")>();
  return { seatingApplies: actual.seatingApplies, getFreeTablesForEvent: h.getFreeTablesForEvent };
});

import { checkSeatingAvailability } from "@/app/(public)/_actions/check-seating";

type Result = { data?: unknown; count?: number };

function makeSupabase(queues: Record<string, Result[]>) {
  const idx: Record<string, number> = {};
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const m of ["select", "eq", "neq", "order", "limit", "not"]) builder[m] = chain;
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
  return { from };
}

const nonSeatedEvent = { data: { id: 5, seating_required: false, is_bookable: true } };

beforeEach(() => {
  h.getFreeTablesForEvent.mockReset();
});

describe("checkSeatingAvailability — non-seated events", () => {
  it("has space while the group fits inside the venue capacity", async () => {
    h.client = makeSupabase({
      events: [nonSeatedEvent],
      company_information: [{ data: { max_capacity: 100 } }],
      bookings: [{ data: [{ group_size: 60 }, { group_size: 36 }] }],
    });

    expect(await checkSeatingAvailability(5, 4)).toEqual({ seatingRequired: false, hasSpace: true });
    expect(h.getFreeTablesForEvent).not.toHaveBeenCalled();
  });

  it("has no space when the group would push the event past capacity", async () => {
    h.client = makeSupabase({
      events: [nonSeatedEvent],
      company_information: [{ data: { max_capacity: 100 } }],
      bookings: [{ data: [{ group_size: 60 }, { group_size: 38 }] }],
    });

    expect(await checkSeatingAvailability(5, 3)).toEqual({ seatingRequired: false, hasSpace: false });
  });

  it("treats an unconfigured venue capacity as unlimited", async () => {
    h.client = makeSupabase({
      events: [nonSeatedEvent],
      company_information: [{ data: { max_capacity: null } }],
    });

    expect(await checkSeatingAvailability(5, 50)).toEqual({ seatingRequired: false, hasSpace: true });
  });

  it("ignores a group size of zero or less", async () => {
    h.client = makeSupabase({ events: [nonSeatedEvent] });

    expect(await checkSeatingAvailability(5, 0)).toEqual({ seatingRequired: false, hasSpace: true });
  });
});

describe("checkSeatingAvailability — seated events", () => {
  it("falls back to table allocation instead of venue capacity", async () => {
    h.getFreeTablesForEvent.mockResolvedValue([{ id: 2, max_capacity: 6 }]);
    h.client = makeSupabase({
      events: [{ data: { id: 6, seating_required: true, is_bookable: true } }],
    });

    expect(await checkSeatingAvailability(6, 4)).toEqual({ seatingRequired: true, hasSpace: true });
    expect(h.getFreeTablesForEvent).toHaveBeenCalledTimes(1);
  });

  it("reports no space when every table is taken", async () => {
    h.getFreeTablesForEvent.mockResolvedValue([]);
    h.client = makeSupabase({
      events: [{ data: { id: 6, seating_required: true, is_bookable: true } }],
    });

    expect(await checkSeatingAvailability(6, 4)).toEqual({ seatingRequired: true, hasSpace: false });
  });
});
