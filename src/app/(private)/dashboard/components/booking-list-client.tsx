"use client"

import React, { useState, useTransition } from "react"
import { Calendar } from "@/components/ui/calendar"
import { updateBookingStatus } from "../actions"
import { 
  Users, Phone, Mail, CheckCircle, Clock3, 
  AlertCircle, CalendarDays, Loader2, Inbox,
  MoreVertical, Pencil, Trash2, ExternalLink
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu" // Ensure you have this shadcn component

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

  const handleStatusChange = (id: string, newStatus: string) => {
    startTransition(() => {
      updateBookingStatus(id, newStatus)
    })
  }

  return (
    <div className="space-y-6">
      {/* Stats Section remains similar but with more refined borders */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
       <StatCard title="Coming Week" value={weekBookings.length} subtitle="Total requests" icon={<CalendarDays className="h-5 w-5 text-blue-500" />} />
               <StatCard title="Confirmed" value={confirmedWeek.length} subtitle="Next 7 days" icon={<CheckCircle className="h-5 w-5 text-emerald-500" />} />
               <StatCard title="Waitlisted" value={waitlistedWeek.length} subtitle="Next 7 days" icon={<Clock3 className="h-5 w-5 text-amber-500" />} />
               <StatCard title="Today's Tables" value={todayBookingsCount} subtitle="Total for today" icon={<AlertCircle className="h-5 w-5 text-indigo-500" />} />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Calendar Sidebar */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md"
            />
          </div>
        </div>

        {/* Main Table Area */}
        <div className="flex-1 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {selectedDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
            </h2>
            <div className="text-xs font-medium px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-md">
              {dayBookings.length} Bookings
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">Contact</th>
                  <th className="px-6 py-4 font-medium text-center">Guests</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {dayBookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      No reservations found for this date.
                    </td>
                  </tr>
                ) : (
                  dayBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{booking.contacts?.full_name}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[150px]">{booking.special_requests || 'No special requests'}</div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="flex items-center gap-1.5"><Phone className="w-3 h-3"/> {booking.contacts?.phone_no}</span>
                          <span className="flex items-center gap-1.5"><Mail className="w-3 h-3"/> {booking.contacts?.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {booking.group_size}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          aria-label={`Update status for ${booking.contacts?.full_name}`}
                          value={booking.status?.toLowerCase()}
                          onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                          className="bg-transparent font-medium focus:ring-0 cursor-pointer text-xs border-none p-0"
                        >
                          <option value="confirmed">Confirmed</option>
                          <option value="waitlisted">Waitlisted</option>
                          <option value="pending">Pending</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                            <MoreVertical className="w-4 h-4 text-slate-500" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem className="gap-2">
                              <Pencil className="w-4 h-4" /> Edit Booking
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <ExternalLink className="w-4 h-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600">
                              <Trash2 className="w-4 h-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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