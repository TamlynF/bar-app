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
  ChevronDown
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

const statusTheme: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  confirmed: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-500" },
  waitlisted: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-500" },
  pending: { bg: "bg-slate-500/15", text: "text-slate-300", border: "border-slate-500/30", dot: "bg-slate-400" },
  cancelled: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-500" },
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
    <div className="space-y-3 animate-in fade-in duration-500">

      {/* 1. Date Navigation Bar - Clean & Slim */}
      <div className="flex items-center justify-between bg-white/10 p-3 rounded-xl border border-white/10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
            <CalendarDays className="w-4 h-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">Floor Data</span>
            <span className="text-xs font-bold text-white uppercase truncate max-w-30">
              {selectedDate ? format(selectedDate, "do MMMM") : "Lifetime"}
            </span>
          </div>
        </div>

        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-primary hover:bg-primary/20 rounded-md bg-white/5">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
              <span className="text-[9px] font-black uppercase">Date</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="bg-[#1a2109] border-white/20 p-0 w-auto shadow-2xl isolate z-100"
            style={{ backgroundColor: '#1a2109' }}
            align="start"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) setSelectedDate(d); setIsCalendarOpen(false); }}
              className="bg-[#1a2109] isolate z-9999"
              style={{ backgroundColor: '#1a2109' }}
            />
            <div className="p-2 border-t border-white/5 bg-black/40 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[9px] font-black uppercase tracking-widest text-primary"
                onClick={() => { setSelectedDate(undefined); setIsCalendarOpen(false); }}
              >
                Show All History
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 2. KPI Grid - Micro Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPIBox label="Guests" value={stats.totalGuests} icon={<Users />} />
        <KPIBox label="Revenue" value={`£${stats.revenue}`} icon={<BadgePoundSterling />} />
        <KPIBox label="Waitlist" value={stats.waitlist} icon={<Clock3 />} color={stats.waitlist > 0 ? "amber" : "default"} />
        <KPIBox label="Teams" value={stats.totalTeams} icon={<TableIcon />} />
      </div>

      {/* 3. Search & Filter - Forced Horizontal Row */}
      <div className="flex flex-row items-center gap-2">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-xl bg-black/40 border-white/10 pl-9 text-[11px] text-white placeholder:text-white/20 focus:ring-primary/20 transition-all shadow-inner"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 rounded-xl bg-white/8 border-white/10 text-stone-300 px-3 min-w-10">
              <Filter className="w-3.5 h-3.5 opacity-60" />
              <span className="hidden sm:inline-block ml-2 text-[9px] font-black uppercase tracking-widest">
                {statusFilter === 'all' ? 'All' : statusFilter}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#1a2109] border-white/20 w-44 p-1 isolate z-100" style={{ backgroundColor: '#1a2109' }}>
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
              {['all', 'confirmed', 'waitlisted', 'pending', 'cancelled'].map(s => (
                <DropdownMenuRadioItem key={s} value={s} className="text-[10px] font-black uppercase tracking-widest p-2.5 rounded-md cursor-pointer">
                  {s}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 4. Floor List Content */}
      <div className="space-y-1.5 pb-20">
        {filteredBookings.length === 0 ? (
          <div className="py-16 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
            <Inbox className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-stone-500 text-[9px] font-black uppercase tracking-widest">No entries found</p>
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
          className="bg-[#1a2109] border-t border-primary/20 rounded-t-[2.5rem] p-5 pb-8 max-h-[85vh] overflow-y-auto"
          style={{ backgroundColor: '#1a2109' }}
        >
          {selectedBooking && (
            <div className="space-y-6 max-w-lg mx-auto">
              <div className="flex justify-center -mt-1 mb-2">
                <div className="w-12 h-1.5 bg-white/15 rounded-full" />
              </div>

              <SheetHeader className="text-left p-0">
                <div className="space-y-3">
                  <div className={cn(
                    "inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                    statusTheme[selectedBooking.status || 'pending']?.bg,
                    statusTheme[selectedBooking.status || 'pending']?.text,
                    statusTheme[selectedBooking.status || 'pending']?.border
                  )}>
                    {selectedBooking.status}
                  </div>
                  <SheetTitle className="text-2xl font-black text-white uppercase tracking-tight leading-none">
                    {selectedBooking.group_name || "Guest Team"}
                  </SheetTitle>
                  <div className="flex items-center gap-4 text-stone-400 font-bold text-[10px] uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-primary/50" /> {selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMM") : "—"}</span>
                    <span>Ref: #{selectedBooking.id}</span>
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-2.5">
                <DetailTile icon={<Users className="w-3.5 h-3.5" />} label="Team Size" value={`${selectedBooking.group_size} Guests`} />
                <DetailTile icon={<BadgePoundSterling className="w-3.5 h-3.5" />} label="Status" value={selectedBooking.paid_amount && selectedBooking.paid_amount > 0 ? "Paid" : "Unpaid"} />
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-4 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-lg shadow-md">
                  {selectedBooking.contacts?.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-white uppercase truncate tracking-wide">{selectedBooking.contacts?.full_name}</p>
                  <p className="text-[10px] font-bold text-stone-500 truncate mt-0.5">{selectedBooking.contacts?.email}</p>
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
                {/* INTERACTION FIX: Force dropdown to be non-modal and handle pointer events correctly for mobile */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 rounded-xl border-white/10 bg-white/5 text-white font-black text-[11px] uppercase tracking-widest active:scale-95 shadow-inner touch-none"
                      onPointerDown={(e) => e.stopPropagation()} // Prevent sheet from closing on touch
                    >
                      Set Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-[#1a2109] border-primary/50 w-52 p-1.5 z-9999 shadow-2xl"
                    style={{ backgroundColor: '#1a2109' }}

                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    {Object.keys(statusTheme).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onSelect={() => handleStatusChange(selectedBooking!.id, s)}
                        className="font-bold text-[10px] p-3 uppercase rounded-lg cursor-pointer hover:bg-white/10"
                      >
                        <div className={cn("w-2.5 h-2.5 rounded-full mr-3", statusTheme[s].dot)} />
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button asChild className="h-14 rounded-xl bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform">
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing Floor
        </div>
      )}
    </div>
  )
}

function BookingCard({ booking, onClick, showDate }: { booking: Booking, onClick: () => void, showDate?: boolean }) {
  const status = booking.status?.toLowerCase() || 'pending';
  const theme = statusTheme[status];

  return (
    <div
      onClick={onClick}
      className="group hover:bg-white/8 active:scale-[0.99] transition-all border border-white/5 rounded-xl p-3.5 flex items-center justify-between cursor-pointer bg-white/5 relative overflow-hidden"
      style={{ backgroundColor: '#1a2109' }}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", theme.dot)} />

      <div className="flex items-center gap-3.5 min-w-0 text-left">
        <div className="min-w-0 pl-1">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-bold text-white truncate uppercase tracking-tight">
              {booking.group_name || "Guest Entry"}
            </h4>
            {showDate && booking.events?.event_date && (
              <span className="px-1.5 py-0 rounded bg-primary/15 text-[7px] font-black text-primary border border-primary/30 uppercase tracking-tighter">
                {format(new Date(booking.events.event_date), "dd/MM")}
              </span>
            )}
          </div>
          <p className="text-[8px] font-bold text-stone-500 uppercase tracking-widest truncate mt-0.5">
            {booking.contacts?.full_name}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/10 shadow-sm">
          <Users className="w-2.5 h-2.5 text-primary/50" />
          <span className="text-[10px] font-black text-white">{booking.group_size}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-white/10 group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

function KPIBox({ label, value, icon, color = "default" }: { label: string, value: string | number, icon: React.ReactNode, color?: "amber" | "default" }) {
  return (
    <div className={cn(
      "bg-white/8 border border-white/10 rounded-xl p-3 space-y-0.5 transition-all shadow-sm",
      color === "amber" && "bg-amber-500/10 border-amber-500/20"
    )}>
      <div className="flex items-center justify-between mb-0.5 opacity-50">
        <span className="text-[7px] font-black uppercase tracking-widest text-white/80">{label}</span>
        <div className="scale-75 origin-right">{icon}</div>
      </div>
      <div className="text-lg font-black text-white leading-none tracking-tight">{value}</div>
    </div>
  )
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white/10 border border-white/5 p-4 rounded-2xl flex flex-col gap-0.5 text-left group shadow-inner">
      <div className="flex items-center gap-1.5 text-white/30 group-hover:text-primary transition-colors">
        <div className="scale-75 origin-left">{icon}</div>
        <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-white font-bold text-[11px] uppercase tracking-tight">{value}</span>
    </div>
  )
}
