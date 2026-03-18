import React, { Suspense } from "react";
import { getBookings, getAvailableTables, getQuizEvents } from "../../actions/booking-actions";
import BookingListClient from "../../dashboard/components/booking-list-client";
import BookingCalendarFilter from "@/components/booking-calendar-filter";
import {
  Users,
  Trophy,
  CalendarDays,
  ChevronRight,
  Plus,
  ArrowRightLeft,
  LayoutDashboard,
  History,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isBefore, startOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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

  const tables = await getAvailableTables();
  const totalTablesCount = tables?.length || 0;
  const totalMaxCapacity = tables?.reduce((acc, t) => acc + (t.max_capacity || 0), 0) || 0;

  const quizEvents = await getQuizEvents(type, subType);
  let pastQuizzesCount = 0;
  let upcomingQuizzesCount = 0;
  if (quizEvents) {
    const today = startOfDay(new Date())
    quizEvents.forEach(e => {
      const eventDate = startOfDay(new Date(e.date))
      if (isBefore(eventDate, today)) pastQuizzesCount++
      else upcomingQuizzesCount++
    })
  }
  const totalParticipants = quizBookings.reduce((acc, b) => acc + (Number(b.group_size) || 0), 0);

  const currentTotalGuests = quizBookings.reduce((sum, b) => sum + (b.group_size || 0), 0)
  const confirmedBookings = quizBookings.filter(b => b.status?.toLowerCase() === 'confirmed')
  const tablesOccupied = confirmedBookings.length
  const availableTables = totalTablesCount - tablesOccupied

  return (
    <div className="flex-1 bg-background min-h-screen relative overflow-hidden">
      {/* Visual Background Elements */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Increased max-width to 7xl to allow components to utilize more horizontal space */}
      <div className="p-1 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Calendar Filter - Compact padding on mobile */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 sm:p-2">
          <BookingCalendarFilter selectedDate={selectedDate} />
        </div>

        {/* Statistics Grid - Tighter gap on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <StatCard
            label="Teams"
            value={quizBookings.length}
            icon={<Users className="w-3.5 h-3.5" />}
            subValue={selectedDate ? format(new Date(selectedDate), "MMM do") : "Lifetime"}
          />

          {/* Daily Stat: Guests */}
          <StatCard
            label="Guests"
            value={currentTotalGuests}
            icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
            subValue={`of ${totalMaxCapacity} max`}
          />

          {/* Conditional Stat: Tables (Only if date is selected) */}
          {selectedDate ? (
            <StatCard
              label="Available"
              value={availableTables}
              icon={<LayoutDashboard className="w-3.5 h-3.5" />}
              subValue={`${tablesOccupied}/${totalTablesCount} used`}
              color="primary"
            />
          ) : (
            <StatCard
              label="Tables"
              value={totalTablesCount}
              icon={<LayoutDashboard className="w-3.5 h-3.5" />}
              subValue="Total assets"
            />
          )}

          {/* Global Stat: Quiz History */}
          <StatCard
            label="History"
            value={pastQuizzesCount}
            icon={<History className="w-3.5 h-3.5" />}
            subValue={`${upcomingQuizzesCount} upcoming`}
            color="amber"
          />
        </div>

        {/* Main List Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Timer className="w-3 h-3" />
              Bookings Stream
            </h2>
          </div>

          <Suspense fallback={
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-slate-100" />
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

function StatCard({
  label,
  value,
  icon,
  subValue,
  color = "default"
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subValue: string;
  color?: "default" | "primary" | "amber"
}) {
  return (
    <div className={cn(
      "bg-white border rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col gap-1 shadow-sm transition-all overflow-hidden",
      color === "primary" ? "border-primary/20 bg-primary/[0.02]" : "border-slate-100",
      color === "amber" ? "border-amber-200 bg-amber-50/30" : ""
    )}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate mr-1">
          {label}
        </span>
        <div className={cn(
          "p-1.5 rounded-lg shrink-0",
          color === "primary" ? "bg-primary/10 text-primary" : 
          color === "amber" ? "bg-amber-100 text-amber-600" : 
          "bg-slate-50 text-slate-400 border border-slate-100/50"
        )}>
          {icon}
        </div>
      </div>
      
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">
          {value}
        </span>
      </div>
      
      <div className="flex items-center">
        <span className="text-[9px] font-bold text-slate-400/80 uppercase truncate leading-none">
          {subValue}
        </span>
      </div>
    </div>
  )
}