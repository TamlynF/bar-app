import React, { Suspense } from "react";
import { createClient } from "@/lib/supabase/server"
import BookingListClient, { Booking } from "./components/booking-list-client copy"
import { Settings, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let typedBookings: Booking[] = []
  let hasDataSourceError = false

  try {
    const supabase = await createClient()

    // Fetch all bookings with associated contact and event data
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
    <div className="flex-1 bg-[#26300D] min-h-screen relative">
      {/* Top Header */}
      <div className="px-6 pt-8 pb-4 flex justify-between items-center sticky top-0 bg-[#26300D]/90 backdrop-blur-md z-30 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Floor Manager</h1>
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Don Fenticas Venue</p>
        </div>

        <Link href="/dashboard/settings">
          <Button variant="outline" size="icon" className="rounded-full bg-white/5 border-white/10 text-white">
            <Settings className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      <div className="p-4 md:p-8">
        {hasDataSourceError && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-200 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Live data sync unavailable. Showing cached records.
          </div>
        )}

        <Suspense fallback={<div className="animate-pulse space-y-4 pt-10 px-4">
          <div className="h-24 bg-white/5 rounded-3xl" />
          <div className="h-64 bg-white/5 rounded-3xl" />
        </div>}>
          <BookingListClient initialBookings={typedBookings} />
        </Suspense>
      </div>

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-6 right-6 z-40 lg:hidden">
        <Link href="/book">
          <Button size="lg" className="h-16 w-16 rounded-full shadow-[0_10px_30px_-5px_rgba(253,204,75,0.5)] bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-transform">
            <Plus className="w-8 h-8 stroke-3" />
          </Button>
        </Link>
      </div>
    </div>
  )
}