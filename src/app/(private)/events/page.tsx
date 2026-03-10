import React, { Suspense } from "react"
// Using relative path to bypass potential alias resolution issues in the build environment
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

  const events = (rawEvents as unknown as EventWithDetails[]) || []

  return (
    <div className="flex-1 bg-background min-h-screen">
      <Suspense fallback={<div className="p-8 space-y-4"><div className="h-32 bg-slate-100 rounded-2xl animate-pulse" /></div>}>
        <EventsHubClient initialEvents={events} />
      </Suspense>
    </div>
  )
}