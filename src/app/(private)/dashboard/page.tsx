import React, { Suspense } from "react";
import { createClient } from "@/lib/supabase/server"
import BookingListClient, { Booking } from "./components/booking-list-client-opy"
import { Settings, Plus, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let typedBookings: Booking[] = []
  let hasDataSourceError = false

  try {
    const supabase = await createClient()
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
        events(
          event_date: date,
          event_title: title,
          description,
          payment_amount,
          event_types(
            category: type,
            sub_type
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching bookings:", error)
      hasDataSourceError = true
    }
    typedBookings = (bookings as unknown as Booking[]) ?? []
  } catch (error) {
    console.error("Dashboard data source unavailable:", error)
    hasDataSourceError = true
  }

  return (
    <div className="flex-1 bg-[#141a07] min-h-screen relative selection:bg-primary selection:text-primary-foreground">
      {/* Background Ambient Glows */}
      <div className="fixed top-0 right-0 w-125 h-125 bg-primary/5 blur-[150px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-100 h-100 bg-primary/3 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Header */}
      <div className="px-6 py-8 flex justify-between items-center sticky top-0 bg-[#141a07]/80 backdrop-blur-xl z-30 border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
             <LayoutDashboard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight leading-none">Floor Manager</h1>
            <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.3em] mt-1.5">Don Fenticas Venue</p>
          </div>
        </div>

        <Link href="/dashboard/settings">
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-primary/30 transition-all">
            <Settings className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      <div className="p-4 md:p-10 max-w-7xl mx-auto">
        {hasDataSourceError && (
          <div className="mb-8 rounded-4xl border border-amber-500/20 bg-amber-500/10 p-5 text-xs font-bold text-amber-200 flex items-center gap-3 animate-in slide-in-from-top-4">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            Live data sync unavailable. Displaying local cache.
          </div>
        )}

        <Suspense fallback={
          <div className="space-y-6 pt-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/5 rounded-4xl animate-pulse" />)}
            </div>
            <div className="h-96 bg-white/5 rounded-[3rem] animate-pulse" />
          </div>
        }>
          <BookingListClient initialBookings={typedBookings} />
        </Suspense>
      </div>

      {/* Fixed Action Button */}
      <div className="fixed bottom-8 right-8 z-40 lg:hidden group">
        <div className="absolute inset-0 bg-primary blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
        <Link href="/book">
          <Button size="lg" className="h-16 w-16 rounded-4xl shadow-2xl bg-primary text-primary-foreground hover:scale-110 active:scale-90 transition-all border-4 border-[#0f1405]">
            <Plus className="w-8 h-8 stroke-3" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
