"use client"

import React, { useState, useTransition, useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns";
import { deleteBooking, updateBookingStatus } from "../actions"
import {
  CheckCircle,
  Clock3,
  AlertCircle,
  CalendarDays,
  Inbox,
  Loader2,
  Trash2,
  Users,
  Pencil,
  Mail,
  Phone,
  MessageSquare,
  CalendarClock,
  BadgePoundSterling,
  MoreVertical,
  CalendarIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu" // Ensure you have this shadcn component
import Link from "next/link"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const formatDateStr = (d: Date) => {
  const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return date.toISOString().split("T")[0]
}

const formatCurrency = (value?: number) => {
  if (typeof value !== "number") return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value)
}

const statusClasses: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  waitlisted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

export interface EventType {
  category?: string;
  sub_type?: string;
}

export interface EventRow {
  event_date?: string;
  event_title?: string;
  description?: string;
  event_types?: EventType;
}

export interface ContactRow {
  full_name?: string;
  email?: string;
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

export default function BookingListClient1({ initialBookings }: { initialBookings: Booking[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [bookingActionId, setBookingActionId] = useState<string | null>(null)

  console.log(JSON.stringify(initialBookings, null, 2));

  const referenceDate = selectedDate || new Date()
  referenceDate.setHours(0, 0, 0, 0)
  const referenceDateStr = formatDateStr(referenceDate)

  const nextWeekRef = new Date(referenceDate)
  nextWeekRef.setDate(referenceDate.getDate() + 7)
  const nextWeekRefStr = formatDateStr(nextWeekRef)

  const weekBookings = useMemo(
    () =>
      initialBookings.filter(
        (b) => b.events?.event_date && b.events.event_date >= referenceDateStr && b.events.event_date <= nextWeekRefStr,
      ),
    [initialBookings, nextWeekRefStr, referenceDateStr],
  )

  const confirmedWeek = weekBookings.filter((b) => b.status?.toLowerCase() === "confirmed")
  const waitlistedWeek = weekBookings.filter((b) => b.status?.toLowerCase() === "waitlisted")
  const pendingWeek = weekBookings.filter((b) => b.status?.toLowerCase() === "pending")
  const cancelledWeek = weekBookings.filter((b) => b.status?.toLowerCase() === "cancelled")
  const dateBookingsCount = initialBookings.filter((b) => b.events?.event_date === referenceDateStr).length

  const dayBookings = selectedDate 
    ? initialBookings.filter((b) => b.events?.event_date === formatDateStr(selectedDate))
    : initialBookings;

  const eventTitlesForDate = selectedDate
    ? Array.from(new Set(dayBookings.map((b) => b.events?.event_title).filter(Boolean)))
    : [];
  const eventTitleDisplay = eventTitlesForDate.length > 0 ? eventTitlesForDate.join(" & ") : null;

  const handleStatusChange = (id: string, newStatus: string) => {
    setBookingActionId(id)
    startTransition(async () => {
      await updateBookingStatus(id, newStatus)
      setBookingActionId(null)
    })
  }

  const handleDeleteBooking = (id: string, bookingName?: string) => {
    const confirmDelete = window.confirm(
      `Delete booking${bookingName ? ` for ${bookingName}` : ""}? This action cannot be undone.`,
    )

    if (!confirmDelete) return

    setBookingActionId(id)
    startTransition(async () => {
      await deleteBooking(id)
      setBookingActionId(null)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4 min-w-60">
          <span className="text-xs font-semibold text-slate-500 uppercase ml-1">View Schedule</span>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal bg-white text-black dark:bg-zinc-950 dark:text-white border-slate-200 dark:border-slate-800 h-12"
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                {selectedDate ? format(selectedDate, "dd MMMM yyy") : <span>All Dates</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 text-black dark:text-white" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date)
                  setIsCalendarOpen(false)
                }}
                autoFocus
                className="text-black dark:text-white"
              />
              <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                <Button 
                  variant="ghost" 
                  className="w-full text-black dark:text-white hover:text-black dark:hover:text-white" 
                  onClick={() => {
                    setSelectedDate(undefined)
                    setIsCalendarOpen(false)
                  }}
                >
                  Clear Date Selection
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto lg:ml-auto">
          <StatCard
            title={selectedDate ? "7 Days From Date" : "Coming Week"}
            value={weekBookings.length}
            subtitle="Total requests"
            icon={<CalendarDays className="h-4 w-4 text-blue-500" />}
          />
          <StatCard
            title="Confirmed"
            value={confirmedWeek.length}
            subtitle="Next 7 days"
            icon={<CheckCircle className="h-4 w-4 text-emerald-500" />}
          />
          <StatCard
            title="Waitlisted"
            value={waitlistedWeek.length}
            subtitle="Next 7 days"
            icon={<Clock3 className="h-4 w-4 text-amber-500" />}
          />
          <StatCard
            title={selectedDate ? "Selected Date" : "Today's Tables"}
            value={dateBookingsCount}
            subtitle={selectedDate ? "Total for date" : "Total for today"}
            icon={<AlertCircle className="h-4 w-4 text-indigo-500" />}
          />
        </div>
      </div>





      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-zinc-950">
       <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Reservation Details for {"   "} 
              {selectedDate ? selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "All Dates"}
              {eventTitleDisplay && (
                <span className="text-green-700 dark:text-blue-400 font-semibold">
                  {" : "}{eventTitleDisplay}
                </span>
              )}
            </h2>
           <p className="text-sm text-slate-500 dark:text-slate-400">
              {selectedDate ? "Bookings and guest details for the selected date." : "Showing all bookings across all dates."}
            </p>
          </div>
          <span className="rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm">
            {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
          </span>
</header>
        <div className="overflow-x-auto">
          <table className="min-w-275 w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                {!selectedDate && <th className="px-4 py-3 font-medium">Date</th>}
                {!selectedDate && <th className="px-4 py-3 font-medium">Event Title</th>}
                <th className="px-4 py-3 font-medium">Team Name</th>
                <th className="px-4 py-3 font-medium">Booked by</th>
                <th className="px-4 py-3 font-medium text-center">Team size</th>
                
                
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Table No.</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {dayBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                     <div className="flex flex-col items-center justify-center space-y-3">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground/50" />
                      <p>No bookings found for {selectedDate ? "the selected date" : "any date"}.</p>
                      {selectedDate && (
                        <Button variant="outline" size="sm" onClick={() => setSelectedDate(undefined)}>
                          View All Dates
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                dayBookings.map((booking) => {
                  const status = booking.status?.toLowerCase() || "pending"
                  const isRowPending = isPending && bookingActionId === booking.id

                  return (
                    <tr key={booking.id} className="align-top transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                       {!selectedDate && (
                        <td className="px-4 py-4">
                          {booking.events?.event_date && (
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {new Date(booking.events.event_date).toLocaleDateString("en-GB")}
                            </div>
                          )}
                        </td>
                      )}
                      {!selectedDate && (
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{booking.events?.event_title || "—"}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{booking.events?.event_types?.category || "General"}</div>
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{booking.group_name || "Unnamed Group"}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Created {booking.booking_created_at ? new Date(booking.booking_created_at).toLocaleDateString("en-GB") : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{booking.contacts?.full_name || "—"}</div>
                        <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" />
                            <span>{booking.contacts?.email || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          <Users className="h-3.5 w-3.5" />
                          {booking.group_size ?? 0}
                        </span>
                      </td>
                     

                     <td className="px-4 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            disabled={isRowPending}
                            className={`inline-flex min-w-26.25 items-center justify-between gap-2 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-all hover:brightness-105 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-950 ${statusClasses[status] || statusClasses.pending}`}
                          >
                            <span>{status}</span>
                            {isRowPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
                            ) : (
                              <svg className="h-3.5 w-3.5 opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            )}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-31.25">
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(booking.id, "confirmed")}
                              className="cursor-pointer font-medium text-emerald-700 focus:bg-emerald-50 focus:text-emerald-800 dark:text-emerald-400 dark:focus:bg-emerald-950/50"
                            >
                              Confirmed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(booking.id, "waitlisted")}
                              className="cursor-pointer font-medium text-amber-700 focus:bg-amber-50 focus:text-amber-800 dark:text-amber-400 dark:focus:bg-amber-950/50"
                            >
                              Waitlisted
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(booking.id, "pending")}
                              className="cursor-pointer font-medium text-slate-700 focus:bg-slate-50 focus:text-slate-900 dark:text-slate-300 dark:focus:bg-slate-800"
                            >
                              Pending
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(booking.id, "cancelled")}
                              className="cursor-pointer font-medium text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-950/50"
                            >
                              Cancelled
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="max-w-55 px-4 py-4">
                        <div className="line-clamp-2 flex items-start gap-1 text-xs text-slate-600 dark:text-slate-300">

                          <span>{booking.special_requests || "1"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-md p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                            <MoreVertical className="h-4 w-4 text-slate-500" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={`/manage-booking/${booking.id}`} className="flex items-center gap-2">
                                <Pencil className="h-4 w-4" /> Edit booking
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteBooking(booking.id, booking.group_name || booking.contacts?.full_name)}
                              className="gap-2 text-red-600 focus:text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" /> Delete booking
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
      {isPending && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin" /> Saving changes...
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, subtitle, icon }: { title: string; value: number; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-zinc-950 min-w-[130px]">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">{icon}</div>
    </div>
  )
}