import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { normalizeBookingConfig, type BookingConfig } from "@/lib/booking-config";
import ManageBookingView, { type ManageEventBooking } from "./_components/manage-booking-view";

export const metadata = {
  title: "Manage Booking | Don Fenticas",
};

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      id,
      event_id,
      group_name,
      group_size,
      status,
      payment_status,
      total_amount,
      paid_amount,
      special_requests,
      events!bookings_event_id_fkey (event_title: title, event_date: date, seating_required, booking_config),
      contacts!bookings_contact_id_fkey (full_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !booking) {
    notFound();
  }

  type EventRel = {
    event_title: string | null;
    event_date: string | null;
    seating_required: boolean | null;
    booking_config: BookingConfig | null;
  };

  const eventsRel = booking.events as EventRel | EventRel[] | null;
  const contactsRel = booking.contacts as ManageEventBooking["contacts"] | ManageEventBooking["contacts"][] | null;
  const ev = Array.isArray(eventsRel) ? eventsRel[0] ?? null : eventsRel;

  const normalised: ManageEventBooking = {
    id: booking.id,
    event_id: (booking.event_id as number | null) ?? null,
    group_name: booking.group_name,
    group_size: booking.group_size,
    status: booking.status,
    payment_status: booking.payment_status,
    total_amount: booking.total_amount,
    paid_amount: booking.paid_amount,
    special_requests: booking.special_requests,
    events: ev
      ? {
          event_title: ev.event_title,
          event_date: ev.event_date,
          seating_required: ev.seating_required,
        }
      : null,
    contacts: Array.isArray(contactsRel) ? contactsRel[0] ?? null : contactsRel,
  };

  const bookingFields = normalizeBookingConfig(ev?.booking_config).fields;

  const isCancelled = (booking.status || "").toLowerCase() === "cancelled";

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#26300D] text-[#fdcc4b] antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #26300D !important;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        main {
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
      `}} />

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-3 py-4 sm:px-6 sm:py-12">
        <div className="relative overflow-hidden rounded-2xl border border-[#fdcc4b]/20 bg-linear-to-b from-[#1e260a] to-[#151a07] p-4 shadow-2xl sm:rounded-3xl sm:p-10">
          <div className={`pointer-events-none absolute top-0 left-1/2 h-24 w-full max-w-md -translate-x-1/2 rounded-full blur-3xl ${isCancelled ? "bg-red-500/5" : "bg-[#fdcc4b]/5"}`} />
          <div className="relative z-10">
            <ManageBookingView
              booking={normalised}
              isCancelled={isCancelled}
              groupSizeField={bookingFields.group_size}
              groupNameField={bookingFields.group_name}
            />
          </div>
        </div>

        <div className="mt-6 pt-4 text-center opacity-30 sm:mt-auto">
          <p className="font-black text-[9px] tracking-[0.4em] uppercase">Don Fenticas</p>
        </div>
      </div>
    </main>
  );
}
