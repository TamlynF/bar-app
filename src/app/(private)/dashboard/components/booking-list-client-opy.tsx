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

  const quickDates = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(new Date(), i));
  }, []);

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
    startTransition(async () => {
      try {
        await updateBookingStatus(id, newStatus)
      } finally {
        setBookingActionId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Integrated Date Navigation (TOP) */}
      <div className="space-y-4">
        <div className="flex items-end justify-between px-1">
          <div className="space-y-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Schedule View</h3>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex items-center gap-2 text-xl font-black text-white uppercase tracking-tight leading-none group outline-none">
                    {selectedDate ? format(selectedDate, "do MMMM") : "All History"}
                    <ChevronDown className="w-5 h-5 text-primary transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
			align="start" 
			className="bg-[#1a2109] border-white/10 w-64 p-2 shadow-2xl isolate z-9999" style={{ backgroundColor: '#1a2109' }}
			>
                  <DropdownMenuLabel className="text-[9px] uppercase font-black text-stone-500 tracking-widest px-3 py-2">Quick Selection</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setSelectedDate(undefined)} className="font-bold text-xs p-3 rounded-xl cursor-pointer">
                    Show All History
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/5 mx-2" />
                  {quickDates.map((date) => (
                    <DropdownMenuItem 
                      key={date.toISOString()} 
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        "font-bold text-xs p-3 rounded-xl cursor-pointer", 
                        selectedDate && isSameDay(date, selectedDate) && "text-primary bg-primary/10"
                      )}
                    >
                      {isSameDay(date, new Date()) ? "Today, " : ""}{format(date, "eeee, do")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" title="Open Calendar" aria-label="Open Calendar" className="bg-white/5 border-white/10 text-primary font-bold uppercase tracking-widest text-[9px] h-10 px-4 rounded-xl shadow-xl hover:bg-white/10">
                <CalendarIcon className="w-3.5 h-3.5 mr-2 opacity-60" /> Custom
              </Button>
            </PopoverTrigger>
            <PopoverContent className="bg-[#1a2109] border-white/10 p-0 w-auto shadow-2xl isolate z-9999" style={{ backgroundColor: '#1a2109' }} align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { if(d) setSelectedDate(d); setIsCalendarOpen(false); }}
                className="bg-[#1a2109] rounded-t-xl isolate z-9999" 
                style={{ backgroundColor: '#1a2109' }}
              />
              <div className="p-3 border-t border-white/5 bg-[#141a07]/50 rounded-b-xl">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  title="Clear date selection"
                  aria-label="Clear date selection"
                  className="w-full text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-500/10 h-11 rounded-xl transition-colors"
                  onClick={() => {
                    setSelectedDate(undefined);
                    setIsCalendarOpen(false);
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-2" /> Clear Date
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* 2. Compact KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPIBox label="Guests" value={stats.totalGuests} icon={<Users />} subText="Confirmed" />
        <KPIBox label="Revenue" value={`£${stats.revenue.toFixed(0)}`} icon={<BadgePoundSterling />} subText="Estimated" />
        <KPIBox label="Waitlist" value={stats.waitlist} icon={<Clock3 />} subText="Teams" color={stats.waitlist > 0 ? "amber" : "default"} />
        <KPIBox label="Bookings" value={stats.totalTeams} icon={<TableIcon />} subText="Total" />
      </div>

      {/* 3. Filter & Search Integrated */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
          <Input 
            placeholder="Search teams..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 rounded-xl bg-white/5 border-white/10 pl-10 text-xs text-white placeholder:text-white/20 focus:ring-primary/20"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 px-3 rounded-xl bg-white/5 border-white/10 text-stone-400">
              <Filter className="w-4 h-4 mr-2 opacity-60" />
              <span className="text-[9px] uppercase font-black tracking-widest">{statusFilter === 'all' ? 'Filter' : statusFilter}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#1a2109] border-white/10 w-48 isolate z-9999" style={{ backgroundColor: '#1a2109' }}>
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
              <DropdownMenuRadioItem value="all" className="text-xs font-bold p-3">All Statuses</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="confirmed" className="text-xs font-bold p-3 text-emerald-400">Confirmed</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="waitlisted" className="text-xs font-bold p-3 text-amber-400">Waitlisted</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="pending" className="text-xs font-bold p-3 text-slate-400">Pending</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 4. Floor List */}
      <div className="space-y-2 pt-2">
        <div className="px-2 flex items-center gap-3 mb-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/20 whitespace-nowrap">
          <div className="h-px flex-1 bg-white/5" />
          <span>Floor Overview ({filteredBookings.length})</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        {filteredBookings.length === 0 ? (
          <div className="py-20 text-center bg-white/3 rounded-[2.5rem] border border-dashed border-white/10">
            <Inbox className="w-10 h-10 text-white/5 mx-auto mb-3" />
            <p className="text-stone-600 text-[10px] font-black uppercase tracking-widest leading-loose text-center">
              No results found<br/>for selected timeframe
            </p>
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
        <SheetContent side="bottom" className="bg-[#1a2109] border-t border-white/10 rounded-t-[3rem] p-6 max-h-[85vh] overflow-y-auto isolate z-9999"
          style={{ backgroundColor: '#1a2109' }}
        >
          {selectedBooking && (
            <div className="space-y-6 pb-6">
              <div className="flex justify-center -mt-2">
                <div className="w-12 h-1.5 bg-white/10 rounded-full" />
              </div>
              
              <SheetHeader>
              <div className="flex justify-between items-start">
                  <div className="space-y-2 text-left">
                  <div className={cn(
                    "w-max px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border",
                    statusTheme[selectedBooking.status || 'pending']?.bg,
                    statusTheme[selectedBooking.status || 'pending']?.text,
                    statusTheme[selectedBooking.status || 'pending']?.border
                  )}>
                    {selectedBooking.status}
                  </div>
                    <SheetTitle className="text-2xl font-black text-white uppercase tracking-tight leading-none">
                    {selectedBooking.group_name}
                    </SheetTitle>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="bg-primary/10 px-2 py-1 rounded text-[9px] font-black text-primary uppercase border border-primary/20">
                    #{selectedBooking.id}
                  </div>
                    <SheetDescription className="text-[9px] text-stone-500 font-bold uppercase mt-1.5 tracking-wider">
                    {selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMM") : "—"}
                    </SheetDescription>
                </div>
              </div>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3">
                <DetailTile icon={<Users />} label="Team Size" value={`${selectedBooking.group_size} People`} />
                <DetailTile icon={<BadgePoundSterling />} label="Payment" value={selectedBooking.paid_amount && selectedBooking.paid_amount > 0 ? "Deposit Paid" : "Unpaid"} />
              </div>

              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#26300D] flex items-center justify-center text-primary font-black border border-white/5 text-lg">
                  {selectedBooking.contacts?.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-black text-white uppercase truncate tracking-wide">{selectedBooking.contacts?.full_name}</p>
                  <p className="text-[10px] font-bold text-stone-500 truncate mt-0.5 tracking-tight">{selectedBooking.contacts?.email}</p>
                </div>
              </div>

              {selectedBooking.special_requests && (
                <div className="bg-amber-500/5 p-5 rounded-3xl border border-amber-500/10 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500/50" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/50">Host Note</span>
                  </div>
                  <p className="text-xs text-stone-300 italic leading-relaxed font-medium">
                    &quot;{selectedBooking.special_requests}&quot;
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-16 rounded-2xl border-white/10 bg-white/5 text-white font-black text-[11px] uppercase tracking-widest">
                      Set Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#1a2109] border-white/10 w-56 p-2 isolate z-9999" style={{ backgroundColor: '#1a2109' }}>
                    {Object.keys(statusTheme).map((s) => (
                      <DropdownMenuItem 
                        key={s} 
                        onClick={() => handleStatusChange(selectedBooking.id, s)}
                        className="font-bold text-xs p-3 capitalize rounded-xl cursor-pointer"
                      >
                         <div className={cn("w-2 h-2 rounded-full mr-2", statusTheme[s].dot)} />
                         {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button asChild className="h-16 rounded-2xl bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-widest">
                  <a href={`/manage-booking/${selectedBooking.id}`}>
                    <Pencil className="w-4 h-4 mr-2" /> Manage
                  </a>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Global Sync Overlay */}
      {isPending && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Syncing Floor
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
      className="group hover:bg-white/5 active:scale-[0.99] transition-all border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer isolate z-9999 bg-card-solid"
      style={{ backgroundColor: '#1a2109' }}
    >
      <div className="flex items-center gap-4 min-w-0 text-left">
        <div className={cn("w-1 h-8 rounded-full shrink-0", theme.dot)} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white truncate uppercase tracking-tight leading-tight">
              {booking.group_name || "Guest Team"}
            </h4>
            {showDate && booking.events?.event_date && (
              <span className="text-[8px] font-black text-primary/40 uppercase whitespace-nowrap">
                {format(new Date(booking.events.event_date), "dd/MM")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[9px] font-bold text-stone-600 uppercase tracking-widest truncate">
              {booking.contacts?.full_name}
            </p>
            {booking.special_requests && (
               <MessageSquare className="w-2.5 h-2.5 text-amber-500/30" />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1.5 rounded-xl border border-white/5">
          <Users className="w-2.5 h-2.5 text-primary/60" />
          <span className="text-[11px] font-bold text-white">{booking.group_size}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/5 group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}
function KPIBox({ 
  label, 
  value, 
  icon, 
  subText, 
  color = "default" 
}: { 
  label: string, 
  value: string | number, 
  icon: React.ReactElement<{ className?: string }>, 
  subText: string, 
  color?: "amber" | "default" 
}) {
  return (
    <div className={cn(
      "bg-white/2 border border-white/5 rounded-xl p-3.5 space-y-0.5 transition-colors",
      color === "amber" && "bg-amber-500/5 border-amber-500/10"
    )}>
      <div className="flex items-center justify-between mb-1 opacity-40">
        <span className="text-[7px] font-black uppercase tracking-widest text-white">{label}</span>
        {React.isValidElement(icon) && React.cloneElement(icon, { 
          className: cn("w-3 h-3", icon.props.className) 
        })}
      </div>
      <div className="text-base font-black text-white leading-none">{value}</div>
      <p className="text-[7px] font-bold text-stone-600 uppercase tracking-tighter leading-none">{subText}</p>
    </div>
  )
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white/3 border border-white/5 p-5 rounded-3xl flex flex-col gap-0.5 shadow-inner text-left">
      <div className="flex items-center gap-1.5 text-white/10 mb-0.5">
        <div className="scale-75 origin-left">{icon}</div>
        <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-white font-bold text-xs uppercase tracking-tight">{value}</span>
    </div>
  )
}
