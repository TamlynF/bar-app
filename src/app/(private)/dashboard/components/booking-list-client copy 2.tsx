"use client"

import React, { useState, useTransition, useMemo } from "react"
import { format } from "date-fns";
import { Calendar as CalendarIcon, MoreHorizontal, Edit, Eye, Trash2, MapPin, User, Clock } from "lucide-react";



import { Calendar } from "@/components/ui/calendar"
import { deleteBooking, updateBookingStatus } from "../actions"
import {
  CheckCircle,
  Clock3,
  AlertCircle,
  CalendarDays,
  Inbox,
  Loader2,
Group,
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
  DropdownMenuSeparator,
  DropdownMenuLabel
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

export default function BookingListClient2({ initialBookings }: { initialBookings: Booking[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isPending, startTransition] = useTransition()
  const [bookingActionId, setBookingActionId] = useState<string | null>(null)
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);

  console.log(JSON.stringify(initialBookings, null, 2));

  // -- Calculate Statistics --
  const filteredBookings = date
    ? bookings.filter((b) => {
      if (!b.events?.event_date) return false;
      const bDate = new Date(b.events?.event_date);
      return (
        bDate.getDate() === date.getDate() &&
        bDate.getMonth() === date.getMonth() &&
        bDate.getFullYear() === date.getFullYear()
      );
    })
    : bookings;

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
    <div className="grid grid-cols-5 lg:grid-cols-5 gap-6 items-start">


      <div className="lg:col-span-1 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden sticky top-2">
        <div className="flex flex-col space-y-1.5 p-4 pb-3 border-b bg-muted/20">
          <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Select Date
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Filter bookings by day</p>
        </div>
        <div className="p-4 flex justify-center bg-card">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-s-sm"
          />
        </div>
        {/* {date && (
          <div className="p-4 border-t bg-muted/10 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Selected:</span>
            <span className="font-medium text-foreground">{format(date, "MMM d, yyyy")}</span>
          </div>
        )} */}
      </div>

      <div className="lg:col-span-4 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="flex flex-col space-y-1.5 p-6 bg-muted/10 border-b">
          <h3 className="font-semibold leading-none tracking-tight text-xl flex items-center justify-between">
            <span>{date ? format(date, "dd MMMM yyyy") : "All Bookings"}</span>
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2.5 py-1 rounded-full border">
              {filteredBookings.length} Total
            </span>
          </h3>
        </div>

        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="[&_tr]:border-b bg-muted/30 text-muted-foreground">
              <tr className="border-b transition-colors hover:bg-muted/10">

                <th className="h-12 px-6 align-middle font-medium">
                    <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>Booked by</span>
                  </div>
                  </th>
                <th className="h-12 px-4 align-middle font-medium">Team Name</th>

                <th className="h-12 px-4 align-middle font-medium">
                  <div className="flex items-center gap-1.5">
                    <Group className="h-3.5 w-3.5" />
                    <span>No. of People</span>
                  </div>
                </th>
                <th className="h-12 px-4 align-middle font-medium">Status</th>
                <th className="h-12 px-6 align-middle font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0 bg-background">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground/50" />
                      <p>No bookings found for the selected date.</p>
                      <Button variant="outline" size="sm" onClick={() => setDate(undefined)}>
                        View All Dates
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="border-b transition-colors hover:bg-muted/30">
                    <td className="py-4 px-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {booking.contacts?.full_name?.charAt(0)}
                        </div>

                          <span className="font-medium text-foreground">{booking.contacts?.full_name}</span>

                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                                                {booking.group_name}
                      </div>
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">


                      {booking.group_size} {booking.group_size === 1 ? 'People' : 'People'}

                    </td>
                    <td className="p-4 align-middle">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${booking.status === "confirmed" ? "border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                        booking.status === "waitlisted" ? "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          "border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                        {booking.status}
                      </span>
                    </td>

                    <td className="p-4 px-6 align-middle text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild className="rounded-md p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4 text-foreground/70" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg border-muted">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Booking Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer py-2">
                            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>View Details</span>
                          </DropdownMenuItem>
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
                ))
              )}
            </tbody>
          </table>
        </div>
        {
          isPending && (
            <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving changes...
            </div>
          )
        }
      </div>
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