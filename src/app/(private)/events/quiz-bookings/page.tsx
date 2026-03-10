import React, { Suspense } from "react";
import { getBookings } from "../../actions/booking-actions";
import BookingListClient from "../../dashboard/components/booking-list-client";
import BookingCalendarFilter from "@/components/booking-calendar-filter";
import { 
  Trophy, 
  Calendar as CalendarIcon, 
  Users, 
  Info, 
  History
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableRow {
  tables_id: string;
  tables_name?: string;
  tables_capacity?: number;
  tables_description?: string;
  tables_available?: boolean;
}
export interface EventType {
  category?: string;
  sub_type?: string;
}

export interface EventRow {
  event_date?: string;
  event_start_time?: string;
  event_end_time?: string;
  event_title?: string;
  event_description?: string;
  event_payment_amount?: number;
  event_types?: EventType;
}

export interface ContactRow {
  full_name?: string;
  email?: string;
  country_code?: string;
  phone_no?: string;
}

export interface Booking {
  id: string;
  event_id?: string;
  group_name?: string;
  team_id?: string;
  contact_id?: string;
  group_size?: number;
  paid_amount?: number;
  status?: string;
  special_requests?: string;
  booking_created_at?: string;
  contacts?: ContactRow;
  events?: EventRow;
  booking_table_mappings?: {
    tables?: TableRow;
  }[];
}

export const dynamic = 'force-dynamic';

/**
 * QuizBookingsPage
 * * A specialized version of the dashboard for managing Quiz Nights.
 * Filters the global bookings list to only show "quiz" subtype events.
 */
export default async function QuizBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = params.date;
  console.log("Quiz Bookings - Search Params:", params);

  const type = "game"; 
  const subType = "quiz"; 

  // Fetch all bookings for the selected date
  const allBookings = await getBookings(type, subType, selectedDate || null);
  const quizBookings = (allBookings as unknown as Booking[]) ?? [];
  const totalParticipants = quizBookings.reduce((acc, b) => acc + (b.group_size || 0), 0);

  // Filter for quiz subtype
  // Note: We filter by 'quiz' subtype as requested. 
  // We handle both direct subtype checks and checking associated event_types if available.
/*   const quizBookings = typedBookings.filter((booking: Booking) => {
    const isQuizSubtype = booking.events?.event_types?.sub_type === "quiz";
    const isQuizEvent = booking.events?.event_types?.sub_type?.toLowerCase().includes("quiz");
    return isQuizSubtype || isQuizEvent;
  }); */

  return (
 <div className="flex flex-col gap-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#26300D] rounded-3xl p-6 text-[#FDCC4B] shadow-xl flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <Trophy className="w-8 h-8 opacity-80" />
            <span className="bg-[#FDCC4B]/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-[#FDCC4B]">Live Feed</span>
          </div>
          <div>
            <h2 className="text-3xl font-black">{quizBookings.length}</h2>
            <p className="text-xs font-bold uppercase tracking-wider opacity-60 mt-1">Teams Scheduled</p>
          </div>
        </div>

        <div className="bg-white border border-[#E6DFC8] rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <Users className="w-8 h-8 text-[#26300D] opacity-40" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-[#1F1F1A]">{totalParticipants}</h2>
            <p className="text-xs font-bold uppercase tracking-wider text-[#5F624F] opacity-60 mt-1">Total Guests</p>
          </div>
        </div>

        <div className={cn(
          "rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[140px] transition-colors duration-500",
          selectedDate ? "bg-[#FDCC4B]" : "bg-blue-600 text-white"
        )}>
          <div className="flex justify-between items-start">
            {selectedDate ? <CalendarIcon className="w-8 h-8 text-[#26300D] opacity-40" /> : <History className="w-8 h-8 text-white opacity-40" />}
          </div>
          <div>
            <h2 className={cn(
              "text-lg font-black uppercase tracking-tighter leading-tight",
              selectedDate ? "text-[#26300D]" : "text-white"
            )}>
              {selectedDate 
                ? new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
                : "Full History"}
            </h2>
            <p className={cn(
              "text-xs font-bold uppercase tracking-wider opacity-60 mt-1",
              selectedDate ? "text-[#26300D]" : "text-white"
            )}>Viewing Mode</p>
          </div>
        </div>
      </div>

      {/* Filter Bar - Matches Dashboard style */}
      <div className="w-full">
          <BookingCalendarFilter selectedDate={selectedDate} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-xs uppercase tracking-[0.2em] text-[#1F1F1A]">
            {selectedDate ? "Event Entries" : "Historical Entries"}
          </h3>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-[#5F624F] uppercase bg-white px-3 py-1 rounded-full border border-[#E6DFC8]">
            <Info className="w-3 h-3" />
            {selectedDate ? `Showing ${quizBookings.length} teams for this date` : `Showing all ${quizBookings.length} lifetime bookings`}
          </div>
        </div>
        
        <Suspense fallback={<div className="h-64 bg-white rounded-3xl animate-pulse border border-[#E6DFC8]" />}>
          <BookingListClient initialBookings={quizBookings} />
        </Suspense>

        {quizBookings.length === 0 && (
          <div className="bg-white/50 border-2 border-dashed border-[#E6DFC8] rounded-3xl p-12 text-center">
            <Trophy className="w-12 h-12 text-[#E6DFC8] mx-auto mb-4 opacity-20" />
            <p className="font-black text-[#1F1F1A] uppercase tracking-tight">No Quiz Data</p>
            <p className="text-[10px] font-bold text-[#5F624F] mt-2 opacity-60 uppercase tracking-widest">
              No bookings found matching these criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}