import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";
import type { NextRequest } from "next/server";

process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = "test-signing-key";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
const WEBHOOK_URL = "http://localhost:3000/api/square/webhook";

const h = vi.hoisted(() => ({
  client: null as unknown,
  sendMock: vi.fn(),
  settle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.client),
}));

vi.mock("@/lib/settle-paid-booking", () => ({ settlePaidBooking: h.settle }));

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
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.maybeSingle = () => Promise.resolve({ data: bookingRow });
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
  return { client: { from: () => builder } };
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
  h.settle.mockReset().mockResolvedValue({ outcome: "settled", status: "confirmed" });
});

describe("square webhook — payment.completed settlement", () => {
  it("settles the booking with the payment details and emails the booker", async () => {
    h.client = makeSupabase({ ...pendingBooking }).client;

    const res = await POST(makeRequest(paymentCompleted({ orderId: "order_abc", paymentId: "pay_xyz", amount: 4500 })));

    expect(res.status).toBe(200);
    expect(h.settle).toHaveBeenCalledTimes(1);
    expect(h.settle.mock.calls[0][1]).toEqual({
      bookingId: 42,
      paidAmount: 45, // 4500 pence / 100
      squarePaymentId: "pay_xyz",
    });
    expect(h.sendMock).toHaveBeenCalledTimes(1);
    expect(h.sendMock.mock.calls[0][0]).toMatchObject({ to: "jane@example.com" });
  });

  it("falls back to the booking total when the payload carries no amount", async () => {
    h.client = makeSupabase({ ...pendingBooking, total_amount: 45 }).client;

    await POST(makeRequest(paymentCompleted({}))); // no amount_money

    expect(h.settle.mock.calls[0][1]).toMatchObject({ paidAmount: 45 });
  });

  it("does not send a confirmation when settlement waitlists the booking", async () => {
    h.settle.mockResolvedValue({ outcome: "settled", status: "waitlisted" });
    h.client = makeSupabase({ ...pendingBooking }).client;

    const res = await POST(makeRequest(paymentCompleted({})));

    expect(res.status).toBe(200);
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("does not re-email when another settlement already claimed the booking", async () => {
    h.settle.mockResolvedValue({ outcome: "already_paid" });
    h.client = makeSupabase({ ...pendingBooking }).client;

    const res = await POST(makeRequest(paymentCompleted({})));

    expect(res.status).toBe(200);
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("is idempotent — an already-paid booking is never settled again", async () => {
    h.client = makeSupabase({ ...pendingBooking, payment_status: "paid" }).client;

    const res = await POST(makeRequest(paymentCompleted({})));

    expect(res.status).toBe(200);
    expect(h.settle).not.toHaveBeenCalled();
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("no-ops when no booking matches the order id", async () => {
    h.client = makeSupabase(null).client;

    const res = await POST(makeRequest(paymentCompleted({ orderId: "order_unknown" })));

    expect(res.status).toBe(200);
    expect(h.settle).not.toHaveBeenCalled();
    expect(h.sendMock).not.toHaveBeenCalled();
  });
});

describe("square webhook — guards", () => {
  it("ignores event types other than payment.completed", async () => {
    h.client = makeSupabase({ ...pendingBooking }).client;

    const res = await POST(makeRequest(JSON.stringify({ type: "refund.updated", data: {} })));

    expect(res.status).toBe(200);
    expect(h.settle).not.toHaveBeenCalled();
  });

  it("no-ops a payment.completed with no order id", async () => {
    h.client = makeSupabase({ ...pendingBooking }).client;

    const body = JSON.stringify({ type: "payment.completed", data: { object: { payment: {} } } });
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
    expect(h.settle).not.toHaveBeenCalled();
  });

  it("rejects a bad signature with 401 before touching the booking", async () => {
    h.client = makeSupabase({ ...pendingBooking }).client;

    const res = await POST(makeRequest(paymentCompleted({}), { validSignature: false }));

    expect(res.status).toBe(401);
    expect(h.settle).not.toHaveBeenCalled();
  });

  it("rejects an unparseable body with 400", async () => {
    h.client = makeSupabase({ ...pendingBooking }).client;

    const res = await POST(makeRequest("this-is-not-json"));

    expect(res.status).toBe(400);
  });
});
