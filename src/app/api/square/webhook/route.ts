import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { settlePaidBooking } from "@/lib/settle-paid-booking";
import { manageBookingPath } from "@/lib/booking-links";
import { createHmac, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { buildBookingConfirmedEmail, formatEventDate } from "@/lib/booking-emails";
import { renderBookingTemplate } from "@/lib/email/booking-email-choice";
import { EMAIL_FROM } from "@/lib/email";
import { getContactEmail } from "@/lib/company-info";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATALOG_VERSION_EVENT, confirmCatalogWrite } from "@/lib/market/square-confirmation";
import { refreshSessionFromSquare } from "@/lib/market/session-square-refresh";
import { catalogCopiedWithin } from "@/lib/square-catalog-sync";
import { resendTemplateAttachments } from "@/lib/email/correspondence-data";
import { settleHireDeposit, settleHireRefund } from "@/lib/private-hire-flow";

/* Every market price push fires this webhook too, so a live market would
   otherwise re-copy the whole catalog after each re-rank, competing with its
   own next write. One refresh per window is plenty for staff edits. */
const CATALOG_REFRESH_WINDOW_MS = 3 * 60 * 1000;

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

type SquareRefund = {
  id?: string;
  status?: string;
  reason?: string;
};

const PAYMENT_EVENT_TYPES = new Set(["payment.created", "payment.updated"]);
const REFUND_EVENT_TYPES = new Set(["refund.created", "refund.updated"]);

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
      if (!isValid) {
        console.error("[square] signature mismatch, signed against:", WEBHOOK_URL);
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch {
      console.error("[square] signature length mismatch, signed against:", WEBHOOK_URL);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: { type: string; data?: { object?: { payment?: SquarePayment; refund?: SquareRefund } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type === CATALOG_VERSION_EVENT) {
    const admin = createAdminClient();
    try {
      await confirmCatalogWrite(admin);
    } catch (err) {
      console.error("[market] catalog confirmation failed:", err);
    }
    try {
      const { data: live } = await admin.from("market_sessions").select("id").eq("status", "live").maybeSingle();
      if (live && !(await catalogCopiedWithin(admin, CATALOG_REFRESH_WINDOW_MS))) {
        await refreshSessionFromSquare(admin, live.id as number, { requireSquare: true });
      }
    } catch (err) {
      console.error("[market] catalog refresh failed:", err);
    }
    return NextResponse.json({ received: true });
  }

  if (REFUND_EVENT_TYPES.has(event.type)) {
    const refund = event.data?.object?.refund;
    if (refund?.id) {
      try {
        await settleHireRefund(
          { supabase: createAdminClient(), resend: getResend(), actorId: null },
          refund.id,
          refund.status
        );
      } catch (err) {
        console.error("[square] refund webhook failed:", err);
      }
    }
    return NextResponse.json({ received: true });
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
        id, event_id, status, payment_status, group_name, group_size, total_amount,
        contacts!bookings_contact_id_fkey(full_name, email),
        events!bookings_event_id_fkey(date, title)
      `)
      .eq("square_order_id", orderId)
      .maybeSingle();

    const amountPaid = payment.amount_money?.amount;
    const paymentId = payment.id ?? null;

    /* Not a ticket order - it may be a private hire deposit. */
    if (!booking) {
      await settleHireDeposit(
        { supabase: createAdminClient(), resend: getResend(), actorId: null },
        orderId,
        typeof amountPaid === "number" ? amountPaid : null,
        paymentId
      );
      return NextResponse.json({ received: true });
    }

    if (booking.payment_status === "paid") {
      return NextResponse.json({ received: true });
    }

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
      const manageUrl = `${APP_URL}${manageBookingPath(booking.id)}`;

      const partySize = `${booking.group_size} ${booking.group_size === 1 ? "Person" : "People"}`;

      const slots = await renderBookingTemplate(supabase, "booking.event.confirmed", booking.event_id, {
        customerName: contact.full_name,
        eventTitle: eventRow?.title ?? "Event",
        eventDate: formatEventDate(eventRow?.date ?? null),
        groupName: booking.group_name ?? "",
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
          ...(await resendTemplateAttachments(slots)),
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
