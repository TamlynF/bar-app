import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ManageBingoBooking from "./_components/manage-bingo-booking";
import type { BingoManageBooking } from "./_components/manage-bingo-booking";

export const metadata = {
  title: "Manage Booking | Don Fenticas",
};

export default async function ManageBingoBookingPage({
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
      status,
      payment_status,
      paid_amount,
      total_amount,
      group_name,
      group_size,
      special_requests,
      square_order_id,
      contacts!bookings_contact_id_fkey(full_name, email),
      events!bookings_event_id_fkey(event_date: date, event_title: title),
      booking_table_mappings(
        tables(id, name, max_capacity)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !booking) notFound();

  // Normalise Supabase join shapes (may return array or object)
  const raw = booking as Record<string, unknown>;
  const contacts = Array.isArray(raw.contacts) ? raw.contacts[0] : raw.contacts;
  const events = Array.isArray(raw.events) ? raw.events[0] : raw.events;

  const normalised: BingoManageBooking = {
    ...(raw as unknown as BingoManageBooking),
    contacts: contacts as BingoManageBooking["contacts"],
    events: events as BingoManageBooking["events"],
  };

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#26300D] text-[#fdcc4b] flex flex-col selection:bg-[#fdcc4b] selection:text-[#26300D] antialiased">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`
      }} />

      <div className="flex-1 w-full max-w-xl mx-auto py-4 sm:py-12 px-3 sm:px-6 flex flex-col justify-center">
        <div className="bg-linear-to-b from-[#1e260a] to-[#151a07] rounded-2xl sm:rounded-3xl p-4 sm:p-10 border border-[#fdcc4b]/20 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-24 blur-3xl pointer-events-none rounded-full bg-[#fdcc4b]/5" />
          <div className="relative z-10">
            <ManageBingoBooking booking={normalised} />
          </div>
        </div>

        <div className="mt-6 text-center opacity-30">
          <p className="text-[9px] font-black uppercase tracking-[0.4em]">Don Fenticas</p>
        </div>
      </div>
    </main>
  );
}
