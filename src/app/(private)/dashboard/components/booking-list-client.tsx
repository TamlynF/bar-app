"use client"

import React, { useMemo, useState, useTransition, useEffect, useRef } from "react"
import styles from "./booking-list-client.module.css"
import { format, isSameDay } from "date-fns"
import { updateBookingStatus, deleteBooking, updateBookingDetails } from "@/app/(private)/actions/booking-actions"
import {
  CheckCircle2,
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
  MessageSquare,
  LayoutDashboard,
  Trophy,
  Target,
  AlertCircle,
  Trash2,
  Calendar,
  Hash,
  ExternalLink,
  ChevronDown,
  Save,
  X,
  MessageSquareQuote
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Booking } from "../../events/quiz-bookings/page"

const formatDateStr = (d: Date | string) => {
  if (typeof d === 'string') return d;
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
    icon: <TableIcon className="w-5 h-5" />,
  },
  confirmed: {
    bg: "bg-green-50 dark:bg-green-500/10",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-500/30",
    dot: "bg-green-500",
    ring: "ring-green-500/40",
    cardBorder: "border-green-500/50 dark:border-green-500/40",
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  waitlisted: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-500/30",
    dot: "bg-orange-500",
    ring: "ring-orange-500/40",
    cardBorder: "border-orange-500/50 dark:border-orange-500/40",
    icon: <Clock3 className="w-5 h-5" />,
  },
  pending: {
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-500/30",
    dot: "bg-yellow-500",
    ring: "ring-yellow-500/40",
    cardBorder: "border-yellow-500/50 dark:border-yellow-500/40",
    icon: <HelpCircle className="w-5 h-5" />,
  },
  cancelled: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-500/30",
    dot: "bg-red-500",
    ring: "ring-red-500/40",
    cardBorder: "border-red-500/50 dark:border-red-500/40",
    icon: <XCircle className="w-5 h-5" />,
  },
}

export default function BookingListClient({ initialBookings, selectedDate }: { initialBookings: Booking[], selectedDate?: string | undefined }) {
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(new Set())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    group_name: "",
    group_size: 0,
    special_requests: ""
  })
  
  const searchParams = useSearchParams()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topFocusRef = useRef<HTMLSpanElement>(null)

  const isDateFiltered = !!(selectedDate || searchParams.get('date'));

  const toggleStatusFilter = (status: string) => {
    const next = new Set(activeStatusFilters)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setActiveStatusFilters(next)
  }

  const handleEnterEditMode = () => {
    if (selectedBooking) {
      setEditForm({
        group_name: selectedBooking.group_name || "",
        group_size: selectedBooking.group_size || 0,
        special_requests: selectedBooking.special_requests || ""
      })
      setIsEditing(true)
    }
  }

  const handleSelectBooking = (booking: Booking) => {
    setSelectedBooking(booking)
    setIsEditing(false)
  }

  // Scroll reset when booking opens - optimized effect
  useEffect(() => {
    if (selectedBooking) {
      const timer = setTimeout(() => {
        topFocusRef.current?.focus();
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedBooking])

  const filteredBookings = useMemo(() => {
    return initialBookings
      .filter((b) => {
        const bDate = b.events?.event_date ? new Date(b.events.event_date) : null
        const matchesDate = selectedDate && bDate ? isSameDay(bDate, new Date(selectedDate)) : !selectedDate
        const bStatus = normStatus(b.status)
        const matchesStatus = activeStatusFilters.size === 0 ? true : activeStatusFilters.has(bStatus)
        const q = searchQuery.trim().toLowerCase()
        return matchesDate && matchesStatus && (
          q === "" || 
          (b.group_name || "").toLowerCase().includes(q) ||
          (b.contacts?.full_name || "").toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const dateA = a.events?.event_date || ""
        const dateB = b.events?.event_date || ""
        if (dateA !== dateB) return dateB.localeCompare(dateA)
        return (a.group_name || "").localeCompare(b.group_name || "")
      })
  }, [initialBookings, selectedDate, activeStatusFilters, searchQuery])

  const stats = useMemo(() => {
    const dateFilter = selectedDate ? (typeof selectedDate === 'string' ? selectedDate : formatDateStr(selectedDate)) : null;
    const contextBookings = dateFilter
      ? initialBookings.filter((b) => b.events?.event_date === dateFilter)
      : initialBookings

    return {
      totalTeams: contextBookings.length,
      counts: {
        confirmed: contextBookings.filter((b) => normStatus(b.status) === "confirmed").length,
        waitlisted: contextBookings.filter((b) => normStatus(b.status) === "waitlisted").length,
        pending: contextBookings.filter((b) => {
          const s = normStatus(b.status)
          return s === "" || s === "pending"
        }).length,
        cancelled: contextBookings.filter((b) => normStatus(b.status) === "cancelled").length,
      }
    }
  }, [initialBookings, selectedDate])

  const handleStatusChange = (id: string, newStatus: string) => {
    startTransition(async () => {
      try {
        await updateBookingStatus(id, newStatus)
        if (selectedBooking?.id === id) {
          setSelectedBooking(prev => prev ? { ...prev, status: newStatus } : null)
        }
        toast.success(`Status updated to ${newStatus}`)
      } catch (error) {
        console.error(error)
        toast.error("Failed to update status")
      }
    })
  }

  const handleSaveDetails = () => {
    if (!selectedBooking) return
    startTransition(async () => {
      try {
        await updateBookingDetails(selectedBooking.id, editForm)
        setSelectedBooking(prev => prev ? { ...prev, ...editForm } : null)
        setIsEditing(false)
        toast.success("Booking updated successfully")
      } catch (error) {
        console.error(error)
        toast.error("Failed to save changes")
      }
    })
  }

  const handleDeleteBooking = (id: string) => {
    startTransition(async () => {
      try {
        await deleteBooking(id)
        setSelectedBooking(null)
        setIsEditing(false)
        toast.success("Booking deleted permanently")
      } catch (error) {
        console.error(error)
        toast.error("Failed to delete booking")
      }
    })
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* Stats Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 flex items-center justify-between shadow-sm overflow-x-auto no-scrollbar">
        <div className="flex items-center justify-start gap-3 sm:gap-5 w-full px-2 min-w-max py-4">
          <StatusCircle count={stats.totalTeams} status="all" label="Total" isActive={activeStatusFilters.size === 0} onClick={() => setActiveStatusFilters(new Set())} />
          <StatusCircle count={stats.counts.confirmed} status="confirmed" label="Joining" isActive={activeStatusFilters.has("confirmed")} onClick={() => toggleStatusFilter("confirmed")} />
          <StatusCircle count={stats.counts.waitlisted} status="waitlisted" label="Waiting" isActive={activeStatusFilters.has("waitlisted")} onClick={() => toggleStatusFilter("waitlisted")} />
          <StatusCircle count={stats.counts.pending} status="pending" label="Pending" isActive={activeStatusFilters.has("pending")} onClick={() => toggleStatusFilter("pending")} />
          <StatusCircle count={stats.counts.cancelled} status="cancelled" label="Cancelled" isActive={activeStatusFilters.has("cancelled")} onClick={() => toggleStatusFilter("cancelled")} />
        </div>
      </div>

      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search team names or guests..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="h-10 rounded-lg pl-10 text-sm shadow-sm"
        />
        {activeStatusFilters.size > 0 && (
          <button type="button" onClick={() => setActiveStatusFilters(new Set())} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-1 rounded">
            Clear
          </button>
        )}
      </div>

      {/* Booking Cards */}
      <div className="space-y-2.5 pb-5">
        {filteredBookings.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">No bookings found</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <BookingCard key={b.id} booking={b} showDate={!isDateFiltered} onClick={() => handleSelectBooking(b)} />
          ))
        )}
      </div>

      {/* POPUP DETAIL PAGE */}
      <Sheet 
        open={!!selectedBooking} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBooking(null)
            setIsEditing(false)
          }
        }}
      >
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh] flex flex-col outline-none shadow-2xl"
        >
          {selectedBooking && (
            <>
              <span ref={topFocusRef} tabIndex={-1} className="sr-only" />
              
              {/* HEADER: Reference visible + Edit/Delete buttons top right */}
              <div className="shrink-0 p-6 pb-4 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 flex flex-row items-start justify-between gap-4">
                <div className="flex-1 min-w-0 text-left">
                  <SheetTitle className="text-2xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                    {isEditing ? "Modify Record" : (selectedBooking.group_name || "Guest Team")}
                  </SheetTitle>
                  
                  {/* REFERENCE ID: Now positioned directly below the title */}
                  <div className="flex items-center gap-1.5 mt-1.5 opacity-50">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-[10px] font-black text-[#5F624F] uppercase tracking-widest tabular-nums">
                      Record #{selectedBooking.id}
                    </span>
                  </div>
                </div>

                {/* TOP RIGHT ACTION GROUP (Positions buttons next to the sheet close 'X') */}
                <div className="flex items-center gap-2 pt-1 pr-10">
                  {!isEditing && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all active:scale-90 shadow-sm border border-red-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          if(window.confirm("Permanently delete this booking?")) handleDeleteBooking(selectedBooking.id)
                        }}
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        onClick={handleEnterEditMode} 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-xl border-2 border-[#E6DFC8] bg-white text-[#26300D] transition-all active:scale-90 shadow-sm"
                        title="Edit Details"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Scrollable Body */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 min-h-0 touch-pan-y overscroll-contain text-left">
                
                {/* STATUS BADGE: Now inside the scrollable body content */}
                {!isEditing && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border shadow-sm",
                      statusTheme[normStatus(selectedBooking.status) || "pending"]?.bg,
                      statusTheme[normStatus(selectedBooking.status) || "pending"]?.text,
                      statusTheme[normStatus(selectedBooking.status) || "pending"]?.border,
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", statusTheme[normStatus(selectedBooking.status) || "pending"]?.dot)} />
                      {normStatus(selectedBooking.status) || "pending"}
                    </div>
                  </div>
                )}

                {isEditing ? (
                  // EDIT MODE FORM - Consistent with Quiz Generator inline editor
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Team Name</Label>
                      <Input 
                        value={editForm.group_name} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({...prev, group_name: e.target.value}))}
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white text-base font-bold px-4 focus:ring-2 focus:ring-[#26300D]/10 focus:border-[#26300D]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Team Size</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {[2, 4, 6].map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setEditForm(prev => ({...prev, group_size: size}))}
                            className={cn(
                              "h-12 rounded-xl border-2 font-black text-xs transition-all",
                              editForm.group_size === size 
                                ? "bg-[#26300D] border-[#26300D] text-[#FDCC4B] scale-105 shadow-md" 
                                : "bg-white border-[#E6DFC8] text-[#5F624F] hover:border-[#26300D]/30"
                            )}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-[#E6DFC8]">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1 mb-3 block">Quick Status Switch</Label>
                       <div className="flex flex-wrap gap-2">
                         {Object.keys(statusTheme).filter(s => s !== 'all').map(s => (
                           <button
                             key={s}
                             type="button"
                             onClick={() => handleStatusChange(selectedBooking.id, s)}
                             className={cn(
                               "px-4 py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all",
                               normStatus(selectedBooking.status) === s 
                                ? `${statusTheme[s].bg} ${statusTheme[s].border} ${statusTheme[s].text} ring-2 ring-offset-2 ring-primary/10 shadow-sm`
                                : "bg-white border-[#E6DFC8] text-slate-400 hover:border-[#26300D]/30"
                             )}
                           >
                             {s}
                           </button>
                         ))}
                       </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Special Requests</Label>
                      <Textarea 
                        value={editForm.special_requests} 
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => ({...prev, special_requests: e.target.value}))}
                        placeholder="Dietary requirements, table preference..."
                        className="min-h-[140px] rounded-2xl border-2 border-[#E6DFC8] bg-white text-sm font-medium p-4 focus:ring-2 focus:ring-[#26300D]/10 focus:border-[#26300D] resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  // VIEW MODE DETAILS
                  <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Score Summary - High Contrast Theme */}
                    {selectedBooking.booking_scores?.[0] && (
                      <div className="bg-[#26300D] text-white p-6 rounded-[2.5rem] shadow-xl flex items-center justify-between border border-white/10 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-full bg-[#FDCC4B]/5 pointer-events-none group-hover:bg-[#FDCC4B]/10 transition-colors" />
                        <div className="relative z-10">
                          <p className="text-[10px] font-black text-[#FDCC4B] uppercase tracking-[0.3em] opacity-60 mb-1">Game Performance</p>
                          <h3 className="text-5xl font-black tracking-tighter tabular-nums">{selectedBooking.booking_scores[0].score} <span className="text-sm font-bold opacity-30 tracking-normal ml-1">pts</span></h3>
                        </div>
                        {selectedBooking.booking_scores[0].is_winner && (
                          <div className="bg-[#FDCC4B] p-4 rounded-2xl shadow-lg rotate-12 group-hover:rotate-0 transition-transform">
                            <Trophy className="w-10 h-10 text-[#26300D]" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <DetailTile icon={<Calendar className="w-4 h-4" />} label="Event Date" value={selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMM yyyy") : "—"} />
                      <DetailTile icon={<Users className="w-4 h-4" />} label="Team Size" value={`${selectedBooking.group_size} Guests`} />
                      <DetailTile icon={<LayoutDashboard className="w-4 h-4" />} label="Seating" value={selectedBooking.booking_table_mappings?.[0]?.tables?.tables_name || "Unassigned"} />
                      <DetailTile icon={<Clock3 className="w-4 h-4" />} label="Booked On" value={selectedBooking.booking_created_at ? format(new Date(selectedBooking.booking_created_at), "HH:mm, do MMM") : "—"} />
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-40 px-1">Primary Contact</h3>
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl p-5 shadow-sm flex items-center gap-4 transition-all hover:border-[#26300D]/30 group/contact">
                        <div className="w-14 h-14 rounded-2xl bg-[#F7F4EA] flex items-center justify-center font-black text-xl text-[#26300D] border border-[#E6DFC8] group-hover/contact:bg-[#FDCC4B] group-hover/contact:border-[#FDCC4B] transition-colors">
                          {selectedBooking.contacts?.full_name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-base font-black text-[#1F1F1A] uppercase tracking-tight truncate">{selectedBooking.contacts?.full_name}</p>
                          <p className="text-xs font-bold text-[#5F624F] opacity-60 truncate mt-0.5">{selectedBooking.contacts?.email}</p>
                        </div>
                        <Link href={`mailto:${selectedBooking.contacts?.email}`} className="p-4 bg-[#26300D]/5 rounded-2xl text-[#26300D] hover:bg-[#26300D] hover:text-white transition-all active:scale-95 shadow-xs">
                          <ExternalLink className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>

                    {selectedBooking.special_requests && (
                      <div className="bg-[#FDCC4B]/5 p-6 rounded-3xl border-2 border-[#FDCC4B]/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#FDCC4B]/5 blur-2xl pointer-events-none rounded-full" />
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                          <MessageSquareQuote className="w-5 h-5 text-[#26300D] opacity-40" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#26300D]">Staff Instructions</span>
                        </div>
                        <p className="text-[15px] text-[#1F1F1A] italic leading-relaxed font-bold relative z-10 text-left">
                          &quot;{selectedBooking.special_requests}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="h-32" />
              </div>

              {/* STICKY FOOTER ACTIONS - Consistent spacing and shadow */}
              <div className="shrink-0 p-6 pt-4 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md pb-12 shadow-[0_-15px_40px_rgba(0,0,0,0.05)] z-40">
                {isEditing ? (
                  <div className="flex flex-col gap-3">
                    <Button 
                      onClick={handleSaveDetails} 
                      disabled={isPending}
                      className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-xs shadow-lg w-full active:scale-95 transition-transform"
                    >
                      {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsEditing(false)}
                      className="text-[#5F624F] font-black uppercase tracking-widest text-[10px] h-10"
                    >
                      Discard Changes
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Button asChild className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95 transition-transform">
                        <Link href={`/manage-booking/${selectedBooking.id}`}>
                          <ExternalLink className="w-4 h-4 mr-2" /> Open Link
                        </Link>
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleEnterEditMode}
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#26300D] font-black uppercase tracking-[0.1em] text-[10px] bg-white hover:bg-[#26300D]/5 active:scale-95 transition-transform"
                      >
                        Modify Details
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Global Transition Overlay */}
      {isPending && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-100 bg-[#26300D] text-[#FDCC4B] px-6 py-3.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Loader2 className="w-4 h-4 animate-spin" /> Syncing with DB...
        </div>
      )}
    </div>
  )
}

function StatusCircle({ count, status, label, isActive, onClick }: { count: number, status: string, label: string, isActive: boolean, onClick: () => void }) {
  const theme = statusTheme[status] || statusTheme.pending

  return (
    <div className="flex flex-col items-center gap-2 min-w-12.5 shrink-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex items-center justify-center w-11 h-11 rounded-full border-2 transition-all touch-manipulation hover:scale-105 active:scale-95",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white dark:bg-slate-800 ${theme.border}`,
        )}
      >
        <span className={cn("text-xs font-black", isActive ? "text-white" : theme.text)}>{count}</span>
      </button>
      <span className={cn("text-[10px] font-bold uppercase tracking-tight", isActive ? theme.text : "text-slate-400")}>{label}</span>
    </div>
  )
}

function BookingCard({ booking, onClick, showDate }: { booking: Booking, onClick: () => void, showDate?: boolean }) {
  const status = normStatus(booking.status) || "pending"
  const theme = statusTheme[status] || statusTheme.pending
  const tableName = booking.booking_table_mappings?.[0]?.tables?.tables_name || "--";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group active:scale-[0.98] active:bg-slate-50 transition-all border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer bg-white shadow-sm gap-3",
        theme.cardBorder
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={cn("w-11 h-11 rounded-full flex flex-col items-center justify-center shrink-0 border", theme.bg, theme.text, theme.border)}>
          {showDate && booking.events?.event_date ? (
            <div className="flex flex-col leading-none items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-tighter opacity-80 mb-0.5">{format(new Date(booking.events.event_date), "MMM")}</span>
              <span className="text-base font-black tracking-tighter">{format(new Date(booking.events.event_date), "dd")}</span>
            </div>
          ) : (
            booking.booking_scores?.[0]?.is_winner ? <Trophy className="w-5 h-5" /> : theme.icon
          )}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between min-w-0">
            <h4 className="text-sm font-black text-[#1F1F1A] truncate uppercase tracking-tight">{booking.group_name || "Guest Team"}</h4>
            <span className="text-[11px] font-black text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 ml-2">T: {tableName}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 mt-1">
             <p className="text-xs truncate font-semibold">{booking.contacts?.full_name}</p>
             <div className="flex items-center gap-1.5 text-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-black">{booking.group_size}</span>
             </div>
          </div>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
    </div>
  )
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border-2 border-[#E6DFC8] p-4 rounded-2xl flex flex-col gap-1 text-left shadow-sm transition-all hover:border-[#26300D]/30">
      <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60">
        <div className="scale-75 origin-left">{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-[#1F1F1A] font-black text-sm uppercase truncate">{value}</span>
    </div>
  )
}
