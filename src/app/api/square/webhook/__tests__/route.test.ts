import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";
import type { NextRequest } from "next/server";

process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = "test-signing-key";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
const WEBHOOK_URL = "http://localhost:3000/api/square/webhook";

const h = vi.hoisted(() => ({
  client: null as unknown,
  sendMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.client),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: h.sendMock } })),
}));

type BookingRow = {
  id: number;
  status: string;
  payment_status: string;
  group_size: number;
  total_amount: number | null;
  contacts: { full_name: string; email: string } | null;
  events: { date: string; title: string } | null;
} | null;

function makeSupabase(bookingRow: BookingRow) {
  const updates: Array<Record<string, unknown>> = [];
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.update = (payload: Record<string, unknown>) => { updates.push(payload); return builder; };
  builder.maybeSingle = () => Promise.resolve({ data: bookingRow });
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
  return { client: { from: () => builder }, updates };
}

function makeRequest(
  body: string,
  { validSignature = true }: { validSignature?: boolean } = {}
): NextRequest {
  const signature = validSignature
    ? createHmac("sha256", "test-signing-key").update(WEBHOOK_URL + body).digest("base64")
    : "not-the-real-signature";
  return {
    text: async () => body,
    headers: { get: (name: string) => (name === "x-square-hmacsha256-signature" ? signature : null) },
  } as unknown as NextRequest;
}

function paymentCompleted(overrides: {
  orderId?: string;
  paymentId?: string;
  amount?: number;
} = {}) {
  return JSON.stringify({
    type: "payment.completed",
    data: {
      object: {
        payment: {
          id: overrides.paymentId ?? "pay_123",
          order_id: overrides.orderId ?? "order_abc",
          amount_money: overrides.amount !== undefined ? { amount: overrides.amount } : undefined,
        },
      },
    },
  });
}

const pendingBooking: BookingRow = {
  id: 42,
  status: "pending",
  payment_status: "unpaid",
  group_size: 3,
  total_amount: 45,
  contacts: { full_name: "Jane Doe", email: "jane@example.com" },
  events: { date: "2026-12-26", title: "Boxing Day Bash" },
};

let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/square/webhook/route"));
});

beforeEach(() => {
  h.sendMock.mockReset().mockResolvedValue({ error: null });
});

describe("square webhook — payment.completed settlement", () => {
  it("marks a pending/unpaid booking as confirmed and paid, and emails the booker", async () => {
    const { client, updates } = makeSupabase({ ...pendingBooking });
    h.client = client;

    const res = await POST(makeRequest(paymentCompleted({ orderId: "order_abc", paymentId: "pay_xyz", amount: 4500 })));

    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      payment_status: "paid",
      status: "confirmed",
      paid_amount: 45,            // 4500 pence / 100
      square_payment_id: "pay_xyz",
    });
    expect(h.sendMock).toHaveBeenCalledTimes(1);
    expect(h.sendMock.mock.calls[0][0]).toMatchObject({ to: "jane@example.com" });
  });

  it("preserves a non-pending status while still marking it paid", async () => {
    const { client, updates } = makeSupabase({ ...pendingBooking, status: "waitlisted" });
    h.client = client;

    await POST(makeRequest(paymentCompleted({ amount: 4500 })));

    expect(updates[0]).toMatchObject({ payment_status: "paid", status: "waitlisted" });
  });

  it("falls back to the booking total when the payload carries no amount", async () => {
    const { client, updates } = makeSupabase({ ...pendingBooking, total_amount: 45 });
    h.client = client;

    await POST(makeRequest(paymentCompleted({}))); // no amount_money

    expect(updates[0]).toMatchObject({ paid_amount: 45 });
  });

  it("is idempotent — an already-paid booking is not updated or re-emailed", async () => {
    const { client, updates } = makeSupabase({ ...pendingBooking, payment_status: "paid" });
    h.client = client;

    const res = await POST(makeRequest(paymentCompleted({})));

    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("no-ops when no booking matches the order id", async () => {
    const { client, updates } = makeSupabase(null);
    h.client = client;

    const res = await POST(makeRequest(paymentCompleted({ orderId: "order_unknown" })));

    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
    expect(h.sendMock).not.toHaveBeenCalled();
  });
});

describe("square webhook — guards", () => {
  it("ignores event types other than payment.completed", async () => {
    const { client, updates } = makeSupabase({ ...pendingBooking });
    h.client = client;

    const res = await POST(makeRequest(JSON.stringify({ type: "refund.updated", data: {} })));

    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
  });

  it("no-ops a payment.completed with no order id", async () => {
    const { client, updates } = makeSupabase({ ...pendingBooking });
    h.client = client;

    const body = JSON.stringify({ type: "payment.completed", data: { object: { payment: {} } } });
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
  });

  it("rejects a bad signature with 401 before touching the booking", async () => {
    const { client, updates } = makeSupabase({ ...pendingBooking });
    h.client = client;

    const res = await POST(makeRequest(paymentCompleted({}), { validSignature: false }));

    expect(res.status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it("rejects an unparseable body with 400", async () => {
    const { client } = makeSupabase({ ...pendingBooking });
    h.client = client;

    const res = await POST(makeRequest("this-is-not-json"));

    expect(res.status).toBe(400);
  });
});
