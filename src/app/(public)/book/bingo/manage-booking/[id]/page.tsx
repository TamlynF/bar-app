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

  const raw = booking as Record<string, unknown>;
  const contacts = Array.isArray(raw.contacts) ? raw.contacts[0] : raw.contacts;
  const events = Array.isArray(raw.events) ? raw.events[0] : raw.events;

  const normalised: BingoManageBooking = {
    ...(raw as unknown as BingoManageBooking),
    contacts: contacts as BingoManageBooking["contacts"],
    events: events as BingoManageBooking["events"],
  };

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#26300D] text-[#fdcc4b] antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{
        __html: `html, body { background-color: #26300D !important; margin: 0; padding: 0; overflow-x: hidden; }`
      }} />

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-3 py-4 sm:px-6 sm:py-12">
        <div className="relative overflow-hidden rounded-2xl border border-[#fdcc4b]/20 bg-linear-to-b from-[#1e260a] to-[#151a07] p-4 shadow-2xl sm:rounded-3xl sm:p-10">
          <div className="pointer-events-none absolute top-0 left-1/2 h-24 w-full max-w-md -translate-x-1/2 rounded-full bg-[#fdcc4b]/5 blur-3xl" />
          <div className="relative z-10">
            <ManageBingoBooking booking={normalised} />
          </div>
        </div>

        <div className="mt-6 text-center opacity-30">
          <p className="font-black text-[9px] tracking-[0.4em] uppercase">Don Fenticas</p>
        </div>
      </div>
    </main>
  );
}
