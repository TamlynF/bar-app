import React from 'react'
import { createClient } from "@/lib/supabase/server"
import BookingListClient, { Booking } from "./components/booking-list-client"

export const dynamic = 'force-dynamic'


export default async function DashboardPage() {
 let typedBookings: Booking[] = []
  let hasDataSourceError = false

  try {
    const supabase = await createClient()

    // Fetch all bookings, ordered by date and time
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
          event_types(
            category: type,
            sub_type
          )
        )
      `)

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
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Management Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Monitor upcoming reservations and manage your waitlist.</p>
      </div>
            {hasDataSourceError ? (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-100">
          Booking data is temporarily unavailable. The dashboard UI is shown, but live booking records could not be loaded.
        </div>
      ) : null}
      <BookingListClient initialBookings={typedBookings} />
    </div>
  )
}

