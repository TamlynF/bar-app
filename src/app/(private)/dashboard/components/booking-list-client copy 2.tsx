"use client"

import React, { useState, useTransition, useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { deleteBooking, updateBookingStatus } from "@/app/(private)/dashboard/actions"
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
  CalendarIcon,
  Search,
  Filter,
  ChevronRight,
  Info,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const formatDateStr = (d: Date) => {
  const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return date.toISOString().split("T")[0]
}

const statusTheme: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  confirmed: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" },
  waitlisted: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
  pending: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20", dot: "bg-slate-400" },
  cancelled: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
}

export interface Booking {
  id: string;
  event_id?: string;
  group_name?: string;
  group_size?: number;
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
  };
}

export default function BookingListClient2({ initialBookings }: { initialBookings: Booking[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [bookingActionId, setBookingActionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  // Quick View State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const filteredBookings = useMemo(() => {
    return initialBookings.filter((b) => {
      const matchesDate = selectedDate ? b.events?.event_date === formatDateStr(selectedDate) : true;
      const matchesStatus = statusFilter === "all" ? true : b.status?.toLowerCase() === statusFilter;
      const matchesSearch = searchQuery.toLowerCase() === "" ? true : 
        b.group_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        b.contacts?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesDate && matchesStatus && matchesSearch;
    });
  }, [initialBookings, selectedDate, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const reference = selectedDate || new Date();
    const contextBookings = initialBookings.filter(b => b.events?.event_date === formatDateStr(reference));
    
    return {
      total: contextBookings.length,
      confirmed: contextBookings.filter(b => b.status === "confirmed").length,
      waitlisted: contextBookings.filter(b => b.status === "waitlisted").length,
    };
  }, [initialBookings, selectedDate]);

  const handleStatusChange = (id: string, newStatus: string) => {
    setBookingActionId(id)
    startTransition(async () => {
      try {
        await updateBookingStatus(id, newStatus)
      } finally {
        setBookingActionId(null)
      }
    })
  }

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Slim Stats Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 sm:mx-0">
        <CompactStatCard 
          label="Total" 
          value={stats.total} 
          icon={<CalendarDays className="w-3 h-3" />} 
          color="blue"
        />
        <CompactStatCard 
          label="Confirmed" 
          value={stats.confirmed} 
          icon={<CheckCircle className="w-3 h-3" />} 
          color="emerald"
        />
        <CompactStatCard 
          label="Waitlist" 
          value={stats.waitlisted} 
          icon={<Clock3 className="w-3 h-3" />} 
          color="amber"
        />
      </div>

      {/* 2. Integrated Search & Date */}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-8 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
           <Input 
              placeholder="Search teams..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 rounded-2xl h-12 focus:ring-primary/30"
            />
        </div>
        <div className="col-span-4">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-12 rounded-2xl bg-white/5 border-white/10 px-0">
                <CalendarIcon className="w-5 h-5 text-primary" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-white/10 bg-[#1a2109]" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setIsCalendarOpen(false); }}
                className="text-white"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* 3. The List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            {selectedDate ? format(selectedDate, "do MMMM") : "All Bookings"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
              <Filter className="w-3 h-3" /> {statusFilter === 'all' ? 'Status' : statusFilter}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1a2109] border-white/10">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="confirmed">Confirmed</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="waitlisted">Waitlisted</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="cancelled">Cancelled</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="py-20 text-center bg-white/3 rounded-3xl border border-dashed border-white/5">
            <Inbox className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-xs font-bold uppercase tracking-widest">No matching results</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <CompactBookingRow 
              key={b.id} 
              booking={b} 
              onViewDetails={() => setSelectedBooking(b)}
            />
          ))
        )}
      </div>

      {/* 4. Quick View Detail Sheet */}
      <Sheet open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <SheetContent side="bottom" className="bg-[#1a2109] border-white/10 rounded-t-[2.5rem] h-[70vh] p-8">
          {selectedBooking && (
            <div className="space-y-8">
              <SheetHeader>
                <div className={cn(
                  "inline-flex w-max rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-2 border",
                  statusTheme[selectedBooking.status || 'pending']?.bg,
                  statusTheme[selectedBooking.status || 'pending']?.text,
                  statusTheme[selectedBooking.status || 'pending']?.border,
                )}>
                  {selectedBooking.status}
                </div>
                <SheetTitle className="text-3xl font-black text-white uppercase tracking-tight">
                  {selectedBooking.group_name}
                </SheetTitle>
                <SheetDescription className="text-stone-400">
                  Reference ID: #{selectedBooking.id}
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-4">
                <DetailBox label="Team Size" value={`${selectedBooking.group_size} People`} icon={<Users />} />
                <DetailBox label="Date" value={selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMM") : "—"} icon={<CalendarDays />} />
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-primary font-black">
                    {selectedBooking.contacts?.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white uppercase">{selectedBooking.contacts?.full_name}</p>
                    <p className="text-xs text-stone-500">{selectedBooking.contacts?.email}</p>
                  </div>
                </div>

                {selectedBooking.special_requests && (
                  <div className="bg-white/3 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase text-stone-500 mb-1">Special Requests</p>
                    <p className="text-sm italic text-stone-300">&quot;{selectedBooking.special_requests}&quot;</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-6">
                <Button 
                  asChild 
                  className="bg-[#fdcc4b] text-[#26300D] font-black rounded-xl h-14 uppercase tracking-widest"
                >
                  <a href={`/manage-booking/${selectedBooking.id}`}>
                    <Pencil className="w-4 h-4 mr-2" /> Manage
                  </a>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="border-white/10 bg-white/5 text-white font-black rounded-xl h-14 uppercase tracking-widest">
                      Set Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1a2109] border-white/10 w-48">
                    {['confirmed', 'waitlisted', 'pending', 'cancelled'].map(s => (
                      <DropdownMenuItem key={s} onClick={() => handleStatusChange(selectedBooking.id, s)} className="capitalize font-bold">
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Global Transition Loader */}
      {isPending && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Loader2 className="w-3 h-3 animate-spin" /> Syncing
        </div>
      )}
    </div>
  )
}

function CompactBookingRow({ booking, onViewDetails }: { booking: Booking, onViewDetails: () => void }) {
  const status = booking.status?.toLowerCase() || 'pending';
  const theme = statusTheme[status];

  return (
    <div 
      onClick={onViewDetails}
      className="group bg-white/3 hover:bg-white/5 active:bg-white/10 border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all cursor-pointer"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn("w-1.5 h-6 rounded-full shrink-0", theme.dot)} />
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-white truncate uppercase tracking-tight">
            {booking.group_name || "Guest"}
          </h4>
          <p className="text-[10px] font-black text-stone-600 uppercase tracking-widest">
            {booking.contacts?.full_name}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-lg">
          <Users className="w-3 h-3 text-stone-500" />
          <span className="text-xs font-bold text-stone-300">{booking.group_size}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

function CompactStatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/5 border-blue-500/10",
    emerald: "text-emerald-400 bg-emerald-500/5 border-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/5 border-amber-500/10",
  }
  
  return (
    <div className={cn("flex-none min-w-28 rounded-2xl border p-3 flex flex-col gap-1 shadow-sm", colorMap[color])}>
      <div className="flex items-center justify-between opacity-60">
        <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <span className="text-lg font-black">{value}</span>
    </div>
  )
}

function DetailBox({ label, value, icon }: { label: string, value: string, icon: React.ReactElement<{ className?: string }> }) {
  return (
    <div className="bg-white/3 border border-white/5 p-4 rounded-4xl flex flex-col gap-1 shadow-inner">
      <div className="flex items-center gap-2 text-white/20">
        {React.cloneElement(icon, { 
          className: "w-3 h-3"
        })}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-white font-bold text-base uppercase tracking-tight leading-tight">{value}</span>
    </div>
  )
}