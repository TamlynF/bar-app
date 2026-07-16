import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

async function confirmAndNotify(bookingId: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id, status, payment_status, group_name, group_size, total_amount, square_order_id,
      contacts!bookings_contact_id_fkey(full_name, email),
      events!bookings_event_id_fkey(date, title)
    `)
    .eq("id", bookingId)
    .maybeSingle();
console.log("Booking fetcheddd:", booking);
  if (!booking) {
    console.log("Booking not found for ID:", bookingId);
    return { status: "not_found" as const };
  }
  if (booking.payment_status === "paid") {
    console.log("Booking already paid for ID:", bookingId);
    return { status: "already_paid" as const, booking };
  }

  if (!booking.square_order_id) {
    console.log("Booking has no Square order ID:", bookingId);
    return { status: "pending" as const, booking };
  }
  try {
    // Verify order is completed
    const { order } = await squareClient.orders.get({ orderId: booking.square_order_id });
    console.log("order fetched from Square:", order);

    // Check tenders instead of order.state — tenders are added when payment is applied,
    // but order.state may still be OPEN at redirect time (Square updates it asynchronously)
    const tender = order?.tenders?.[0];
    if (!tender) {
      console.log("No tenders found — payment not yet applied for booking ID:", bookingId);
      return { status: "pending" as const, booking };
    }

    // Extract payment ID from the order's tenders (tender.id === payment ID)
    const squarePaymentId = tender?.id ?? null;
    const paidAmount = tender?.amountMoney?.amount
      ? Number(tender.amountMoney.amount) / 100
      : (booking.total_amount ?? 0);

    // Update booking
    await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        status: booking.status === "pending" ? "confirmed" : booking.status,
        paid_amount: paidAmount,
        square_payment_id: squarePaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);


    // Send confirmation email
    const contactRaw = booking.contacts;
    const contact = (Array.isArray(contactRaw) ? contactRaw[0] : contactRaw) as { full_name: string; email: string } | null;
    const eventRaw = booking.events;
    const event = (Array.isArray(eventRaw) ? eventRaw[0] : eventRaw) as { date: string; title: string } | null;
    if (contact?.email) {
      const eventDate = event?.date
        ? new Date(event.date).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "TBC";

      const manageUrl = `${appUrl}/book/bingo/manage-booking/${booking.id}`;
      await resend.emails.send({
        from: "Don Fenticas <admin@bookingsdonfenticas.co.uk>",
        to: contact.email,
        subject: "Music Bingo Booking Confirmed! 🎵",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #111827;">You're in, ${contact.full_name}! 🎉</h2>
              <p>Your Music Bingo booking is confirmed and paid. See you there!</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>🎵 Event:</strong> ${event?.title ?? "Music Bingo"}</p>
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
                Questions? Contact us at admin@bookingsdonfenticas.co.uk
              </p>
            </div>
          </div>
        `,
      }).catch(() => {});
    }

    return { status: "paid" as const, booking };
  } catch (err) {
    console.error("Square order check failed:", err);
    return { status: "pending" as const, booking };
  }
}

export default async function BingoSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const { bookingId } = await searchParams;

  if (!bookingId) {
    return <ErrorPage message="No booking reference found." />;
  }

  const result = await confirmAndNotify(bookingId);

  if (result.status === "not_found") {
    return <ErrorPage message="Booking not found. Please contact us." />;
  }

  const booking = result.booking!;
  const contactRaw2 = booking.contacts;
  const contact = (Array.isArray(contactRaw2) ? contactRaw2[0] : contactRaw2) as { full_name: string; email: string } | null;
  const eventRaw2 = booking.events;
  const event = (Array.isArray(eventRaw2) ? eventRaw2[0] : eventRaw2) as { date: string; title: string } | null;
  const eventDate = event?.date
    ? new Date(event.date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "TBC";

  if (result.status === "pending") {
    return (
      <StatusPage
        icon={<Clock className="h-10 w-10 text-amber-500" />}
        color="amber"
        title="Payment Processing"
        message="Your payment is being processed. You'll receive a confirmation email shortly. If you have any issues, please contact us."
        eventDate={eventDate}
        groupSize={booking.group_size}
        name={contact?.full_name}
        total={booking.total_amount}
      />
    );
  }

  return (
    <StatusPage
      icon={<CheckCircle2 className="h-10 w-10 text-green-500" />}
      color="green"
      title="Booking Confirmed!"
      message={`You're all set${contact?.full_name ? `, ${contact.full_name}` : ""}! A confirmation has been sent to ${contact?.email ?? "your email"}.`}
      eventDate={eventDate}
      groupSize={booking.group_size}
      name={contact?.full_name}
      total={booking.total_amount}
    />
  );
}

function StatusPage({
  icon,
  color,
  title,
  message,
  eventDate,
  groupSize,
  total,
}: {
  icon: React.ReactNode;
  color: "green" | "amber";
  title: string;
  message: string;
  eventDate: string;
  groupSize?: number;
  name?: string;
  total?: number | null;
}) {
  const borderColor = color === "green" ? "border-green-200" : "border-amber-200";
  const bgColor = color === "green" ? "bg-green-50" : "bg-amber-50";

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#26300D] px-4 py-12">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; }`
      }} />
      <div className="w-full max-w-md rounded-3xl bg-[#F7F4EA] p-8 text-center shadow-2xl shadow-black/40">
        <div className={`inline-flex h-20 w-20 items-center justify-center rounded-full border-2 ${bgColor} ${borderColor} mb-6`}>
          {icon}
        </div>
        <h1 className="mb-3 font-black text-2xl tracking-tight text-[#1F1F1A] uppercase">
          {title}
        </h1>
        <p className="mb-6 text-sm leading-relaxed font-medium text-[#5F624F]">
          {message}
        </p>

        <div className="mb-6 divide-y-2 divide-[#E6DFC8] rounded-2xl border-2 border-[#E6DFC8] bg-white text-left">
          <div className="px-5 py-3.5">
            <p className="mb-0.5 font-black text-[10px] tracking-widest text-[#5F624F] uppercase">Event</p>
            <p className="font-black text-sm text-[#1F1F1A]">Music Bingo</p>
          </div>
          <div className="px-5 py-3.5">
            <p className="mb-0.5 font-black text-[10px] tracking-widest text-[#5F624F] uppercase">Date</p>
            <p className="font-black text-sm text-[#1F1F1A]">{eventDate}</p>
          </div>
          {groupSize && (
            <div className="px-5 py-3.5">
              <p className="mb-0.5 font-black text-[10px] tracking-widest text-[#5F624F] uppercase">People</p>
              <p className="font-black text-sm text-[#1F1F1A]">{groupSize}</p>
            </div>
          )}
          {total != null && (
            <div className="px-5 py-3.5">
              <p className="mb-0.5 font-black text-[10px] tracking-widest text-[#5F624F] uppercase">Paid</p>
              <p className="font-black text-sm text-[#1F1F1A]">£{total.toFixed(2)}</p>
            </div>
          )}
        </div>

        <Link
          href="/book"
          className="inline-block h-14 w-full rounded-2xl bg-[#26300D] text-center font-black text-[11px] leading-14 tracking-widest text-[#FDCC4B] uppercase shadow-lg"
        >
          Back to Bookings
        </Link>
      </div>
    </main>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#26300D] px-4 py-12">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; }`
      }} />
      <div className="w-full max-w-md rounded-3xl bg-[#F7F4EA] p-8 text-center shadow-2xl">
        <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h1 className="mb-3 font-black text-xl tracking-tight text-[#1F1F1A] uppercase">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm font-medium text-[#5F624F]">{message}</p>
        <Link
          href="/book/bingo"
          className="inline-block h-14 w-full rounded-2xl bg-[#26300D] text-center font-black text-[11px] leading-14 tracking-widest text-[#FDCC4B] uppercase"
        >
          Try Again
        </Link>
      </div>
    </main>
  );
}
