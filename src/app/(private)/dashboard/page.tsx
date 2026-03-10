import React, { Suspense } from "react";
import { createClient } from "@/lib/supabase/server"
import BookingListClient, { Booking } from "./components/booking-list-client"
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
    <div className="flex-1 bg-background min-h-screen relative selection:bg-primary selection:text-primary-foreground">
      {/* Refined Ambient Glows - Made subtle for a professional look */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-accent/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-accent/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Header - Clean and crisp */}
      {/* <header className="px-4 py-4 md:px-8 md:py-6 flex items-center justify-between relative top-0 bg-[#FFFDF7]/80 backdrop-blur-md z-30 border-b border-[#E6DFC8] shadow-sm">
        <div className="flex items-center z-10 w-7 sm:w-auto">
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#26300D] flex items-center justify-center border border-[#E6DFC8] shadow-sm">
              <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6 text-[#FDCC4B]" />
            </div>
          </div>
        </div>

        <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
          <h2 className="inline-flex items-center text-sm md:text-base font-black uppercase tracking-[0.25em] text-[#1F1F1A] leading-none text-center">
            Dashboard
          </h2>
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-1 z-10 w-7 sm:w-auto">
          <Link href="/settings" className="flex items-center pointer-events-auto">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 md:h-11 md:w-11 rounded-xl bg-[#FFFDF7] border border-[#E6DFC8] text-[#5F624F] hover:bg-[#FFF4CC] hover:text-[#26300D] flex items-center justify-center transition-all shadow-sm"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </Link>
        </div>
      </header> */}

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <Suspense fallback={<div className="h-64 bg-card rounded-2xl animate-pulse" />}>
          <BookingListClient initialBookings={typedBookings} />
        </Suspense>
      </div>

      {/* Floating Action Button - Mobile Only */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden">
        <Link href="/book">
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all flex items-center justify-center border-2 border-[#FDCC4B]/20">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
