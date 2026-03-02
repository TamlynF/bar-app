"use client"

import React, { useState, useTransition } from "react"
import { Calendar } from "@/components/ui/calendar"
import { updateBookingStatus } from "../actions"
import { Users, Phone, Mail, CheckCircle, Clock3, AlertCircle, CalendarDays, Loader2, Inbox } from "lucide-react"

// Helper to format date as YYYY-MM-DD reliably, ignoring timezones shifts
const formatDateStr = (d: Date) => {
  const date = new Date(d.getTime() - (d.getTimezoneOffset() * 60000))
  return date.toISOString().split('T')[0]
}

export interface EventType {
  category?: string;
  sub_type?: string;
}

export interface EventRow {
  event_date?: string;      // aliased from date
  event_title?: string;     // aliased from title
  description?: string;
  event_types?: EventType;
}

export interface ContactRow {
  full_name?: string;      // aliased from date
  email?: string;     // aliased from title
  country_code?: string;
  phone_no?: string;
}

export interface Booking {
  id: string;
  event_id?: string;
  group_name?: string;
  team_id?: string;
  contact_id?: string;
  group_size?: number;
  paid_amount?: number;
  status?: string;
  special_requests?: string;
  booking_created_at?: string;
  contacts?: ContactRow;
  events?: EventRow;
}

export default function BookingListClient({ initialBookings }: { initialBookings: Booking[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isPending, startTransition] = useTransition()
  
  console.log(JSON.stringify(initialBookings, null, 2));

  // -- Calculate Statistics --
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDateStr(today)

  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  const nextWeekStr = formatDateStr(nextWeek)

  // Filter bookings for the coming 7 days
  const weekBookings = initialBookings.filter(b => b.events?.event_date && b.events.event_date >= todayStr && b.events.event_date <= nextWeekStr)
  const confirmedWeek = weekBookings.filter(b => b.status?.toLowerCase() === 'confirmed')
  const waitlistedWeek = weekBookings.filter(b => b.status?.toLowerCase() === 'waitlisted')
  const todayBookingsCount = initialBookings.filter(b => b.events?.event_date === todayStr).length

  // -- Current View Data --
  const activeDateStr = selectedDate ? formatDateStr(selectedDate) : todayStr
  const dayBookings = initialBookings.filter(b => b.events?.event_date === activeDateStr)

  const handleStatusChange = (id: string | number, newStatus: string) => {
    startTransition(() => {
      // Ensure we pass a string to the server action, as IDs might be numbers now
      updateBookingStatus(id.toString(), newStatus)
    })
  }


  return (
    <div className="space-y-8">
      {/* 1. Indicators / Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Coming Week" value={weekBookings.length} subtitle="Total requests" icon={<CalendarDays className="h-5 w-5 text-blue-500" />} />
        <StatCard title="Confirmed" value={confirmedWeek.length} subtitle="Next 7 days" icon={<CheckCircle className="h-5 w-5 text-emerald-500" />} />
        <StatCard title="Waitlisted" value={waitlistedWeek.length} subtitle="Next 7 days" icon={<Clock3 className="h-5 w-5 text-amber-500" />} />
        <StatCard title="Today's Tables" value={todayBookingsCount} subtitle="Total for today" icon={<AlertCircle className="h-5 w-5 text-indigo-500" />} />
      </div>

      {/* 2. Main Workspace: Calendar & List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left Column: Calendar */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-center sticky top-8">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md"
            />
          </div>
        </div>

        {/* Right Column: Bookings List */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              Bookings for {selectedDate ? selectedDate.toLocaleDateString('en-GB', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Selected Date'}
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-sm font-medium">
              {dayBookings.length} {dayBookings.length === 1 ? 'Table' : 'Tables'}
            </span>
          </div>

          {dayBookings.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 text-center">
              <Inbox className="w-10 h-10 mb-3 text-slate-400" />
              <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No bookings for this date.</p>
              <p className="text-sm">Try selecting another date from the calendar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayBookings.map((booking) => (
                <div
                  key={booking.id}
                  className={`bg-white dark:bg-zinc-950 p-5 rounded-xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all
                    ${booking.status?.toLowerCase() === 'cancelled' ? 'border-red-100 dark:border-red-900/30 opacity-75' : 'border-slate-200 dark:border-slate-800'}
                  `}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="text-lg font-bold text-slate-900 dark:text-white min-w-17.5">
                        {booking.events?.event_date}
                      </span>
                      <span className="text-lg font-medium">{booking.contacts?.full_name}</span>
                      <span className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        {booking.group_size} {booking.group_size === 1 ? 'Guest' : 'Guests'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                      {booking.contacts?.phone_no && (
                        <span className="flex items-center">
                          <Phone className="w-3.5 h-3.5 mr-1.5" />
                          {booking.contacts?.phone_no}
                        </span>
                      )}
                      {booking.contacts?.email && (
                        <span className="flex items-center">
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          {booking.contacts?.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}

                    <select
                      aria-label={`Update status for ${booking.contacts?.full_name}`}
                      value={booking.status?.toLowerCase() || 'pending'}
                      onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                      disabled={isPending}
                      className={`text-sm border rounded-full px-4 py-1.5 font-semibold appearance-none outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 cursor-pointer shadow-sm transition-colors
                        ${booking.status?.toLowerCase() === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                          booking.status?.toLowerCase() === 'waitlisted' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                            booking.status?.toLowerCase() === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' :
                              'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }
                      `}
                    >
                      <option value="pending">⏳ Pending</option>
                      <option value="confirmed">✅ Confirmed</option>
                      <option value="waitlisted">📝 Waitlist</option>
                      <option value="cancelled">❌ Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Minimal Stat Card Component
function StatCard({ title, value, subtitle, icon }: { title: string, value: number, subtitle: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="text-3xl font-bold mt-1 text-slate-900 dark:text-white">{value}</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
      </div>
      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
        {icon}
      </div>
    </div>
  )
}