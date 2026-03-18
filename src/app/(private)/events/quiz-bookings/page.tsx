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

      <div className="p-2 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Calendar Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
          <BookingCalendarFilter selectedDate={selectedDate} />
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Daily Stat: Teams */}
          <StatCard
            label="Teams Today"
            value={quizBookings.length}
            icon={<Users className="w-4 h-4" />}
            subValue={selectedDate ? format(new Date(selectedDate), "MMM do") : "Total"}
          />

          {/* Daily Stat: Guests */}
          <StatCard
            label="Total Guests"
            value={currentTotalGuests}
            icon={<ArrowRightLeft className="w-4 h-4" />}
            subValue={`of ${totalMaxCapacity} cap.`}
          />

          {/* Conditional Stat: Tables (Only if date is selected) */}
          {selectedDate ? (
            <StatCard
              label="Free Tables"
              value={availableTables}
              icon={<LayoutDashboard className="w-4 h-4" />}
              subValue={`${tablesOccupied} / ${totalTablesCount} used`}
              color="primary"
            />
          ) : (
            <StatCard
              label="Table Count"
              value={totalTablesCount}
              icon={<LayoutDashboard className="w-4 h-4" />}
              subValue="Active assets"
            />
          )}

          {/* Global Stat: Quiz History */}
          <StatCard
            label="Quiz History"
            value={pastQuizzesCount}
            icon={<History className="w-4 h-4" />}
            subValue={`${upcomingQuizzesCount} scheduled`}
            color="amber"
          />
        </div>

        {/* Main List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Bookings Stream
            </h2>
          </div>

          <Suspense fallback={
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-slate-100" />
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
      "bg-white border rounded-2xl p-4 flex flex-col gap-1 shadow-sm transition-all",
      color === "primary" ? "border-primary/20 bg-primary/5" : "border-slate-100",
      color === "amber" ? "border-amber-200 bg-amber-50/50" : ""
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className={cn(
          "p-2 rounded-lg bg-slate-50 border border-slate-100",
          color === "primary" && "bg-primary/20 border-primary/20 text-primary",
          color === "amber" && "bg-amber-100 border-amber-200 text-amber-600"
        )}>
          {icon}
        </div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-slate-900 leading-none">{value}</span>
      </div>
      <span className="text-[10px] font-bold text-slate-400 truncate">{subValue}</span>
    </div>
  )
}