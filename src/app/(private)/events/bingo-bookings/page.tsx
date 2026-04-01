import { getBingoBookings } from "./actions";
import BingoBookingListClient from "./bingo-list-client";
import BookingCalendarFilter from "@/components/booking-calendar-filter";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BingoBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: selectedDate } = await searchParams;
  const bookings = await getBingoBookings(selectedDate ?? null);

  return (
    <div className="flex-1 bg-background min-h-screen relative overflow-hidden">
      <div className="fixed top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="p-3 md:p-8 max-w-7xl mx-auto space-y-5 text-left">

        {/* Calendar filter */}
        <div className="w-full bg-white rounded-2xl border border-[#E6DFC8] shadow-sm p-1.5 overflow-hidden">
          <BookingCalendarFilter selectedDate={selectedDate} />
        </div>

        {/* Date prompt */}
        {!selectedDate && (
          <div className="bg-white border-2 border-dashed border-[#E6DFC8] rounded-[2rem] p-6 flex flex-col items-center justify-center text-center gap-3 shadow-sm">
            <div className="p-3 bg-[#F7F4EA] rounded-2xl">
              <CalendarDays className="w-6 h-6 text-[#26300D] opacity-30" />
            </div>
            <p className="text-[10px] font-black uppercase text-[#5F624F] tracking-widest opacity-60 max-w-[200px] leading-relaxed">
              Select a date to filter bingo bookings
            </p>
          </div>
        )}

        {/* Booking list */}
        <div className="space-y-3 pt-2">
          <BingoBookingListClient bookings={bookings as BingoBooking[]} selectedDate={selectedDate} />
        </div>
      </div>
    </div>
  );
}

export interface BingoBooking {
  id: string;
  group_name?: string;
  group_size?: number;
  status?: string;
  payment_status?: string;
  paid_amount?: number;
  total_amount?: number;
  special_requests?: string;
  square_order_id?: string;
  booking_created_at?: string;
  contacts?: { full_name?: string; email?: string; country_code?: string; phone_no?: string };
  events?: { event_date?: string; event_title?: string; event_payment_amount?: number };
  booking_table_mappings?: { tables?: { tables_id?: string; tables_name?: string; tables_capacity?: number } }[];
}
