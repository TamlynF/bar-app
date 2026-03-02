import React from 'react'
import { createClient } from "@/lib/supabase/server"
import BookingListClient, { Booking } from "./components/booking-list-client"

export const dynamic = 'force-dynamic'


export default async function DashboardPage() {
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
    //.order("events(date)", { ascending: true })

  if (error) {
    console.error("Error fetching bookings:", error)
  }

    const typedBookings = (bookings as unknown) as Booking[];
    
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Management Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Monitor upcoming reservations and manage your waitlist.</p>
      </div>
      
      <BookingListClient initialBookings={typedBookings} />
    </div>
  )
}

