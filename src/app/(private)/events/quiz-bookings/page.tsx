import React, { Suspense } from "react";
import { getBookings, getAvailableTables, getQuizEvents } from "../../actions/booking-actions";
import BookingListClient from "../../dashboard/components/booking-list-client";
import BookingCalendarFilter from "@/components/booking-calendar-filter";
import {
  Users,
  ArrowRightLeft,
  LayoutDashboard,
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

  const currentTotalGuests = quizBookings.reduce((sum, b) => sum + (b.group_size || 0), 0)
  const confirmedBookings = quizBookings.filter(b => b.status?.toLowerCase() === 'confirmed')
  const tablesOccupied = confirmedBookings.length
  const availableTables = totalTablesCount - tablesOccupied

  return (
    <div className="flex-1 bg-background min-h-screen relative overflow-hidden">
      {/* Visual Background Elements */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="p-3 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Date Selection - Full Width on Mobile */}
        <div className="w-full bg-white rounded-2xl border border-[#E6DFC8] shadow-sm p-1 sm:p-2">
          <BookingCalendarFilter selectedDate={selectedDate} />
        </div>

        {/* Statistics Bar - Single Row on Mobile */}
        <div className="grid grid-cols-2 gap-3">
          {/* Guest Count Card */}
          <StatCard
            label="Guest Count"
            value={currentTotalGuests}
            icon={<Users className="w-3.5 h-3.5" />}
            subValue={`of ${totalMaxCapacity} Max`}
            color="info"
          />

          {/* Available Tables Card */}
          <StatCard
            label="Free Tables"
            value={`${availableTables}/${totalTablesCount}`}
            icon={<LayoutDashboard className="w-3.5 h-3.5" />}
            subValue={selectedDate ? format(new Date(selectedDate), "do MMM") : "Live Floor"}
            color="success"
          />
        </div>

        {/* Main List Section */}
        <div className="space-y-3">
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
  color?: "default" | "info" | "success" | "amber"
}) {
  // Explicitly defined classes to ensure background colors are applied correctly
  const themeClasses = {
    default: "border-slate-100 bg-white",
    info: "border-blue-100 bg-blue-50/50",
    success: "border-emerald-100 bg-emerald-50/50",
    amber: "border-amber-100 bg-amber-50/50",
  };

  const iconClasses = {
    default: "text-slate-400",
    info: "text-blue-600",
    success: "text-emerald-600",
    amber: "text-amber-600",
  };

  return (
    <div className={cn(
      "border rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-sm min-h-[85px] transition-colors text-left",
      themeClasses[color]
    )}>
      {/* Top Section: Icon & Label */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none">
          {label}
        </span>
        <div className={cn("shrink-0 p-1 rounded-lg bg-white/80 border border-white/50 shadow-xs", iconClasses[color])}>
          {icon}
        </div>
      </div>
      
      {/* Bottom Section: Value & Subtext */}
      <div className="mt-2">
        <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none tracking-tighter">
          {value}
        </div>
        <div className="text-[8px] font-bold text-slate-400/90 mt-1 uppercase tracking-widest leading-none truncate">
          {subValue}
        </div>
      </div>
    </div>
  )
}
