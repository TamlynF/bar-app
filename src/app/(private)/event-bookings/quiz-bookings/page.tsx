import React, { Suspense } from "react";
import { getBookings, getAvailableTables, getQuizEvents } from "./actions";
import BookingListClient from "./components/booking-list-client";
import QuizEventFilter from "./components/quiz-event-filter";
import {
  Users,
  LayoutDashboard,
  CheckCircle2,
  Info,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  updated_at?: string | null;
  updated_by?: number | null;
  updated_by_employee?: { full_name: string; role: string | null } | null;
}

export const dynamic = 'force-dynamic';

export default async function QuizBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = params.date;

  const type = "games";
  const subType = "quiz";

  // 1. Fetch quiz events for the filter dropdown
  const quizEventsRaw = await getQuizEvents(type, subType);
  const quizEvents = (quizEventsRaw ?? []).map((e) => ({
    id: String(e.id),
    date: String(e.date),
    title: e.title ?? null,
  }));

  // 2. Fetch current bookings
  const allBookings = await getBookings(type, subType, selectedDate || null);
  const quizBookings = (allBookings as unknown as Booking[]) ?? [];

  // 2. Fetch all physical tables to calculate remaining space
  const allTablesRaw = await getAvailableTables();
  const allTables = allTablesRaw || [];

  // 3. Calculate free tables grouped by capacity for the selected date
  let availabilityBreakdown: { capacity: number; remaining: number }[] = [];
  
  if (selectedDate) {
    // Determine which tables are occupied for this specific event
    const occupiedTableIds = quizBookings
      .filter(b => b.status?.toLowerCase() === 'confirmed')
      .flatMap(b => b.booking_table_mappings?.map(m => String(m.tables?.tables_id)) || []);

    const freeTables = allTables.filter(t => !occupiedTableIds.includes(String(t.id)));
    
    // Group them by capacity
    const groups = freeTables.reduce((acc, t) => {
      const cap = t.max_capacity || 0;
      acc[cap] = (acc[cap] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    availabilityBreakdown = Object.entries(groups)
      .map(([cap, count]) => ({ capacity: Number(cap), remaining: count }))
      .sort((a, b) => a.capacity - b.capacity);
  }

  return (
    <div className="flex-1 bg-background min-h-screen relative overflow-hidden">
      {/* Visual background blurs */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="p-3 md:p-8 max-w-7xl mx-auto space-y-5 text-left">
        
        {/* Full-width Event Selection Section */}
        <div className="w-full bg-white rounded-2xl border border-[#E6DFC8] shadow-sm p-1.5">
          <QuizEventFilter events={quizEvents} selectedDate={selectedDate} />
        </div>

        {/* Dynamic Availability Section - Replaces individual StatCards on Mobile */}
        {selectedDate ? (
          <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-2 px-1">
              <div className="p-1 bg-[#26300D] rounded-md">
                <LayoutDashboard className="w-3 h-3 text-[#FDCC4B]" />
              </div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F]">
                Remaining Floor Capacity
              </h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {availabilityBreakdown.length > 0 ? (
                availabilityBreakdown.map((group) => (
                  <div key={group.capacity} className="bg-white border-2 border-[#E6DFC8] rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-sm hover:border-[#26300D]/30 transition-all">
                    <div className="flex items-center gap-1 text-[#5F624F] opacity-40 mb-1">
                      <Users className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase">Cap {group.capacity}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#1F1F1A] tabular-nums">{group.remaining}</span>
                      <span className="text-[8px] font-bold text-[#5F624F] uppercase opacity-60">Left</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full bg-[#26300D] text-white rounded-2xl p-4 flex items-center justify-center gap-3 shadow-lg border border-white/10">
                  <CheckCircle2 className="w-5 h-5 text-[#FDCC4B]" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Venue is Fully Booked</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-[#E6DFC8] rounded-[2rem] p-6 flex flex-col items-center justify-center text-center gap-3 shadow-sm">
             <div className="p-3 bg-[#F7F4EA] rounded-2xl">
               <CalendarDays className="w-6 h-6 text-[#26300D] opacity-30" />
             </div>
             <p className="text-[10px] font-black uppercase text-[#5F624F] tracking-widest opacity-60 max-w-[200px] leading-relaxed">
               Select a date to see grouping by table capacity
             </p>
          </div>
        )}

        {/* Main List Section */}
        <div className="space-y-3 pt-2">
          <Suspense fallback={
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-[#E6DFC8]/40" />
              ))}
            </div>
          }>
            <BookingListClient
              initialBookings={quizBookings}
              selectedDate={selectedDate}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
