import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const h = vi.hoisted(() => ({
  allocateOnCreate: vi.fn(),
  commitMapping: vi.fn(),
  updateFullyBookedStatus: vi.fn(),
}));

vi.mock("@/lib/table-allocation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/table-allocation")>("@/lib/table-allocation");
  return {
    seatingApplies: actual.seatingApplies,
    allocateOnCreate: h.allocateOnCreate,
    commitMapping: h.commitMapping,
  };
});
vi.mock("@/lib/update-fully-booked", () => ({ updateFullyBookedStatus: h.updateFullyBookedStatus }));

import { settlePaidBooking } from "@/lib/settle-paid-booking";

type Result = { data?: unknown };

function makeSupabase(queues: Record<string, Result[]>) {
  const updates: Array<{ table: string; payload: unknown }> = [];
  const idx: Record<string, number> = {};

  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const m of ["select", "eq", "neq", "order", "limit", "not"]) builder[m] = chain;
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

const pendingBooking = { id: 42, event_id: 7, group_size: 4, status: "pending", payment_status: "unpaid" };
const claimed = { data: [{ id: 42 }] };

beforeEach(() => {
  h.allocateOnCreate.mockReset();
  h.commitMapping.mockReset();
  h.updateFullyBookedStatus.mockReset().mockResolvedValue(undefined);
});

describe("settlePaidBooking — non-seated event", () => {
  it("confirms the booking and records the payment", async () => {
    const { client, updates } = makeSupabase({
      bookings: [{ data: pendingBooking }, claimed],
      events: [{ data: { id: 7, seating_required: false, is_bookable: true } }],
    });

    const result = await settlePaidBooking(client, {
      bookingId: 42,
      paidAmount: 45,
      squarePaymentId: "pay_1",
    });

    expect(result).toEqual({ outcome: "settled", status: "confirmed" });
    expect(updates[0].payload).toMatchObject({
      payment_status: "paid",
      status: "confirmed",
      paid_amount: 45,
      square_payment_id: "pay_1",
    });
    expect(h.allocateOnCreate).not.toHaveBeenCalled();
    expect(h.commitMapping).not.toHaveBeenCalled();
    expect(h.updateFullyBookedStatus).toHaveBeenCalledWith(client, 7);
  });
});

describe("settlePaidBooking — seated event", () => {
  it("allocates a table and writes the mapping only after payment", async () => {
    h.allocateOnCreate.mockResolvedValue({ status: "confirmed", table: { id: 3, max_capacity: 6 } });
    h.commitMapping.mockResolvedValue({ ok: true, addSeat: 0 });

    const { client, updates } = makeSupabase({
      bookings: [{ data: pendingBooking }, claimed],
      events: [{ data: { id: 7, seating_required: true, is_bookable: true } }],
    });

    const result = await settlePaidBooking(client, { bookingId: 42, paidAmount: 45 });

    expect(result).toEqual({ outcome: "settled", status: "confirmed" });
    expect(h.commitMapping).toHaveBeenCalledWith(client, {
      bookingId: 42,
      eventId: 7,
      tableId: 3,
      groupSize: 4,
    });
    expect(updates[0].payload).toMatchObject({ status: "confirmed", payment_status: "paid" });
  });

  it("waitlists the booking when no table is free at settlement time", async () => {
    h.allocateOnCreate.mockResolvedValue({ status: "waitlisted" });

    const { client, updates } = makeSupabase({
      bookings: [{ data: pendingBooking }, claimed],
      events: [{ data: { id: 7, seating_required: true, is_bookable: true } }],
    });

    const result = await settlePaidBooking(client, { bookingId: 42, paidAmount: 45 });

    expect(result).toEqual({ outcome: "settled", status: "waitlisted" });
    expect(h.commitMapping).not.toHaveBeenCalled();
    expect(updates[0].payload).toMatchObject({ status: "waitlisted", payment_status: "paid" });
  });

  it("falls back to waitlisted when the table is claimed by a racing booking", async () => {
    h.allocateOnCreate.mockResolvedValue({ status: "confirmed", table: { id: 3, max_capacity: 6 } });
    h.commitMapping.mockResolvedValue({ ok: false, reason: "table_taken" });

    const { client, updates } = makeSupabase({
      bookings: [{ data: pendingBooking }, claimed],
      events: [{ data: { id: 7, seating_required: true, is_bookable: true } }],
    });

    const result = await settlePaidBooking(client, { bookingId: 42, paidAmount: 45 });

    expect(result).toEqual({ outcome: "settled", status: "waitlisted" });
    expect(updates[1]).toEqual({ table: "bookings", payload: { status: "waitlisted" } });
  });

  it("skips allocation for an event that is no longer bookable", async () => {
    const { client } = makeSupabase({
      bookings: [{ data: pendingBooking }, claimed],
      events: [{ data: { id: 7, seating_required: true, is_bookable: false } }],
    });

    const result = await settlePaidBooking(client, { bookingId: 42, paidAmount: 45 });

    expect(result).toEqual({ outcome: "settled", status: "confirmed" });
    expect(h.allocateOnCreate).not.toHaveBeenCalled();
  });
});

describe("settlePaidBooking — idempotency", () => {
  it("does nothing when the booking is already paid", async () => {
    const { client, updates } = makeSupabase({
      bookings: [{ data: { ...pendingBooking, payment_status: "paid", status: "confirmed" } }],
    });

    const result = await settlePaidBooking(client, { bookingId: 42, paidAmount: 45 });

    expect(result).toEqual({ outcome: "already_paid" });
    expect(updates).toHaveLength(0);
    expect(h.updateFullyBookedStatus).not.toHaveBeenCalled();
  });

  it("skips the table mapping when another settlement won the race", async () => {
    h.allocateOnCreate.mockResolvedValue({ status: "confirmed", table: { id: 3, max_capacity: 6 } });

    const { client } = makeSupabase({
      bookings: [{ data: pendingBooking }, { data: [] }], // conditional update matched no row
      events: [{ data: { id: 7, seating_required: true, is_bookable: true } }],
    });

    const result = await settlePaidBooking(client, { bookingId: 42, paidAmount: 45 });

    expect(result).toEqual({ outcome: "already_paid" });
    expect(h.commitMapping).not.toHaveBeenCalled();
    expect(h.updateFullyBookedStatus).not.toHaveBeenCalled();
  });

  it("reports a missing booking", async () => {
    const { client } = makeSupabase({ bookings: [{ data: null }] });

    const result = await settlePaidBooking(client, { bookingId: 99, paidAmount: 10 });

    expect(result).toEqual({ outcome: "not_found" });
  });
});

describe("settlePaidBooking — non-pending booking", () => {
  it("keeps an existing status instead of promoting it", async () => {
    const { client, updates } = makeSupabase({
      bookings: [{ data: { ...pendingBooking, status: "waitlisted" } }, claimed],
    });

    const result = await settlePaidBooking(client, { bookingId: 42, paidAmount: 45 });

    expect(result).toEqual({ outcome: "settled", status: "waitlisted" });
    expect(updates[0].payload).toMatchObject({ status: "waitlisted", payment_status: "paid" });
    expect(h.allocateOnCreate).not.toHaveBeenCalled();
  });
});
