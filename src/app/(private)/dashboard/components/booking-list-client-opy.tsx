"use client"

import React, { useMemo, useState, useTransition } from "react"
import styles from "./booking-list-client-opy.module.css"
import { Calendar } from "@/components/ui/calendar"
import { format, isSameDay } from "date-fns"
import { updateBookingStatus } from "@/app/(private)/dashboard/actions"
import {
  BadgePoundSterling,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  HelpCircle,
  Inbox,
  Loader2,
  Pencil,
  Search,
  Table as TableIcon,
  Users,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import Link from "next/link"

const formatDateStr = (d: Date) => {
  const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return date.toISOString().split("T")[0]
}

const normStatus = (s?: string) => (s || "").trim().toLowerCase()

const statusTheme: Record<
  string,
  {
    bg: string
    text: string
    border: string
    dot: string
    ring: string
    cardBorder: string
    icon: React.ReactNode
  }
> = {
  all: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-600",
    dot: "bg-slate-600",
    ring: "ring-slate-500/40",
    cardBorder: "border-slate-200 dark:border-slate-700",
    icon: <TableIcon className="w-3 h-3" />,
  },
  confirmed: {
    bg: "bg-green-50 dark:bg-green-500/10",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-500/30",
    dot: "bg-green-500",
    ring: "ring-green-500/40",
    cardBorder: "border-green-500/50 dark:border-green-500/40",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  waitlisted: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-500/30",
    dot: "bg-orange-500",
    ring: "ring-orange-500/40",
    cardBorder: "border-orange-500/50 dark:border-orange-500/40",
    icon: <Clock3 className="w-3 h-3" />,
  },
  pending: {
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-500/30",
    dot: "bg-yellow-500",
    ring: "ring-yellow-500/40",
    cardBorder: "border-yellow-500/50 dark:border-yellow-500/40",
    icon: <HelpCircle className="w-3 h-3" />,
  },
  cancelled: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-500/30",
    dot: "bg-red-500",
    ring: "ring-red-500/40",
    cardBorder: "border-red-500/50 dark:border-red-500/40",
    icon: <XCircle className="w-3 h-3" />,
  },
}

export interface Booking {
  id: string
  group_name?: string
  group_size: number
  paid_amount?: number
  total_amount?: number
  status?: string
  special_requests?: string
  booking_created_at?: string
  contacts?: {
    full_name?: string
    email?: string
  }
  events?: {
    event_date?: string
    event_title?: string
    payment_amount?: number
  }
}

export default function BookingListClient({ initialBookings }: { initialBookings: Booking[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [bookingActionId, setBookingActionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Status Filters via circles
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(new Set())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const toggleStatusFilter = (status: string) => {
    console.log('🔘 Toggling filter:', status, 'Current filters:', Array.from(activeStatusFilters))
    const next = new Set(activeStatusFilters)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    console.log('✅ New filters:', Array.from(next))
    setActiveStatusFilters(next)
  }

  const filteredBookings = useMemo(() => {
    return initialBookings
      .filter((b) => {
        const bDate = b.events?.event_date ? new Date(b.events.event_date) : null
        const matchesDate = selectedDate && bDate ? isSameDay(bDate, selectedDate) : !selectedDate

        const bStatus = normStatus(b.status)
        const matchesStatus = activeStatusFilters.size === 0 ? true : activeStatusFilters.has(bStatus)

        const q = searchQuery.trim().toLowerCase()
        const matchesSearch =
          q === ""
            ? true
            : (b.group_name || "").toLowerCase().includes(q) ||
              (b.contacts?.full_name || "").toLowerCase().includes(q)

        return matchesDate && matchesStatus && matchesSearch
      })
      .sort((a, b) => {
        if (!selectedDate) {
          return (
            new Date(b.events?.event_date || 0).getTime() -
            new Date(a.events?.event_date || 0).getTime()
          )
        }
        return (
          new Date(b.booking_created_at || 0).getTime() -
          new Date(a.booking_created_at || 0).getTime()
        )
      })
  }, [initialBookings, selectedDate, activeStatusFilters, searchQuery])

  const stats = useMemo(() => {
    const contextBookings = selectedDate
      ? initialBookings.filter((b) => b.events?.event_date === formatDateStr(selectedDate))
      : initialBookings
    // console.log(contextBookings);
    
    const counts = {
      confirmed: contextBookings.filter((b) => normStatus(b.status) === "confirmed").length,
      waitlisted: contextBookings.filter((b) => normStatus(b.status) === "waitlisted").length,
      pending: contextBookings.filter((b) => {
        const s = normStatus(b.status)
        return s === "" || s === "pending"
      }).length,
      cancelled: contextBookings.filter((b) => normStatus(b.status) === "cancelled").length,
    }

    return {
      totalGuests: contextBookings
        .filter((b) => normStatus(b.status) === "confirmed")
        .reduce((acc, curr) => acc + (Number(curr.group_size) || 0), 0),
      totalTeams: contextBookings.length,
      revenue: contextBookings.reduce((acc, curr) => acc + (curr.paid_amount || 0), 0),
      counts,
    }
  }, [initialBookings, selectedDate])

  console.log("Active Status Filters:", Array.from(activeStatusFilters));

  const handleStatusChange = (id: string, newStatus: string) => {
    setBookingActionId(id)
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking({ ...selectedBooking, status: newStatus })
    }

    startTransition(async () => {
      try {
        await updateBookingStatus(id, newStatus)
      } catch (error) {
        console.error(error)
      } finally {
        setBookingActionId(null)
      }
    })
  }

  

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* 1. Date Navigation Bar - Clean & Slim */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-primary/30">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <CalendarDays className="w-4 h-4 text-slate-600 dark:text-slate-300" />

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white uppercase truncate max-w-40">
                    {selectedDate ? format(selectedDate, "dd MMMM yyyy") : "All Dates"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-0 w-auto shadow-xl rounded-xl overflow-hidden isolate z-9999"
            style={{ backgroundColor: "#1a2109" }}
            align="start"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) setSelectedDate(d)
                setIsCalendarOpen(false)
              }}
              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white isolate z-9999"
              style={{ backgroundColor: "#1a2109" }}
            />
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                onClick={() => {
                  setSelectedDate(undefined)
                  setIsCalendarOpen(false)
                }}
              >
                Show All History
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Desktop Quick Actions */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">
            Quick Stats:
          </span>
          <div className="flex -space-x-2">
            <div
              className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-[10px] font-bold text-green-600"
              title="Confirmed"
            >
              {stats.counts.confirmed}
            </div>
            <div
              className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[10px] font-bold text-orange-600"
              title="Waitlisted"
            >
              {stats.counts.waitlisted}
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Grid & Interactive Status Filter (Compact Redesign) */}
      <div className="flex flex-col gap-2 sm:gap-2">
        {/* Top KPIs Row */}
        <div className="flex w-full justify-between gap-2 overflow-x-auto pb-1">
          <div className="flex-1 min-w-0">
            <KPIBox label="Guests" value={stats.totalGuests} icon={<Users className="w-4 h-4" />} />
          </div>
          <div className="flex-1 min-w-0">
            <KPIBox
              label="Revenue"
              value={`£${stats.revenue}`}
              icon={<BadgePoundSterling className="w-4 h-4" />}
            />
          </div>
          <div className="flex-1 min-w-0">
            <KPIBox label="Teams" value={stats.totalTeams} icon={<TableIcon className="w-4 h-4" />} />
          </div>
        </div>

        {/* Status Filters Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 sm:p-3 flex items-center justify-between shadow-sm relative z-10 overflow-visible">
          <div className="flex items-center justify-start gap-4 sm:gap-5 w-full px-2 min-w-max py-4 overflow-visible">
            <StatusCircle
              count={stats.totalTeams}
              status="all"
              label="Total"
              isActive={activeStatusFilters.size === 0}
              onClick={() => setActiveStatusFilters(new Set())}
            />
            <StatusCircle
              count={stats.counts.confirmed}
              status="confirmed"
              label="Joining"
              isActive={activeStatusFilters.has("confirmed")}
              onClick={() => toggleStatusFilter("confirmed")}
            />
            <StatusCircle
              count={stats.counts.waitlisted}
              status="waitlisted"
              label="Waiting"
              isActive={activeStatusFilters.has("waitlisted")}
              onClick={() => toggleStatusFilter("waitlisted")}
            />
            <StatusCircle
              count={stats.counts.pending}
              status="pending"
              label="Pending"
              isActive={activeStatusFilters.has("pending")}
              onClick={() => toggleStatusFilter("pending")}
            />
            <StatusCircle
              count={stats.counts.cancelled}
              status="cancelled"
              label="Cancelled"
              isActive={activeStatusFilters.has("cancelled")}
              onClick={() => toggleStatusFilter("cancelled")}
            />
          </div>
          <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Filters
          </span>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-700 dark:group-focus-within:text-slate-300 transition-colors" />
        <Input
          placeholder="Search team names or guests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 pl-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-slate-300 dark:focus:ring-slate-700 transition-all shadow-sm"
        />
        {activeStatusFilters.size > 0 && (
          <button
            onClick={() => setActiveStatusFilters(new Set())}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 4. Floor List Content */}
      <div className="space-y-2.5 pb-20">
        {filteredBookings.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No bookings found</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              showDate={!selectedDate}
              onClick={() => setSelectedBooking(b)}
            />
          ))
        )}
      </div>

      {/* 5. Team Profile Sheet */}
      <Sheet open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
        <SheetContent
          side="bottom"
          className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 rounded-t-[2rem] p-6 pb-8 max-h-[85vh] overflow-y-auto"
          style={{ backgroundColor: "#1a2109" }}
        >
          {selectedBooking && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="flex justify-center -mt-2 mb-2">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>

              <SheetHeader className="text-left p-0">
                <div className="space-y-3">
                  <div
                    className={cn(
                      "inline-flex px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      statusTheme[normStatus(selectedBooking.status) || "pending"]?.bg,
                      statusTheme[normStatus(selectedBooking.status) || "pending"]?.text,
                      statusTheme[normStatus(selectedBooking.status) || "pending"]?.border,
                    )}
                  >
                    {normStatus(selectedBooking.status) || "pending"}
                  </div>
                  <SheetTitle className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                    {selectedBooking.group_name || "Guest Team"}
                  </SheetTitle>
                  <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-semibold text-xs tracking-wide">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />{" "}
                      {selectedBooking.events?.event_date
                        ? format(new Date(selectedBooking.events.event_date), "do MMM yyyy")
                        : "—"}
                    </span>
                    <span>Ref: #{selectedBooking.id}</span>
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3">
                <DetailTile
                  icon={<Users className="w-4 h-4" />}
                  label="Team Size"
                  value={`${selectedBooking.group_size} Guests`}
                />
                <DetailTile
                  icon={<BadgePoundSterling className="w-4 h-4" />}
                  label="Payment"
                  value={
                    selectedBooking.paid_amount && selectedBooking.paid_amount > 0
                      ? `£${selectedBooking.paid_amount}`
                      : "Pending"
                  }
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-base shadow-sm">
                  {selectedBooking.contacts?.full_name?.charAt(0) || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {selectedBooking.contacts?.full_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {selectedBooking.contacts?.email}
                  </p>
                </div>
              </div>

              {selectedBooking.special_requests && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                    Requests
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                    {selectedBooking.special_requests}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      Update Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 w-52 p-2 shadow-xl rounded-xl z-9999 isolated"
                    style={{ backgroundColor: "#1a2109" }}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    {Object.keys(statusTheme).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onSelect={() => handleStatusChange(selectedBooking.id, s)}
                        className="font-bold text-xs p-3 uppercase tracking-wider rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800"
                      >
                        <div className={cn("w-2.5 h-2.5 rounded-full mr-3", statusTheme[s].dot)} />
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  asChild
                  className="h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                >
                  <Link href={`/manage-booking/${selectedBooking.id}`}>
                    <Pencil className="w-4 h-4 mr-2" /> Manage
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Global Sync Overlay */}
      {isPending && (
        <div className="fixed bottom-6 right-6 z-100 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Updating Floor...
        </div>
      )}
    </div>
  )
}

function StatusCircle({
  count,
  status,
  label,
  isActive,
  onClick,
}: {
  count: number
  status: string
  label: string
  isActive: boolean
  onClick: () => void
}) {
  const theme = statusTheme[status] || statusTheme.pending

  return (
    <div className="flex flex-col items-center gap-2 min-w-[50px] shrink-0 overflow-visible">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "appearance-none outline-none group relative flex items-center justify-center w-11 h-11 rounded-full border-2 transition-all z-10 touch-manipulation",
          "hover:scale-105 active:scale-95 overflow-visible",
          isActive
            ? `${theme.dot} !${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}`
            : `bg-white dark:bg-slate-800 ${theme.border}`,
        )}
      >
        <span className={cn("text-xs font-black pointer-events-none", isActive ? "text-white" : theme.text)}>
          {count}
        </span>
      </button>
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-tight text-center whitespace-nowrap transition-colors pointer-events-none",
          isActive ? theme.text : "text-slate-400",
        )}
      >
        {label}
      </span>
    </div>
  )
}

function BookingCard({
  booking,
  onClick,
  showDate,
}: {
  booking: Booking
  onClick: () => void
  showDate?: boolean
}) {
  const status = normStatus(booking.status) || "pending"
  //console.log('Booking status:', booking.status, 'Normalized:', status, 'Theme:', statusTheme[status])
  const theme = statusTheme[status] || statusTheme.pending

  return (
    <div
      onClick={onClick}
      className={cn(
        "group hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-[0.99] transition-all border-2 rounded-xl p-3 flex items-center justify-between cursor-pointer bg-white dark:bg-slate-900 shadow-sm gap-2",
        theme.cardBorder,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 text-left flex-1">
        <div
          className={cn(
            "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0",
            theme.bg,
            theme.text,
          )}
        >
          {theme.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {booking.group_name || "Guest Entry"}
            </h4>
            {showDate && booking.events?.event_date && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap tracking-tight hidden sm:inline-flex">
                {format(new Date(booking.events.event_date), "dd MMM")}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1.5 font-medium">
            {booking.contacts?.full_name || "No name provided"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {booking.group_size}
          </span>
        </div>
        <div
          className={cn(
            "px-2 py-1 sm:px-3 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border",
            theme.bg,
            theme.text,
            theme.border,
          )}
        >
          {status}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-focus-within:text-slate-200 transition-colors hidden sm:block" />
      </div>
    </div>
  )
}

function KPIBox({
  label,
  value,
  icon,
  color = "default",
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color?: "amber" | "default"
}) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-1.5 flex flex-col items-center justify-center gap-1 shadow-sm transition-all relative overflow-hidden h-full",
        color === "amber" &&
          "border-orange-300 dark:border-orange-500/50 bg-orange-50/50 dark:bg-orange-500/10",
      )}
    >
      <div className="flex flex-col items-center gap-0.5 w-full">
        <div className="w-5 h-5 rounded bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400">
          <div className="scale-[0.6]">{icon}</div>
        </div>
        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate w-full text-center">
          {label}
        </span>
      </div>
      <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-none tracking-tight shrink-0">
        {value}
      </div>
    </div>
  )
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col gap-1 text-left shadow-sm">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <div className="scale-75 origin-left opacity-80">{icon}</div>
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-slate-900 dark:text-white font-semibold text-xs tracking-tight">
        {value}
      </span>
    </div>
  )
}
