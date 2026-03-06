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
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* 1. Integrated Date Navigation (TOP) */}
      {/* <div className="space-y-4">
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
      </div> */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Current Schedule</h3>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-auto p-0 hover:bg-transparent flex items-center gap-3 group">
                <div className="bg-primary/10 p-3 rounded-2xl border border-primary/20 group-hover:scale-110 transition-transform">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="text-xl font-black text-white uppercase tracking-tight leading-none">
                    {selectedDate ? format(selectedDate, "do MMMM") : "All History"}
                  </div>
                  <div className="text-[10px] font-bold text-stone-500 uppercase mt-1 tracking-widest flex items-center gap-1">
                    Tap to change <ChevronRight className="w-2.5 h-2.5" />
                  </div>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="bg-[#1a2109] border-white/10 p-0 w-auto shadow-2xl overflow-hidden isolate z-9999"
              style={{ backgroundColor: '#1a2109' }}
              align="start"
            >
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { if(d) setSelectedDate(d); setIsCalendarOpen(false); }}
                className="bg-[#1a2109] isolate z-9999" 
                style={{ backgroundColor: '#1a2109' }}
              />
              <div className="p-3 border-t border-white/5 bg-black/20">
                <Button 
                  variant="ghost" 
                  className="w-full text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 h-10 rounded-xl"
                  onClick={() => { setSelectedDate(undefined); setIsCalendarOpen(false); }}
                >
                  <CalendarIcon className="w-3 h-3 mr-2" /> View All History
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* 2. Compact KPI Grid */}
      {/* <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPIBox label="Total Guests" value={stats.totalGuests} icon={<Users />} subText="Confirmed seating" />
        <KPIBox label="Est. Revenue" value={`£${stats.revenue}`} icon={<BadgePoundSterling />} subText="Deposit totals" />
        <KPIBox label="Waitlist" value={stats.waitlist} icon={<Clock3 />} subText="Waiting for space" color={stats.waitlist > 0 ? "amber" : "default"} />
        <KPIBox label="Total Teams" value={stats.totalTeams} icon={<TableIcon />} subText="Active bookings" />
      </div> */}

        {/* Search Input Integrated */}
        <div className="relative w-full sm:w-64 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Find a team..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-14 rounded-2xl bg-black/20 border-white/5 pl-12 text-sm text-white placeholder:text-white/10 focus:ring-primary/20 focus:border-white/10 transition-all"
          />
        </div>
      </div>

      {/* 2. KPI Grid - Improved Glass Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPIBox label="Total Guests" value={stats.totalGuests} icon={<Users />} subText="Confirmed seating" />
        <KPIBox label="Est. Revenue" value={`£${stats.revenue}`} icon={<BadgePoundSterling />} subText="Deposit totals" />
        <KPIBox label="Waitlist" value={stats.waitlist} icon={<Clock3 />} subText="Waiting for space" color={stats.waitlist > 0 ? "amber" : "default"} />
        <KPIBox label="Total Teams" value={stats.totalTeams} icon={<TableIcon />} subText="Active bookings" />
      </div>

      

      {/* 3. Filter & Search Integrated */}
      {/* <div className="flex gap-2">
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
      </div> */}

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Live Floor ({filteredBookings.length})
          </span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 rounded-full bg-white/5 border-white/5 text-[9px] font-black uppercase tracking-widest text-stone-400 px-4">
              <Filter className="w-3 h-3 mr-2 opacity-50" /> {statusFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#1a2109] border-white/10 w-48 p-1 isolate z-9999" style={{ backgroundColor: '#1a2109' }}>
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
              {['all', 'confirmed', 'waitlisted', 'pending', 'cancelled'].map(s => (
                <DropdownMenuRadioItem key={s} value={s} className="text-[11px] font-bold uppercase tracking-wider p-3 rounded-lg cursor-pointer">
                  {s}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      {/* 4. Floor List */}
{/*       <div className="space-y-2 pt-2">
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
      </div> */}

      <div className="space-y-3 pb-24">
        {filteredBookings.length === 0 ? (
          <div className="py-24 text-center bg-black/10 rounded-[3rem] border border-dashed border-white/5">
            <Inbox className="w-12 h-12 text-white/5 mx-auto mb-4" />
            <p className="text-stone-600 text-[11px] font-black uppercase tracking-[0.2em] max-w-45 mx-auto leading-relaxed">
              No matching bookings for this view
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
        <SheetContent 
          side="bottom"
          className="bg-[#1a2109] border-t border-white/10 rounded-t-[3.5rem] p-8 max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: '#1a2109' }}
        >
          {selectedBooking && (
            <div className="space-y-8 max-w-lg mx-auto">
              <div className="flex justify-center -mt-4">
                <div className="w-16 h-1 bg-white/10 rounded-full" />
              </div>
              
              <SheetHeader className="text-left p-0">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-3">
                    <div className={cn(
                      "w-max px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      statusTheme[selectedBooking.status || 'pending']?.bg,
                      statusTheme[selectedBooking.status || 'pending']?.text,
                      statusTheme[selectedBooking.status || 'pending']?.border
                    )}>
                      {selectedBooking.status}
                    </div>
                    <SheetTitle className="text-3xl font-black text-white uppercase tracking-tight leading-none">
                      {selectedBooking.group_name || "Guest Team"}
                    </SheetTitle>
                    <div className="flex items-center gap-4 text-stone-500 font-bold text-[10px] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-primary/40" /> {selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "eeee, do MMM") : "—"}</span>
                      <span className="text-white/5">|</span>
                      <span>Ref: #{selectedBooking.id}</span>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3">
                <DetailTile icon={<Users />} label="Team Size" value={`${selectedBooking.group_size} Guests`} />
                <DetailTile icon={<BadgePoundSterling />} label="Deposit" value={selectedBooking.paid_amount && selectedBooking.paid_amount > 0 ? "Paid" : "Pending"} />
              </div>

              <div className="bg-black/20 p-6 rounded-4xl border border-white/5 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xl shadow-lg shadow-primary/10">
                  {selectedBooking.contacts?.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white uppercase truncate tracking-wide">{selectedBooking.contacts?.full_name}</p>
                  <p className="text-[10px] font-bold text-stone-500 truncate mt-1 tracking-tight">{selectedBooking.contacts?.email}</p>
                </div>
              </div>

              {selectedBooking.special_requests && (
                <div className="bg-amber-500/5 p-6 rounded-4xl border border-amber-500/10">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500/40" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/40">Request Note</span>
                  </div>
                  <p className="text-xs text-stone-300 italic leading-relaxed font-medium">
                    &quot;{selectedBooking.special_requests}&quot;
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 relative z-10000">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-16 rounded-2xl border-white/10 bg-white/5 text-white font-black text-[11px] uppercase tracking-widest active:scale-95">
                      Set Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent                    
                  className="bg-[#1a2109] border-white/10 w-56 p-2 rounded-2xl shadow-2xl"
                    style={{ backgroundColor: '#1a2109' }}                    
                  >
                    {Object.keys(statusTheme).map((s) => (
                      <DropdownMenuItem 
                        key={s} 
                        onClick={() => handleStatusChange(selectedBooking!.id, s)}
                        className="font-bold text-xs p-4 capitalize rounded-xl cursor-pointer hover:bg-white/5"
                      >
                         <div className={cn("w-2.5 h-2.5 rounded-full mr-3", statusTheme[s].dot)} />
                         {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button asChild className="h-16 rounded-2xl bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-widest active:scale-95 shadow-xl shadow-primary/10">
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
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
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
      className="group hover:bg-white/5 active:scale-[0.98] transition-all border border-white/5 rounded-2xl p-5 flex items-center justify-between cursor-pointer bg-black/10 relative overflow-hidden"
      style={{ backgroundColor: '#1a2109' }}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", theme.dot)} />

      <div className="flex items-center gap-5 min-w-0 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h4 className="text-base font-bold text-white truncate uppercase tracking-tight leading-tight">
              {booking.group_name || "Guest Team"}
            </h4>
            {showDate && booking.events?.event_date && (
              <span className="px-2 py-0.5 rounded bg-primary/10 text-[9px] font-black text-primary uppercase whitespace-nowrap">
                {format(new Date(booking.events.event_date), "dd/MM")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-[10px] font-bold text-stone-600 uppercase tracking-widest truncate">
              {booking.contacts?.full_name}
            </p>
            {booking.special_requests && (
               <MessageSquare className="w-3 h-3 text-amber-500/20" />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-xl border border-white/5 shadow-inner">
          <Users className="w-3 h-3 text-primary/40" />
          <span className="text-xs font-black text-white">{booking.group_size}</span>
        </div>
        <ChevronRight className="w-5 h-5 text-white/5 group-hover:text-primary transition-colors" />
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
      "bg-white/3 border border-white/5 rounded-3xl p-5 space-y-1 transition-all hover:bg-white/5 hover:border-white/10 group",
      color === "amber" && "bg-amber-500/5 border-amber-500/10"
    )}>
      <div className="flex items-center justify-between mb-2 opacity-30 group-hover:opacity-100 transition-opacity">
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">{label}</span>
        {React.isValidElement(icon) && React.cloneElement(icon, { 
          className: cn("w-4 h-4", icon.props.className) 
        })}
      </div>
      <div className="text-2xl font-black text-white leading-none tracking-tight">{value}</div>
      <p className="text-[9px] font-bold text-stone-600 uppercase tracking-wider leading-none mt-1">{subText}</p>
    </div>
  )
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white/3 border border-white/5 p-6 rounded-4xl flex flex-col gap-1 shadow-inner text-left group">
      <div className="flex items-center gap-2 text-white/20 mb-1 group-hover:text-primary transition-colors">
        <div className="scale-90 origin-left">{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-[0.15em]">{label}</span>
      </div>
      <span className="text-white font-bold text-sm uppercase tracking-tight">{value}</span>
    </div>
  )
}
