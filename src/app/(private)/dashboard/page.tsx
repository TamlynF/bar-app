import React, { Suspense } from "react";
import { createClient } from "../../../lib/supabase/server"
import BookingListClient from "../events/quiz-bookings/components/booking-list-client"
import { Booking } from "../events/quiz-bookings/page"
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Plus, CheckCircle2, Clock3, Users, AlertTriangle } from "lucide-react";
import { StatCard } from "./components/stat-card";
import { PendingReviews } from "./components/pending-reviews";
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from "date-fns";

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let typedBookings: Booking[] = []
  let pendingBand: { id: string; name: string; email: string; created_at: string }[] = [];
  let pendingPrivate: { id: string; name: string; email: string; created_at: string }[] = [];

  try {
    const supabase = await createClient()

    // Fetch quiz bookings
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
          id,
          event_id,
          group_name,
          team_id,
          contact_id,
          group_size,
          paid_amount,
          total_amount,
          status,
          special_requests,
          booking_created_at: created_at,
          contacts(
            full_name,
            email,
            country_code,
            phone_no
          ),
          events!inner(
            event_date: date,
            event_start_time: start_time,
            event_end_time: end_time,
            event_title: title,
            event_description: description,
            event_payment_amount: payment_amount,
            event_types!inner(
              category: type,
              sub_type
            )
          ),
          booking_table_mappings(
            tables(
              tables_id: id,
              tables_name: name,
              tables_capacity: max_capacity,
              tables_description: description,
              tables_available: available
            )
          )
        `)
      .order('created_at', { ascending: false });

    if (error) console.error("Error fetching bookings:", error)
    typedBookings = (bookings as unknown as Booking[]) ?? []

    // Fetch pending band applications
    const { data: bandPending } = await supabase
      .from("band_booking_requests")
      .select("id, booker_name, email, created_at")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });

    pendingBand = (bandPending ?? []).map((r) => ({
      id: r.id,
      name: r.booker_name,
      email: r.email,
      created_at: r.created_at,
    }));

    // Fetch pending private hire
    const { data: privatePending } = await supabase
      .from("private_hire_requests")
      .select("id, full_name, email, created_at")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });

    pendingPrivate = (privatePending ?? []).map((r) => ({
      id: r.id,
      name: r.full_name,
      email: r.email,
      created_at: r.created_at,
    }));

  } catch (error) {
    console.error("Dashboard data source unavailable:", error)
  }

  // Calculate stats
  const now = new Date();
  const weekInterval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };

  const confirmedThisWeek = typedBookings.filter((b) => {
    if (b.status !== "confirmed") return false;
    try {
      const date = parseISO((b as unknown as { booking_created_at: string }).booking_created_at);
      return isWithinInterval(date, weekInterval);
    } catch { return false; }
  }).length;

  const waitlisted = typedBookings.filter((b) => b.status === "waitlisted").length;
  const totalPending = pendingBand.length + pendingPrivate.length;

  const pendingItems = [
    ...pendingBand.map((b) => ({ ...b, type: "band" as const })),
    ...pendingPrivate.map((b) => ({ ...b, type: "private" as const })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="flex-1 bg-background min-h-screen relative selection:bg-primary selection:text-primary-foreground">
      <div className="fixed top-0 right-0 w-96 h-96 bg-accent/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-accent/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 text-left">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Confirmed This Week"
            value={confirmedThisWeek}
            icon={CheckCircle2}
            accent="#16a34a"
          />
          <StatCard
            label="Needs Review"
            value={totalPending}
            icon={Clock3}
            accent="#d97706"
            urgent={totalPending > 0}
          />
          <StatCard
            label="Waitlisted"
            value={waitlisted}
            icon={AlertTriangle}
            accent="#7c3aed"
          />
          <StatCard
            label="Total Bookings"
            value={typedBookings.filter((b) => b.status !== "cancelled").length}
            icon={Users}
            accent="#26300D"
          />
        </div>

        {/* Pending Reviews Banner */}
        <PendingReviews items={pendingItems} />

        {/* Booking List */}
        <Suspense fallback={<div className="h-64 bg-card rounded-2xl animate-pulse" />}>
          <BookingListClient initialBookings={typedBookings} />
        </Suspense>
      </div>

      {/* Floating Action Button - Mobile Only */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden">
        <Link href="/book/quiz">
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all flex items-center justify-center border-2 border-[#FDCC4B]/20">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
