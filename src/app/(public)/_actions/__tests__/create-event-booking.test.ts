import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Module-load consts in the action read these; set before the dynamic import.
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.SQUARE_LOCATION_ID = "LOC_TEST";

// Mutable seams referenced from the hoisted vi.mock factories.
const h = vi.hoisted(() => ({
  client: null as unknown,
  squareCreate: vi.fn(),
  send: vi.fn(),
  revalidatePath: vi.fn(),
  updateFullyBookedStatus: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.client) }));
vi.mock("@/lib/square", () => ({
  squareClient: { checkout: { paymentLinks: { create: h.squareCreate } } },
}));
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: h.send } })) }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/update-fully-booked", () => ({ updateFullyBookedStatus: h.updateFullyBookedStatus }));

type Result = { data: unknown; error?: unknown };

/**
 * Table-dispatched Supabase mock. Each table has a FIFO of results consumed by
 * whichever terminal (`single`/`maybeSingle`) ends the chain; update/delete are
 * awaited on the (thenable) builder. All inserts/updates/deletes are recorded.
 */
function makeSupabase(queues: Record<string, Result[]>) {
  const calls = {
    inserts: [] as Array<{ table: string; payload: unknown }>,
    updates: [] as Array<{ table: string; payload: unknown }>,
    deletes: [] as Array<{ table: string }>,
  };
  const idx: Record<string, number> = {};
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const m of ["select", "eq", "gte", "order"]) builder[m] = chain;
    builder.insert = (payload: unknown) => { calls.inserts.push({ table, payload }); return builder; };
    builder.update = (payload: unknown) => { calls.updates.push({ table, payload }); return builder; };
    builder.delete = () => { calls.deletes.push({ table }); return builder; };
    const next = () => {
      const q = queues[table] ?? [];
      const i = idx[table] ?? 0;
      idx[table] = i + 1;
      return Promise.resolve(q[i] ?? { data: null });
    };
    builder.single = next;
    builder.maybeSingle = next;
    builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
    return builder;
  };
  return { client: { from }, calls };
}

const bookableEvent = {
  id: 7,
  date: "2026-12-26",
  title: "Boxing Day Bash",
  seating_required: false, // keeps the real table-allocation module out of the path
  is_fully_booked: false,
  is_active: true,
  is_bookable: true,
};

function formData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    event_id: "7",
    full_name: "Jane Doe",
    email: "jane@example.com",
    country_code: "+44",
    phone_no: "7123456789",
    group_size: "3",
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) fd.set(k, v);
  return fd;
}

let createEventBooking: (fd: FormData) => Promise<{ checkoutUrl?: string; success?: boolean; error?: string }>;

beforeAll(async () => {
  ({ createEventBooking } = await import("@/app/(public)/_actions/create-event-booking"));
});

beforeEach(() => {
  h.squareCreate.mockReset();
  h.send.mockReset().mockResolvedValue({ error: null });
  h.revalidatePath.mockReset();
  h.updateFullyBookedStatus.mockReset().mockResolvedValue(undefined);
});

describe("createEventBooking — paid path", () => {
  it("creates a Square payment link and persists the pending booking", async () => {
    const { client, calls } = makeSupabase({
      events: [{ data: { ...bookableEvent, payment_amount: 15 } }],
      contacts: [{ data: null }, { data: { id: 100 } }], // lookup miss → insert
      bookings: [{ data: { id: 42 } }],
    });
    h.client = client;
    h.squareCreate.mockResolvedValue({ paymentLink: { url: "https://checkout.square/xyz", orderId: "ord_1" } });

    const result = await createEventBooking(formData());

    expect(result).toEqual({ checkoutUrl: "https://checkout.square/xyz" });

    // Square called exactly once with our booking linked into the order.
    expect(h.squareCreate).toHaveBeenCalledTimes(1);
    const req = h.squareCreate.mock.calls[0][0];
    expect(req.idempotencyKey).toBeTruthy();
    expect(req.order.referenceId).toBe("42");
    expect(req.order.locationId).toBe("LOC_TEST");
    expect(req.prePopulatedData.buyerEmail).toBe("jane@example.com");

    // Booking inserted pending/unpaid, then stamped with the Square order id.
    expect(calls.inserts.find((i) => i.table === "bookings")?.payload).toMatchObject([
      { status: "pending", payment_status: "unpaid", total_amount: 45 },
    ]);
    expect(calls.updates).toEqual([
      { table: "bookings", payload: { square_order_id: "ord_1", status: "confirmed" } },
    ]);
    expect(calls.deletes).toHaveLength(0);
  });

  it("rolls back the booking when Square returns no checkout url", async () => {
    const { client, calls } = makeSupabase({
      events: [{ data: { ...bookableEvent, payment_amount: 15 } }],
      contacts: [{ data: { id: 100 } }], // existing contact
      bookings: [{ data: { id: 42 } }],
    });
    h.client = client;
    h.squareCreate.mockResolvedValue({ paymentLink: { url: undefined, orderId: undefined } });

    const result = await createEventBooking(formData());

    expect(result.error).toBeTruthy();
    expect(result.checkoutUrl).toBeUndefined();
    // Both the mapping and the booking rows are cleaned up.
    expect(calls.deletes.map((d) => d.table)).toEqual(["booking_table_mappings", "bookings"]);
    expect(calls.updates).toHaveLength(0); // never got to the square_order_id stamp
    expect(h.send).not.toHaveBeenCalled();
  });
});

describe("createEventBooking — free path", () => {
  it("confirms immediately and never calls Square", async () => {
    const { client, calls } = makeSupabase({
      events: [{ data: { ...bookableEvent, payment_amount: 0 } }],
      contacts: [{ data: { id: 100 } }],
      bookings: [{ data: { id: 43 } }],
    });
    h.client = client;

    const result = await createEventBooking(formData());

    expect(result).toEqual({ success: true });
    expect(h.squareCreate).not.toHaveBeenCalled();
    expect(h.send).toHaveBeenCalledTimes(1); // confirmation email still sent
    expect(calls.inserts.find((i) => i.table === "bookings")?.payload).toMatchObject([
      { status: "confirmed", payment_status: "paid" },
    ]);
    expect(calls.updates).toHaveLength(0); // no square_order_id stamp on the free path
  });
});

describe("createEventBooking — guards", () => {
  it("returns a validation error without touching Square when a field is missing", async () => {
    h.client = makeSupabase({}).client;
    const result = await createEventBooking(formData({ email: "" }));
    expect(result.error).toMatch(/fill in all required fields/i);
    expect(h.squareCreate).not.toHaveBeenCalled();
  });

  it("refuses an event that is not bookable", async () => {
    const { client, calls } = makeSupabase({
      events: [{ data: { ...bookableEvent, is_bookable: false, payment_amount: 15 } }],
    });
    h.client = client;
    const result = await createEventBooking(formData());
    expect(result.error).toMatch(/not available/i);
    expect(calls.inserts).toHaveLength(0);
    expect(h.squareCreate).not.toHaveBeenCalled();
  });

  it("refuses a fully booked event", async () => {
    const { client } = makeSupabase({
      events: [{ data: { ...bookableEvent, is_fully_booked: true, payment_amount: 15 } }],
    });
    h.client = client;
    const result = await createEventBooking(formData());
    expect(result.error).toMatch(/fully booked/i);
    expect(h.squareCreate).not.toHaveBeenCalled();
  });
});
