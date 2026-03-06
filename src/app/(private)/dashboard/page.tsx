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
    <div className="flex-1 bg-[#1a2109] min-h-screen relative selection:bg-primary selection:text-primary-foreground">
      {/* Refined Ambient Glows */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Header - Compact for Mobile */}
      <header className="px-4 py-4 md:px-8 md:py-6 flex justify-between items-center sticky top-0 bg-[#1a2109]/90 backdrop-blur-md z-30 border-b border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner">
             <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg md:text-xl font-black text-white uppercase tracking-tight leading-none">Floor Manager</h1>
            <p className="text-[9px] font-black text-primary/60 uppercase tracking-[0.2em] mt-1">Don Fenticas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="icon" className="h-10 w-10 md:h-11 md:w-11 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10 transition-all">
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </Link>
          <Link href="/book" className="hidden sm:block">
            <Button className="h-10 md:h-11 rounded-xl font-black uppercase text-[10px] tracking-widest px-5">
              <Plus className="w-4 h-4 mr-2" /> New Booking
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {hasDataSourceError && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[10px] font-bold text-red-200 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live sync unavailable.
          </div>
        )}

        <Suspense fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />)}
            </div>
            <div className="h-64 bg-white/5 rounded-3xl animate-pulse" />
          </div>
        }>
          <BookingListClient initialBookings={typedBookings} />
        </Suspense>
      </div>

      {/* Floating Action Button - Mobile Only */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden">
        <Link href="/book">
          <Button size="lg" className="h-14 w-14 rounded-2xl shadow-2xl bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all border-2 border-white/20">
            <Plus className="w-6 h-6 stroke-3" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
