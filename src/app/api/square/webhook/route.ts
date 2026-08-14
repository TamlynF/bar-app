import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { settlePaidBooking } from "@/lib/settle-paid-booking";
import { createHmac, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { buildBookingConfirmedEmail, formatEventDate } from "@/lib/booking-emails";
import { renderTemplate } from "@/lib/email/resolve";
import { EMAIL_FROM } from "@/lib/email";
import { getContactEmail } from "@/lib/company-info";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

type SquarePayment = {
  id?: string;
  order_id?: string;
  status?: string;
  amount_money?: { amount?: number };
};

const PAYMENT_EVENT_TYPES = new Set(["payment.created", "payment.updated"]);

const WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
const WEBHOOK_URL =
  process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/square/webhook`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/square/webhook`
    : "http://localhost:3000/api/square/webhook";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-square-hmacsha256-signature") ?? "";

  if (WEBHOOK_SIGNATURE_KEY && signature) {
    const hmac = createHmac("sha256", WEBHOOK_SIGNATURE_KEY);
    hmac.update(WEBHOOK_URL + body);
    const expected = hmac.digest("base64");
    try {
      const isValid = timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      if (!isValid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: { type: string; data?: { object?: { payment?: SquarePayment } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!PAYMENT_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const payment = event.data?.object?.payment;
  if (payment?.status !== "COMPLETED") {
    return NextResponse.json({ received: true });
  }

  const orderId = payment.order_id;
  if (!orderId) return NextResponse.json({ received: true });

  try {
    const supabase = await createClient();

    const { data: booking } = await supabase
      .from("bookings")
      .select(`
        id, status, payment_status, group_size, total_amount,
        contacts!bookings_contact_id_fkey(full_name, email),
        events!bookings_event_id_fkey(date, title)
      `)
      .eq("square_order_id", orderId)
      .maybeSingle();

    if (!booking || booking.payment_status === "paid") {
      return NextResponse.json({ received: true });
    }

    const amountPaid = payment.amount_money?.amount;
    const paymentId = payment.id ?? null;

    const settlement = await settlePaidBooking(supabase, {
      bookingId: booking.id,
      paidAmount: amountPaid ? amountPaid / 100 : (booking.total_amount ?? 0),
      squarePaymentId: paymentId,
    });

    if (settlement.outcome !== "settled" || settlement.status === "waitlisted") {
      return NextResponse.json({ received: true });
    }

    const contactRaw = booking.contacts;
    const contact = (Array.isArray(contactRaw) ? contactRaw[0] : contactRaw) as { full_name: string; email: string } | null;
    const eventRaw = booking.events;
    const eventRow = (Array.isArray(eventRaw) ? eventRaw[0] : eventRaw) as { date: string; title: string } | null;
    if (contact?.email) {
      const manageUrl = `${APP_URL}/book/bingo/manage-booking/${booking.id}`;

      const partySize = `${booking.group_size} ${booking.group_size === 1 ? "Person" : "People"}`;

      const slots = await renderTemplate(supabase, "booking.bingo.confirmed", {
        customerName: contact.full_name,
        eventTitle: eventRow?.title ?? "Music Bingo",
        eventDate: formatEventDate(eventRow?.date ?? null),
        groupName: contact.full_name,
        groupSize: partySize,
        bookingId: String(booking.id),
        contactEmail: await getContactEmail(),
      });

      if (slots) {
        const { subject, html } = buildBookingConfirmedEmail({
          slots,
          rows: [
            { label: "📅 Date", value: formatEventDate(eventRow?.date ?? null) },
            { label: "👥 People", value: partySize },
            { label: "💳 Paid", value: `£${(booking.total_amount ?? 0).toFixed(2)}` },
          ],
          manageUrl,
        });

        await getResend().emails.send({
          from: EMAIL_FROM,
          to: contact.email,
          subject,
          html,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
