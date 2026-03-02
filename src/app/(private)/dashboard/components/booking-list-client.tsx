"use client"

import React, { useState, useTransition, useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
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
  confirmed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  waitlisted:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
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
  const [isPending, startTransition] = useTransition()
  const [bookingActionId, setBookingActionId] = useState<string | null>(null)

  console.log(JSON.stringify(initialBookings, null, 2));

  // -- Calculate Statistics --
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDateStr(today)

  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  const nextWeekStr = formatDateStr(nextWeek)

    const weekBookings = useMemo(
    () =>
      initialBookings.filter(
        (b) => b.events?.event_date && b.events.event_date >= todayStr && b.events.event_date <= nextWeekStr,
      ),
    [initialBookings, nextWeekStr, todayStr],
  )

  const confirmedWeek = weekBookings.filter((b) => b.status?.toLowerCase() === "confirmed")
  const waitlistedWeek = weekBookings.filter((b) => b.status?.toLowerCase() === "waitlisted")
  const todayBookingsCount = initialBookings.filter((b) => b.events?.event_date === todayStr).length

  const activeDateStr = selectedDate ? formatDateStr(selectedDate) : todayStr
  const dayBookings = initialBookings.filter((b) => b.events?.event_date === activeDateStr)

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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
        <StatCard
          title="Coming Week"
          value={weekBookings.length}
          subtitle="Total requests"
          icon={<CalendarDays className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          title="Confirmed"
          value={confirmedWeek.length}
          subtitle="Next 7 days"
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
        />
        <StatCard
          title="Waitlisted"
          value={waitlistedWeek.length}
          subtitle="Next 7 days"
          icon={<Clock3 className="h-5 w-5 text-amber-500" />}
        />
        <StatCard
          title="Today's Tables"
          value={todayBookingsCount}
          subtitle="Total for today"
          icon={<AlertCircle className="h-5 w-5 text-indigo-500" />}
        />
      </div>

               <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px,1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Choose a date</h2>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="rounded-md"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-zinc-950">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {selectedDate?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Bookings and guest details for the selected date.</p>
            </div>
            <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {dayBookings.length} bookings
            </span>
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-275 w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                 <th className="px-4 py-3 font-medium">Booking</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium text-center">Guests</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Requests</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {dayBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      <Inbox className="mx-auto mb-2 h-8 w-8 opacity-20" />
                      No reservations found for this date.
                    </td>
                  </tr>
                ) : (
                    dayBookings.map((booking) => {
                    const status = booking.status?.toLowerCase() || "pending"
                    const isRowPending = isPending && bookingActionId === booking.id
                    const phone = [booking.contacts?.country_code, booking.contacts?.phone_no].filter(Boolean).join(" ")

                    return (
                      <tr key={booking.id} className="align-top transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
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
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              <span>{phone || "—"}</span>
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
                          <div className="font-medium text-slate-900 dark:text-slate-100">{booking.events?.event_title || "—"}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{booking.events?.event_types?.category || "General"}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                            <BadgePoundSterling className="h-3.5 w-3.5" />
                            {formatCurrency(booking.paid_amount)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusClasses[status] || statusClasses.pending}`}>
                              {status}
                            </span>
                            <select
                              aria-label={`Update status for ${booking.contacts?.full_name || "booking"}`}
                              value={status}
                              onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                              disabled={isRowPending}
                              className="rounded-md border border-slate-200 bg-transparent px-2 py-1 text-xs dark:border-slate-700"
                            >
                              <option value="confirmed">Confirmed</option>
                              <option value="waitlisted">Waitlisted</option>
                              <option value="pending">Pending</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </td>
                         <td className="max-w-55 px-4 py-4">
                          <div className="line-clamp-2 flex items-start gap-1 text-xs text-slate-600 dark:text-slate-300">
                            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{booking.special_requests || "No special requests"}</span>
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
                       
{/*                         <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/manage-booking/${booking.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Link>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteBooking(booking.id, booking.group_name || booking.contacts?.full_name)}
                              disabled={isRowPending}
                            >
                              {isRowPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              Delete
                            </Button>
                          </div>
                        </td> */}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
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
    <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{value}</h3>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">{icon}</div>
    </div>
  )
}