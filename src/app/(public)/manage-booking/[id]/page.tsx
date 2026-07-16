import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ManageBookingView, { type ManageEventBooking } from "./_components/manage-booking-view";

export const metadata = {
  title: "Manage Booking | Don Fenticas",
};

/**
 * Generic public manage page for event / general bookings (the flow that goes
 * through `createEventBooking`). Quiz and bingo have their own nested manage
 * pages under /book/{quiz,bingo}/manage-booking/[id]; this is the destination
 * the event confirmation emails and Square success page link to.
 */
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
      group_name,
      group_size,
      status,
      payment_status,
      total_amount,
      paid_amount,
      special_requests,
      events!bookings_event_id_fkey (event_title: title, event_date: date),
      contacts!bookings_contact_id_fkey (full_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !booking) {
    notFound();
  }

  // Supabase joins can return as object OR single-element array — normalise both.
  const eventsRel = booking.events as ManageEventBooking["events"] | ManageEventBooking["events"][] | null;
  const contactsRel = booking.contacts as ManageEventBooking["contacts"] | ManageEventBooking["contacts"][] | null;
  const normalised: ManageEventBooking = {
    ...booking,
    events: Array.isArray(eventsRel) ? eventsRel[0] ?? null : eventsRel,
    contacts: Array.isArray(contactsRel) ? contactsRel[0] ?? null : contactsRel,
  };

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
            <ManageBookingView booking={normalised} isCancelled={isCancelled} />
          </div>
        </div>

        <div className="mt-6 pt-4 text-center opacity-30 sm:mt-auto">
          <p className="font-black text-[9px] tracking-[0.4em] uppercase">Don Fenticas</p>
        </div>
      </div>
    </main>
  );
}
