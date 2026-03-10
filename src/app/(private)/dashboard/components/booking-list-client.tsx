"use client"

import React, { useMemo, useState } from "react"
import {
  Users, 
  Trophy, 
  Target, 
  Search, 
  CheckCircle2, 
  Clock3, 
  XCircle, 
  HelpCircle,
  ChevronRight,
  MapPin,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Booking } from "../../events/quiz-bookings/page"

const statusTheme: Record<string, {
    color: string
    bg: string
    border: string
    icon: React.ElementType
  }> = {
  confirmed: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2 },
  waitlisted: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: Clock3 },
  pending: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: HelpCircle },
  cancelled: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: XCircle },
}

export default function BookingListClient({ initialBookings }: { initialBookings: Booking[], selectedDate?: string }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return initialBookings.filter(b => {
      const status = b.status?.toLowerCase() || ""
      const matchesStatus = !activeFilter || status === activeFilter
      const matchesSearch = !searchQuery || 
        (b.group_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.contacts?.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [initialBookings, activeFilter, searchQuery])

  return (
<div className="space-y-6">
      {/* Search & Quick Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search teams..." 
            className="pl-10 h-11 bg-white rounded-xl border-[#E6DFC8] focus:ring-primary/20" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Status Chips - Better than scrolling circles for primary actions */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {['confirmed', 'waitlisted', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setActiveFilter(activeFilter === status ? null : status)}
              className={cn(
                "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap shadow-sm",
                activeFilter === status 
                  ? "bg-[#26300D] text-[#FDCC4B] border-[#26300D]" 
                  : "bg-white text-muted-foreground border-[#E6DFC8] hover:border-[#26300D]"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Booking List */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.length > 0 ? (
          filtered.map(booking => (
            <EnhancedBookingCard key={booking.id} booking={booking} />
          ))
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-[#E6DFC8] rounded-[2.5rem] bg-white/30">
             <p className="text-xs font-black text-[#5F624F] uppercase tracking-[0.2em] opacity-40">No entries found</p>
          </div>
        )}
      </div>
    </div>
  )
}

function EnhancedBookingCard({ booking }: { booking: Booking }) {
  const status = booking.status?.toLowerCase() || 'pending'
  const theme = statusTheme[status] || statusTheme.pending
  const StatusIcon = theme.icon
  const tableName = booking.booking_table_mappings?.[0]?.tables?.tables_name
  const score = booking.booking_scores?.[0]?.score

  const displayId = String(booking.id).slice(-4)
  return (
    <div className="group relative bg-white border border-[#E6DFC8] rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-4 overflow-hidden">
      {/* Status Accent Line (Desktop only) */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 hidden md:block", theme.color.replace('text', 'bg'))} />

      {/* slot: Leading (Visual) */}
      <div className="flex items-center justify-between md:justify-start gap-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-inner", theme.bg, theme.border, theme.color)}>
           <StatusIcon className="w-6 h-6" />
        </div>
        
        {/* Mobile-only secondary info at top right */}
        <div className="md:hidden flex flex-col items-end">
           {score !== undefined && (
             <div className="bg-[#1F1F1A] text-white px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
               <Target className="w-3 h-3 text-[#FDCC4B]" />
               <span className="text-xs font-black">{score}</span>
             </div>
           )}
           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">ID: {displayId}</span>
        </div>
      </div>

      {/* slot: Main Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="font-black text-base md:text-lg text-[#1F1F1A] uppercase tracking-tight truncate leading-none">
            {booking.group_name || "Untitled Team"}
          </h4>
          {booking.special_requests && (
            <div className="bg-red-500 rounded-full p-1 shadow-sm ring-2 ring-white animate-pulse">
              <AlertCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Users className="w-3.5 h-3.5 opacity-70" />
            <span className="text-xs font-bold">{booking.group_size} Guests</span>
          </div>
          <span className="hidden md:inline text-slate-200">|</span>
          <div className="flex items-center gap-1.5 text-slate-500">
            <MapPin className="w-3.5 h-3.5 opacity-70" />
            <span className="text-xs font-bold uppercase tracking-wide">{tableName || 'Unassigned'}</span>
          </div>
          <span className="hidden md:inline text-slate-200">|</span>
          <p className="text-xs font-medium text-slate-400 truncate max-w-[120px] sm:max-w-none italic">
            {booking.contacts?.full_name}
          </p>
        </div>
      </div>

      {/* Trailing Slot (Desktop Score & Navigation) */}
      <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-50">
        <div className="flex items-center gap-2">
           <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-xs", theme.bg, theme.color, theme.border)}>
              {status}
           </div>
           
           {/* Desktop Score Badge */}
           {score !== undefined && (
             <div className="hidden md:flex bg-[#1F1F1A] text-white px-3 py-1.5 rounded-xl items-center gap-2 shadow-lg border border-white/10">
                <Trophy className="w-4 h-4 text-[#FDCC4B]" />
                <span className="text-sm font-black">{score}</span>
             </div>
           )}
        </div>

        <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-50 h-10 w-10 text-slate-300 hover:text-[#26300D] transition-colors">
           <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}
