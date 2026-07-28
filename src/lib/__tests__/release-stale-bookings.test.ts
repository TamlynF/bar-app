import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const h = vi.hoisted(() => ({
  ordersGet: vi.fn(),
  settlePaidBooking: vi.fn(),
  releaseUnpaidBooking: vi.fn(),
}));

vi.mock("@/lib/square", () => ({ squareClient: { orders: { get: h.ordersGet } } }));
vi.mock("@/lib/settle-paid-booking", () => ({ settlePaidBooking: h.settlePaidBooking }));
vi.mock("@/lib/release-unpaid-booking", () => ({ releaseUnpaidBooking: h.releaseUnpaidBooking }));

import { releaseStaleUnpaidBookings, staleCutoff } from "@/lib/release-stale-bookings";

function makeSupabase(rows: unknown[], error: unknown = null) {
  const filters: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: unknown) => { filters.push([col, val]); return builder; };
  builder.lt = (col: string, val: unknown) => { filters.push([col, val]); return builder; };
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error });
  return { client: { from: () => builder } as unknown as SupabaseClient, filters };
}

const staleRow = {
  id: 42,
  event_id: 7,
  total_amount: 45,
  square_order_id: "ord_1",
  created_at: "2026-02-01T10:00:00.000Z",
};

beforeEach(() => {
  h.ordersGet.mockReset();
  h.settlePaidBooking.mockReset().mockResolvedValue({ outcome: "settled", status: "confirmed" });
  h.releaseUnpaidBooking.mockReset().mockResolvedValue({ released: true });
});

describe("staleCutoff", () => {
  it("subtracts the window from the given moment", () => {
    expect(staleCutoff(new Date("2026-02-01T12:00:00.000Z"), 60)).toBe("2026-02-01T11:00:00.000Z");
  });
});

describe("releaseStaleUnpaidBookings", () => {
  it("only looks at pending, unpaid bookings older than the cutoff", async () => {
    const { client, filters } = makeSupabase([]);

    await releaseStaleUnpaidBookings(client, { now: new Date("2026-02-01T12:00:00.000Z"), minutes: 60 });

    expect(filters).toEqual([
      ["status", "pending"],
      ["payment_status", "unpaid"],
      ["created_at", "2026-02-01T11:00:00.000Z"],
    ]);
  });

  it("cancels a stale booking that Square shows no payment for", async () => {
    h.ordersGet.mockResolvedValue({ order: { tenders: [] } });
    const { client } = makeSupabase([staleRow]);

    const result = await releaseStaleUnpaidBookings(client);

    expect(h.releaseUnpaidBooking).toHaveBeenCalledWith(client, { bookingId: 42, eventId: 7 });
    expect(h.settlePaidBooking).not.toHaveBeenCalled();
    expect(result).toEqual({ examined: 1, settled: 0, released: 1 });
  });

  it("settles instead of cancelling when Square shows the payment landed", async () => {
    h.ordersGet.mockResolvedValue({
      order: { tenders: [{ id: "tender_1", amountMoney: { amount: 4500 } }] },
    });
    const { client } = makeSupabase([staleRow]);

    const result = await releaseStaleUnpaidBookings(client);

    expect(h.settlePaidBooking).toHaveBeenCalledWith(client, {
      bookingId: 42,
      paidAmount: 45,
      squarePaymentId: "tender_1",
    });
    expect(h.releaseUnpaidBooking).not.toHaveBeenCalled();
    expect(result).toEqual({ examined: 1, settled: 1, released: 0 });
  });

  it("leaves the booking alone when Square is unreachable", async () => {
    h.ordersGet.mockRejectedValue(new Error("network down"));
    const { client } = makeSupabase([staleRow]);

    const result = await releaseStaleUnpaidBookings(client);

    expect(h.releaseUnpaidBooking).not.toHaveBeenCalled();
    expect(h.settlePaidBooking).not.toHaveBeenCalled();
    expect(result).toEqual({ examined: 1, settled: 0, released: 0 });
  });

  it("cancels a stale booking that never got a Square order", async () => {
    const { client } = makeSupabase([{ ...staleRow, square_order_id: null }]);

    const result = await releaseStaleUnpaidBookings(client);

    expect(h.ordersGet).not.toHaveBeenCalled();
    expect(h.releaseUnpaidBooking).toHaveBeenCalledWith(client, { bookingId: 42, eventId: 7 });
    expect(result).toEqual({ examined: 1, settled: 0, released: 1 });
  });

  it("reports nothing when the lookup fails", async () => {
    const { client } = makeSupabase([], { message: "boom" });

    const result = await releaseStaleUnpaidBookings(client);

    expect(result).toEqual({ examined: 0, settled: 0, released: 0 });
    expect(h.releaseUnpaidBooking).not.toHaveBeenCalled();
  });
});
