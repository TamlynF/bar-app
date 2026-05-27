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
      contacts(full_name, email),
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
        icon={<Clock className="w-10 h-10 text-amber-500" />}
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
      icon={<CheckCircle2 className="w-10 h-10 text-green-500" />}
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
    <main className="min-h-dvh w-full bg-[#26300D] flex flex-col items-center justify-center px-4 py-12">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; }`
      }} />
      <div className="w-full max-w-md bg-[#F7F4EA] rounded-3xl p-8 shadow-2xl shadow-black/40 text-center">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full border-2 ${bgColor} ${borderColor} mb-6`}>
          {icon}
        </div>
        <h1 className="text-2xl font-black text-[#1F1F1A] uppercase tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-sm text-[#5F624F] font-medium leading-relaxed mb-6">
          {message}
        </p>

        <div className="bg-white border-2 border-[#E6DFC8] rounded-2xl divide-y-2 divide-[#E6DFC8] text-left mb-6">
          <div className="px-5 py-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-0.5">Event</p>
            <p className="text-sm font-black text-[#1F1F1A]">Music Bingo</p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-0.5">Date</p>
            <p className="text-sm font-black text-[#1F1F1A]">{eventDate}</p>
          </div>
          {groupSize && (
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-0.5">People</p>
              <p className="text-sm font-black text-[#1F1F1A]">{groupSize}</p>
            </div>
          )}
          {total != null && (
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] mb-0.5">Paid</p>
              <p className="text-sm font-black text-[#1F1F1A]">£{total.toFixed(2)}</p>
            </div>
          )}
        </div>

        <Link
          href="/book"
          className="inline-block w-full h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[11px] leading-[3.5rem] text-center shadow-lg"
        >
          Back to Bookings
        </Link>
      </div>
    </main>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <main className="min-h-dvh w-full bg-[#26300D] flex flex-col items-center justify-center px-4 py-12">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; }`
      }} />
      <div className="w-full max-w-md bg-[#F7F4EA] rounded-3xl p-8 shadow-2xl text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-black text-[#1F1F1A] uppercase tracking-tight mb-3">
          Something went wrong
        </h1>
        <p className="text-sm text-[#5F624F] font-medium mb-6">{message}</p>
        <Link
          href="/book/bingo"
          className="inline-block w-full h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[11px] leading-[3.5rem] text-center"
        >
          Try Again
        </Link>
      </div>
    </main>
  );
}
