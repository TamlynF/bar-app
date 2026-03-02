import React, { Suspense } from "react";
import { createClient } from "@/lib/supabase/server"
import BookingListClient, { Booking } from "./components/booking-list-client"
import { Users, DollarSign, CalendarDays } from "lucide-react";

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
          <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
      </div>

      {/* STAT CARDS - Separated into a distinct top row */}
      {/* <div className="grid gap-4 grid-cols-5 md:grid-cols-5">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-between">
          <div className="flex flex-row items-center justify-between space-y-0">
            <h3 className="tracking-tight text-sm font-medium">Total Bookings</h3>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-2xl font-bold">124</div>
            <p className="text-xs text-muted-foreground mt-1">+14% from last month</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-between">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Active Guests</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground mt-1">+2 since last week</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-between">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Revenue</h3>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-2xl font-bold">$1,200.00</div>
            <p className="text-xs text-muted-foreground mt-1">+12% from last month</p>
          </div>
        </div>
      </div> */}

                  {hasDataSourceError ? (
         <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-100">
           Booking data is temporarily unavailable. The dashboard UI is shown, but live booking records could not be loaded.
         </div>
       ) : null}
    
      {/* CALENDAR & TABLE - Handled interactively by the Client Component */}
      <Suspense fallback={<div className="animate-pulse h-96 bg-muted rounded-xl"></div>}>
         <BookingListClient initialBookings={typedBookings} />
      </Suspense>
    </div>
    // <div className="container mx-auto py-8 px-4 max-w-7xl">
    //   <div className="mb-8">
    //     <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Management Dashboard</h1>
    //     <p className="text-slate-500 dark:text-slate-400 mt-1">Monitor upcoming reservations and manage your waitlist.</p>
    //   </div>
    //         {hasDataSourceError ? (
    //     <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-100">
    //       Booking data is temporarily unavailable. The dashboard UI is shown, but live booking records could not be loaded.
    //     </div>
    //   ) : null}
    //   <BookingListClient initialBookings={typedBookings} />
    // </div>
  )
}

