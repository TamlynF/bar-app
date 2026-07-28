import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { settlePaidBooking } from "@/lib/settle-paid-booking";
import { createHmac, timingSafeEqual } from "crypto";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

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

  let event: { type: string; data?: { object?: { payment?: { id?: string; order_id?: string; amount_money?: { amount?: number } } } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "payment.completed") {
    return NextResponse.json({ received: true });
  }

  const orderId = event.data?.object?.payment?.order_id;
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

    const amountPaid = event.data?.object?.payment?.amount_money?.amount;
    const paymentId = event.data?.object?.payment?.id ?? null;

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
      const eventDate = eventRow?.date
        ? new Date(eventRow.date).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "TBC";

      const manageUrl = `${APP_URL}/book/bingo/manage-booking/${booking.id}`;
      await getResend().emails.send({
        from: "Don Fenticas <admin@bookingsdonfenticas.co.uk>",
        to: contact.email,
        subject: "Music Bingo Booking Confirmed! 🎵",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #111827;">You're in, ${contact.full_name}! 🎉</h2>
              <p>Your Music Bingo booking is confirmed and paid.</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>🎵 Event:</strong> ${eventRow?.title ?? "Music Bingo"}</p>
                <p><strong>📅 Date:</strong> ${eventDate}</p>
                <p><strong>👥 People:</strong> ${booking.group_size}</p>
                <p><strong>💳 Paid:</strong> £${(booking.total_amount ?? 0).toFixed(2)}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${manageUrl}" style="background-color: #fdcc4b; color: #26300d; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; text-transform: uppercase;">Manage Booking</a>
              </div>
              <p style="font-size: 12px; color: #6b7280; text-align: center;">
                If the button doesn't work, copy this link: ${manageUrl}
              </p>
              <p style="font-size: 13px; color: #6b7280;">
                Questions? Email us at admin@bookingsdonfenticas.co.uk
              </p>
            </div>
          </div>
        `,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
