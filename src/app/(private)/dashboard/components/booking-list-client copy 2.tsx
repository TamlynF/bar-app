"use client"

import React, { useState, useTransition, useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
import { format, addDays, isSameDay, startOfDay } from "date-fns"
import { updateBookingStatus } from "@/app/(private)/dashboard/actions"
import {
  CheckCircle,
  Clock3,
  CalendarDays,
  Inbox,
  Loader2,
  Users,
  Pencil,
  Search,
  Filter,
  ChevronRight,
  BadgePoundSterling,
  Table as TableIcon,
  MessageSquare,
  CalendarIcon,
  X,
  ChevronDown,
  User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import Link from "next/link"

const formatDateStr = (d: Date) => {
  const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return date.toISOString().split("T")[0]
}

const statusTheme: Record<string, { bg: string; text: string; border: string; dot: string; cardBorder: string }> = {
  confirmed: { bg: "bg-green-100 dark:bg-green-500/20", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-500/30", dot: "bg-green-500", cardBorder: "border-green-500" },
  waitlisted: { bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-500/30", dot: "bg-orange-500", cardBorder: "border-orange-500" },
  pending: { bg: "bg-yellow-100 dark:bg-yellow-500/20", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-300 dark:border-yellow-500/40", dot: "bg-yellow-400", cardBorder: "border-yellow-400" },
  cancelled: { bg: "bg-red-100 dark:bg-red-500/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-500/30", dot: "bg-red-500", cardBorder: "border-red-500" },
}

export interface Booking {
  id: string;
  group_name?: string;
  group_size: number;
  paid_amount?: number;
  total_amount?: number;
  status?: string;
  special_requests?: string;
  booking_created_at?: string;
  contacts?: {
    full_name?: string;
    email?: string;
  };
  events?: {
    event_date?: string;
    event_title?: string;
    payment_amount?: number;
  };
}

export default function BookingListClient({ initialBookings }: { initialBookings: Booking[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfDay(new Date()))
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [bookingActionId, setBookingActionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const filteredBookings = useMemo(() => {
    return initialBookings.filter((b) => {
      const bDate = b.events?.event_date ? new Date(b.events.event_date) : null;
      const matchesDate = selectedDate && bDate ? isSameDay(bDate, selectedDate) : !selectedDate;
      const matchesStatus = statusFilter === "all" ? true : b.status?.toLowerCase() === statusFilter;
      const matchesSearch = searchQuery.toLowerCase() === "" ? true :
        b.group_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.contacts?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesDate && matchesStatus && matchesSearch;
    }).sort((a, b) => {
      if (!selectedDate) {
        return new Date(b.events?.event_date || 0).getTime() - new Date(a.events?.event_date || 0).getTime();
      }
      return new Date(b.booking_created_at || 0).getTime() - new Date(a.booking_created_at || 0).getTime();
    });
  }, [initialBookings, selectedDate, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const contextBookings = selectedDate
      ? initialBookings.filter(b => b.events?.event_date === formatDateStr(selectedDate))
      : initialBookings;

    const confirmed = contextBookings.filter(b => b.status === "confirmed");

    return {
      totalGuests: confirmed.reduce((acc, curr) => acc + (Number(curr.group_size) || 0), 0),
      totalTeams: contextBookings.length,
      revenue: contextBookings.reduce((acc, curr) => acc + (curr.paid_amount || 0), 0),
      waitlist: contextBookings.filter(b => b.status === "waitlisted").length,
    };
  }, [initialBookings, selectedDate]);

  const handleStatusChange = (id: string, newStatus: string) => {
    setBookingActionId(id)
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking({ ...selectedBooking, status: newStatus });
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
    <div className="space-y-4 animate-in fade-in duration-500">

      {/* 1. Date Navigation Bar - Clean & Slim */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm">
                <CalendarDays className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          
              <div className="flex flex-col">
                {/* <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</span> */}
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
            style={{ backgroundColor: '#1a2109' }}
            align="start"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) setSelectedDate(d); setIsCalendarOpen(false); }}
              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white isolate z-9999"
              style={{ backgroundColor: '#1a2109' }}
            />
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                onClick={() => { setSelectedDate(undefined); setIsCalendarOpen(false); }}
              >
                Show All History
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
{/* 
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
            <CalendarDays className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date Filter:</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white uppercase truncate max-w-30">
              {selectedDate ? format(selectedDate, "dd MMMM yyyy") : "All Dates"}
            </span>
          </div>
        </div>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
           <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Date</span>
            </Button>
          </PopoverTrigger> 
          <PopoverContent
            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-0 w-auto shadow-xl z-50 rounded-xl overflow-hidden isolate z-100"
            style={{ backgroundColor: '#1a2109' }}
            align="end"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) setSelectedDate(d); setIsCalendarOpen(false); }}
              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white isolate z-9999"
              style={{ backgroundColor: '#1a2109' }}
            />
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                onClick={() => { setSelectedDate(undefined); setIsCalendarOpen(false); }}
              >
                Show All History
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div> */}

      {/* 2. KPI Grid - Micro Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIBox label="Teams" value={stats.totalGuests} icon={<Users />} />
        <KPIBox label="Tables" value={`${stats.revenue}`} icon={<TableIcon />} />
        <KPIBox label="Customers" value={stats.waitlist} icon={<Clock3 />} color={stats.waitlist > 0 ? "amber" : "default"} />
        <KPIBox label="Paid" value={`£${stats.revenue}`} icon={<BadgePoundSterling />} />
      </div>

      {/* 3. Search & Filter - Clean inputs */}
      <div className="flex flex-row items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-700 dark:group-focus-within:text-slate-300 transition-colors" />
          <Input
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 pl-9 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-slate-300 dark:focus:ring-slate-700 transition-all shadow-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 min-w-24 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {statusFilter === 'all' ? 'All' : statusFilter}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 w-44 p-1.5 shadow-xl rounded-xl z-50 isolate z-100" style={{ backgroundColor: '#1a2109' }}>
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
              {['all', 'confirmed', 'waitlisted', 'pending', 'cancelled'].map(s => (
                <DropdownMenuRadioItem key={s} value={s} className="text-xs font-semibold uppercase tracking-wider p-2.5 rounded-lg cursor-pointer focus:bg-slate-100 dark:focus:bg-slate-800">
                  {s}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 4. Floor List Content - Re-structured for readability */}
      <div className="space-y-3 pb-20">
        {filteredBookings.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No entries found matching criteria</p>
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

      {/* 5. Team Profile Sheet - Refresh Design */}
      <Sheet open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
        <SheetContent
          side="bottom"
          className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 rounded-t-[2rem] p-6 pb-8 max-h-[85vh] overflow-y-auto"
          style={{ backgroundColor: '#1a2109' }}
        >
          {selectedBooking && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="flex justify-center -mt-2 mb-2">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>

              <SheetHeader className="text-left p-0">
                <div className="space-y-3">
                  <div className={cn(
                    "inline-flex px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                    statusTheme[selectedBooking.status || 'pending']?.bg,
                    statusTheme[selectedBooking.status || 'pending']?.text,
                    statusTheme[selectedBooking.status || 'pending']?.border
                  )}>
                    {selectedBooking.status}
                  </div>
                  <SheetTitle className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                    {selectedBooking.group_name || "Guest Team"}
                  </SheetTitle>
                  <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-semibold text-xs tracking-wide">
                    <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMM yyyy") : "—"}</span>
                    <span>Ref: #{selectedBooking.id}</span>
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3">
                <DetailTile icon={<Users className="w-4 h-4" />} label="Team Size" value={`${selectedBooking.group_size} Guests`} />
                <DetailTile icon={<BadgePoundSterling className="w-4 h-4" />} label="Status" value={selectedBooking.paid_amount && selectedBooking.paid_amount > 0 ? "Paid" : "Unpaid"} />
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-base shadow-sm">
                  {selectedBooking.contacts?.full_name?.charAt(0) || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedBooking.contacts?.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{selectedBooking.contacts?.email}</p>
                </div>
              </div>

              {/* {selectedBooking.special_requests && (
                <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10">
                  <p className="text-[8px] font-black uppercase tracking-widest text-amber-500/50 mb-1">Special Request</p>
                  <p className="text-xs text-stone-300 italic leading-snug">
                    &quot;{selectedBooking.special_requests}&quot;
                  </p>
                </div>
              )} */}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      Set Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 w-52 p-2 shadow-xl rounded-xl z-9999 isolated"
                    style={{ backgroundColor: '#1a2109' }}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    {Object.keys(statusTheme).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onSelect={() => handleStatusChange(selectedBooking!.id, s)}
                        className="font-bold text-xs p-3 uppercase tracking-wider rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800"
                      >
                        <div className={cn("w-2.5 h-2.5 rounded-full mr-3", statusTheme[s].dot)} />
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button asChild className="h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Syncing Floor
        </div>
      )}
    </div>
  )
}

function BookingCard({ booking, onClick, showDate }: { booking: Booking, onClick: () => void, showDate?: boolean }) {
  const status = booking.status?.toLowerCase() || 'pending';
  const theme = statusTheme[status] || statusTheme.pending;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-[0.99] transition-all border-2 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer bg-white dark:bg-slate-900 shadow-sm",
        theme.cardBorder
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0 text-left">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 hidden sm:flex", theme.bg, theme.text)}>
          {booking.contacts?.full_name?.charAt(0) || "G"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {booking.group_name || "Guest Entry"}
            </h4>
            {showDate && booking.events?.event_date && (
              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap tracking-tight">
                {format(new Date(booking.events.event_date), "dd MMM")}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1 flex items-center gap-1.5 font-medium">
            <User className="w-3.5 h-3.5 opacity-70" /> {booking.contacts?.full_name || "No name provided"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 mt-3 sm:mt-0">
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{booking.group_size}</span>
        </div>
        <div className={cn("px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", theme.bg, theme.text, theme.border)}>
          {status}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors hidden sm:block" />
      </div>
    </div>
  );
}

function KPIBox({ label, value, icon, color = "default" }: { label: string, value: string | number, icon: React.ReactNode, color?: "amber" | "default" }) {
  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col gap-1 shadow-sm transition-all",
      color === "amber" && "border-orange-300 dark:border-orange-500/50 bg-orange-50/50 dark:bg-orange-500/10"
    )}>
      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <div className="scale-75 opacity-70">{icon}</div>
      </div>
      <div className="text-lg font-bold text-slate-900 dark:text-white leading-none tracking-tight">{value}</div>
    </div>
  )
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col gap-1 text-left shadow-sm">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <div className="scale-75 origin-left opacity-80">{icon}</div>
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-slate-900 dark:text-white font-semibold text-xs tracking-tight">{value}</span>
    </div>
  )
}
