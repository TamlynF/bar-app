import React, { Suspense } from "react";
import { createClient } from "@/lib/supabase/server"
import BookingListClient from "./components/booking-list-client"
import { Booking } from "../events/quiz-bookings/page"
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let typedBookings: Booking[] = []

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
        `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching bookings:", error)
    }
    typedBookings = (bookings as unknown as Booking[]) ?? []
  } catch (error) {
    console.error("Dashboard data source unavailable:", error)
  }

  return (
    <div className="flex-1 bg-background min-h-screen relative selection:bg-primary selection:text-primary-foreground">
      {/* Refined Ambient Glows - Made subtle for a professional look */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-accent/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-accent/5 blur-[100px] rounded-full pointer-events-none -z-10" />

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
