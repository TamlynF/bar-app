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
import { format } from "date-fns";

export interface TableRow {
  tables_id: string;
  tables_name?: string;
  tables_capacity?: number;
  tables_description?: string;
  tables_available?: boolean;
}

export interface ScoreRow {
  score: number;
  is_winner: boolean;
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
  booking_scores?: ScoreRow[];
}

export const dynamic = 'force-dynamic';

export default async function QuizBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = params.date;

  const type = "game"; 
  const subType = "quiz"; 

  const allBookings = await getBookings(type, subType, selectedDate || null);
  const quizBookings = (allBookings as unknown as Booking[]) ?? [];
  const totalParticipants = quizBookings.reduce((acc, b) => acc + (Number(b.group_size) || 0), 0);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* REFINED STATS GRID 
          Designed for better mobile information density. 
          Changed from stacking vertically to a 3-column row to keep content "above the fold".
      */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 px-1 sm:px-0">
        <div className="bg-[#26300D] rounded-2xl sm:rounded-3xl p-3 sm:p-6 text-[#FDCC4B] shadow-lg flex flex-col justify-between min-h-[90px] sm:min-h-[140px]">
          <Trophy className="w-5 h-5 sm:w-8 sm:h-8 opacity-80" />
          <div>
            <h2 className="text-xl sm:text-3xl font-black leading-none">{quizBookings.length}</h2>
            <p className="text-[8px] sm:text-xs font-bold uppercase tracking-wider opacity-60 mt-1">Teams</p>
          </div>
        </div>

        <div className="bg-white border border-[#E6DFC8] rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-sm flex flex-col justify-between min-h-[90px] sm:min-h-[140px]">
          <Users className="w-5 h-5 sm:w-8 sm:h-8 text-[#26300D] opacity-40" />
          <div>
            <h2 className="text-xl sm:text-3xl font-black text-[#1F1F1A] leading-none">{totalParticipants}</h2>
            <p className="text-[8px] sm:text-xs font-bold uppercase tracking-wider text-[#5F624F] opacity-60 mt-1">Guests</p>
          </div>
        </div>

        <div className={cn(
          "rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-sm flex flex-col justify-between min-h-[90px] sm:min-h-[140px] transition-colors duration-500",
          selectedDate ? "bg-[#FDCC4B]" : "bg-blue-600 text-white"
        )}>
          {selectedDate 
            ? <CalendarIcon className="w-5 h-5 sm:w-8 sm:h-8 text-[#26300D] opacity-40" /> 
            : <History className="w-5 h-5 sm:w-8 sm:h-8 text-white opacity-40" />
          }
          <div className="min-w-0">
            <h2 className={cn(
              "text-[10px] sm:text-lg font-black uppercase tracking-tighter leading-tight truncate",
              selectedDate ? "text-[#26300D]" : "text-white"
            )}>
              {selectedDate 
                ? format(new Date(selectedDate), "do MMM")
                : "History"}
            </h2>
            <p className={cn(
              "text-[8px] sm:text-xs font-bold uppercase tracking-wider opacity-60 mt-0.5 sm:mt-1",
              selectedDate ? "text-[#26300D]" : "text-white"
            )}>View</p>
          </div>
        </div>
      </div>

      {/* Filter Bar - Matches Dashboard style */}
      <div className="w-full">
          <BookingCalendarFilter selectedDate={selectedDate} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] text-[#1F1F1A]">
            {selectedDate ? "Event Entries" : "Historical Entries"}
          </h3>
          {quizBookings.length > 0 && (
            <div className="flex items-center gap-2 text-[9px] font-bold text-[#5F624F] uppercase bg-white/50 px-3 py-1 rounded-full border border-[#E6DFC8]">
              <Info className="w-3 h-3" />
              <span>{quizBookings.length} results</span>
            </div>
          )}
        </div>
        
        {/* The interactive list component which handles searching and status filtering */}
        <Suspense fallback={
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-[#E6DFC8]" />
            ))}
          </div>
        }>
          <BookingListClient
            initialBookings={quizBookings}
          />
        </Suspense>

        {/* Empty state for cases with no matching bookings */}
        {quizBookings.length === 0 && (
          <div className="bg-white/30 border-2 border-dashed border-[#E6DFC8] rounded-[2.5rem] py-16 text-center">
            <div className="w-16 h-16 bg-[#E6DFC8]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-[#E6DFC8]" />
            </div>
            <p className="font-bold text-[#1F1F1A] uppercase tracking-tight text-sm">No Quiz Bookings Found</p>
            <p className="text-[10px] font-medium text-[#5F624F] mt-2 uppercase tracking-widest opacity-60">
              Try selecting a different date or clearing filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}