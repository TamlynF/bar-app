import React, { Suspense } from "react"
import { createClient } from "../../../lib/supabase/server"
import EventsHubClient, { EventWithDetails } from "./components/events-hub-client"

export const dynamic = 'force-dynamic'

export default async function EventsHubPage() {
  const supabase = await createClient()

  // 1. Fetch current live data from the server
  const { data: rawEvents } = await supabase
    .from("events")
    .select(`
      id, date, title, seating_required,
      event_types (type, sub_type),
      bookings (status, group_size)
    `)
    .order('date', { ascending: true })
  
    const { count: availableTablesCount } = await supabase
    .from("tables")
    .select("*", { count: 'exact', head: true })
    .eq("available", true)

  const events = (rawEvents as unknown as EventWithDetails[]) || []

  return (
    <div className="flex-1 bg-background min-h-screen">
      <Suspense fallback={
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      }>
        <EventsHubClient 
          initialEvents={events} 
          availableTablesCount={availableTablesCount || 0} 
        />
      </Suspense>
    </div>
  )
}