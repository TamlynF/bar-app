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
  X
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
  //const [bookingActionId, setBookingActionId] = useState<string | null>(null)
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
  
  // Refs for scroll and focus control
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topFocusRef = useRef<HTMLSpanElement>(null)

  const isDateFiltered = !!(selectedDate || searchParams.get('date'));

  const toggleStatusFilter = (status: string) => {
    const next = new Set(activeStatusFilters)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setActiveStatusFilters(next)
  }

  /**
   * Enter edit mode and initialize the form state
   */
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

  /**
   * Selection handler to ensure edit mode resets when switching between items
   */
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

      {/* POPUP DETAIL PAGE (Sheet used as full-screenish popup) */}
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
          onOpenAutoFocus={(e: Event) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[92dvh] sm:h-[85vh] flex flex-col outline-none shadow-2xl overflow-hidden"
          style={{ backgroundColor: "#F7F4EA" }}
        >
          {selectedBooking && (
            <>
              <span ref={topFocusRef} tabIndex={-1} className="sr-only" />
              
              {/* Header with Sticky Actions */}
              <div className="shrink-0 p-6 pb-4 border-b border-[#E6DFC8] bg-white/70 backdrop-blur-lg flex items-center justify-between z-30">
                <div className="min-w-0 flex-1">
                  <div className={cn(
                    "inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border mb-1",
                    statusTheme[normStatus(selectedBooking.status) || "pending"]?.bg,
                    statusTheme[normStatus(selectedBooking.status) || "pending"]?.text,
                    statusTheme[normStatus(selectedBooking.status) || "pending"]?.border,
                  )}>
                    {normStatus(selectedBooking.status) || "pending"}
                  </div>
                  <SheetTitle className="text-lg font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                    {isEditing ? "Editing Booking" : (selectedBooking.group_name || "Guest Team")}
                  </SheetTitle>
                </div>

                <div className="flex gap-2">
                  {!isEditing && (
                    <Button 
                      onClick={handleEnterEditMode} 
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-3 rounded-xl border-2 border-[#E6DFC8] bg-white text-[#26300D] font-black text-[10px] uppercase tracking-widest"
                    >
                      <Pencil className="w-3 h-3 mr-1.5" /> Edit
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-full hover:bg-black/5" 
                    onClick={() => setSelectedBooking(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-8 min-h-0 touch-pan-y overscroll-contain">
                
                {isEditing ? (
                  // EDIT MODE FORM
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Team Name</Label>
                      <Input 
                        value={editForm.group_name} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({...prev, group_name: e.target.value}))}
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white text-base font-bold px-4 focus:ring-0 focus:border-[#26300D]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Team Size</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {[2, 4, 6, 8, 10].map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setEditForm(prev => ({...prev, group_size: size}))}
                            className={cn(
                              "h-12 rounded-xl border-2 font-black text-xs transition-all",
                              editForm.group_size === size 
                                ? "bg-[#26300D] border-[#26300D] text-[#FDCC4B] scale-105" 
                                : "bg-white border-[#E6DFC8] text-[#5F624F]"
                            )}
                          >
                            {size}
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
                        className="min-h-[120px] rounded-2xl border-2 border-[#E6DFC8] bg-white text-sm font-medium p-4 focus:ring-0 focus:border-[#26300D] resize-none"
                      />
                    </div>
                    
                    <div className="pt-4 border-t border-[#E6DFC8]">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1 mb-2 block">Quick Status Toggle</Label>
                       <div className="flex flex-wrap gap-2">
                         {Object.keys(statusTheme).filter(s => s !== 'all').map(s => (
                           <button
                             key={s}
                             type="button"
                             onClick={() => handleStatusChange(selectedBooking.id, s)}
                             className={cn(
                               "px-3 py-2 rounded-xl border-2 text-[9px] font-black uppercase tracking-widest transition-all",
                               normStatus(selectedBooking.status) === s 
                                ? `${statusTheme[s].bg} ${statusTheme[s].border} ${statusTheme[s].text} ring-2 ring-offset-1 ring-primary/20`
                                : "bg-white border-[#E6DFC8] text-slate-400"
                             )}
                           >
                             {s}
                           </button>
                         ))}
                       </div>
                    </div>
                  </div>
                ) : (
                  // VIEW MODE DETAILS
                  <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Score Summary */}
                    {selectedBooking.booking_scores?.[0] && (
                      <div className="bg-[#26300D] text-white p-5 rounded-[2rem] shadow-lg flex items-center justify-between border border-white/10">
                        <div>
                          <p className="text-[10px] font-black text-[#FDCC4B] uppercase tracking-[0.2em] opacity-60">Game Score</p>
                          <h3 className="text-4xl font-black tracking-tighter">{selectedBooking.booking_scores[0].score} <span className="text-sm opacity-40">pts</span></h3>
                        </div>
                        {selectedBooking.booking_scores[0].is_winner && (
                          <div className="bg-[#FDCC4B] p-3 rounded-2xl">
                            <Trophy className="w-8 h-8 text-[#26300D]" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <DetailTile icon={<Calendar className="w-4 h-4" />} label="Event Date" value={selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMM") : "—"} />
                      <DetailTile icon={<Users className="w-4 h-4" />} label="Team Size" value={`${selectedBooking.group_size} Guests`} />
                      <DetailTile icon={<LayoutDashboard className="w-4 h-4" />} label="Table" value={selectedBooking.booking_table_mappings?.[0]?.tables?.tables_name || "Unassigned"} />
                      <DetailTile icon={<Hash className="w-4 h-4" />} label="Reference" value={`#${selectedBooking.id}`} />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-40 px-1">Lead Contact</h3>
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-2xl p-4 shadow-sm flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#F7F4EA] flex items-center justify-center font-black text-[#26300D] border border-[#E6DFC8]">
                          {selectedBooking.contacts?.full_name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-[#1F1F1A] uppercase truncate">{selectedBooking.contacts?.full_name}</p>
                          <p className="text-xs font-bold text-[#5F624F] opacity-60 truncate">{selectedBooking.contacts?.email}</p>
                        </div>
                        <Link href={`mailto:${selectedBooking.contacts?.email}`} className="p-3 bg-[#26300D]/5 rounded-xl text-[#26300D] hover:bg-[#26300D]/10">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    {selectedBooking.special_requests && (
                      <div className="bg-amber-500/5 p-5 rounded-2xl border-2 border-amber-500/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Special Request</span>
                        </div>
                        <p className="text-sm text-[#1F1F1A] italic leading-relaxed font-bold">
                          &quot;{selectedBooking.special_requests}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="h-20" />
              </div>

              {/* STICKY FOOTER ACTIONS */}
              <div className="shrink-0 p-6 pt-4 border-t-2 border-[#E6DFC8] bg-white pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-40">
                {isEditing ? (
                  <div className="flex flex-col gap-3">
                    <Button 
                      onClick={handleSaveDetails} 
                      disabled={isPending}
                      className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-xs shadow-lg w-full"
                    >
                      {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsEditing(false)}
                      className="text-[#5F624F] font-black uppercase tracking-widest text-[10px]"
                    >
                      Discard Changes
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button asChild className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg">
                        <Link href={`/manage-booking/${selectedBooking.id}`}>
                          <ExternalLink className="w-4 h-4 mr-2" /> Public Link
                        </Link>
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleEnterEditMode}
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#26300D] font-black uppercase tracking-[0.1em] text-[10px]"
                      >
                        Modify Booking
                      </Button>
                    </div>
                    <Button 
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm("Permanently delete this booking? This cannot be undone.")) {
                          handleDeleteBooking(selectedBooking.id)
                        }
                      }}
                      className="text-red-600 font-black uppercase tracking-widest text-[9px] h-auto p-2"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Permanent Record
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Global Transition Overlay */}
      {isPending && (
        <div className="fixed bottom-6 right-6 z-100 bg-[#26300D] text-[#FDCC4B] px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2 border border-white/10 animate-in fade-in slide-in-from-bottom-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...
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
  const theme = statusTheme[status] || statusTheme.pending
  const hasRequest = booking.special_requests && booking.special_requests.trim() !== ""
  const score = booking.booking_scores?.[0]?.score;
  const isWinner = booking.booking_scores?.[0]?.is_winner;
  const tableName = booking.booking_table_mappings?.[0]?.tables?.tables_name || "--";
  const tableCapacity = booking.booking_table_mappings?.[0]?.tables?.tables_capacity || 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group active:scale-[0.98] active:bg-slate-50 transition-all border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer bg-white shadow-sm gap-3 sm:gap-4",
        theme.cardBorder
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        {/* Leading Container: Mobile shows Date in All-History mode, otherwise Icon */}
        <div className={cn(
          "w-11 h-11 rounded-full flex flex-col items-center justify-center shrink-0 shadow-xs text-center border",
          theme.bg, theme.text, theme.border
        )}>
          {/* Mobile only date block replacement for icon */}
          {showDate && booking.events?.event_date ? (
            <>
              <div className="sm:hidden flex flex-col leading-none items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-tighter opacity-80 mb-0.5">
                  {format(new Date(booking.events.event_date), "MMM")}
                </span>
                <span className="text-base font-black tracking-tighter">
                  {format(new Date(booking.events.event_date), "dd")}
                </span>
              </div>
              {/* Hide date in leading circle on larger screens to keep consistent icons */}
              <div className="hidden sm:flex items-center justify-center">
                {isWinner ? <Trophy className="w-5 h-5" /> : theme.icon}
              </div>
            </>
          ) : (
            isWinner ? <Trophy className="w-5 h-5" /> : theme.icon
          )}
        </div>

        {/* Info Content - Optimized for One Row on Desktop */}
        <div className="min-w-0 flex-1">
          {/* Row 1: Team Name + Table Name (Mobile) */}
          <div className="flex items-center justify-between sm:justify-start min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-sm sm:text-base font-black text-[#1F1F1A] truncate uppercase tracking-tight leading-none">
                {booking.group_name || "Guest Team"}
              </h4>
              {hasRequest && (
                <div className="bg-red-500 rounded-full w-5 h-5 flex items-center justify-center shadow-sm ring-2 ring-white animate-pulse shrink-0" title="Special Request">
                  <AlertCircle className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            {/* Mobile-only Table Name positioned at end of Team row */}
            <div className="sm:hidden shrink-0 ml-2">
              <span className="text-sm font-black text-blue-700 uppercase bg-blue-50 px-2 rounded-md border border-blue-100 leading-none py-1">
                T: {tableName || "-"}
              </span>
            </div>
          </div>

          {/* Row 2 (Mobile) / Unified Line (Desktop) */}
          <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0 mt-1 sm:mt-0 text-slate-500 font-medium overflow-hidden">
            {/* Left side of Row 2: Contact Name and Date */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:inline text-slate-200 font-normal">|</span>
              {/* Contact Name - Enlarged on mobile (text-sm) */}
              <p className="text-sm sm:text-xs truncate max-w-[150px] sm:max-w-none font-semibold sm:font-medium">
                {booking.contacts?.full_name}
              </p>

              {/* Desktop Only Date (Since mobile has it in the icon circle) */}
              {showDate && booking.events?.event_date && (
                <span className="hidden sm:inline text-[10px] sm:text-xs text-slate-400 font-bold uppercase shrink-0 whitespace-nowrap">
                  • {format(new Date(booking.events.event_date), "dd MMM")}
                </span>
              )}
            </div>

            {/* Right side of Row 2: Mobile Group Size / Desktop Badges */}
            <div className="flex items-center shrink-0">
              {/* Mobile-only guest count positioned directly under Table name */}
              <div className="sm:hidden flex items-center gap-1.5 text-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-black leading-none">
                  {booking.group_size}<span className="opacity-30 text-[9px] mx-0.5">/</span>{tableCapacity || "-"}
                </span>
              </div>

              {/* Desktop Inline Badges for Table/Size */}
              <div className="hidden sm:flex items-center gap-3 ml-2">
                <span className="text-slate-200 font-normal">|</span>
                {tableName && (
                  <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                    <TableIcon className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-tighter">{tableName}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                  <Users className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-black text-slate-700">{booking.group_size}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extreme Right: Score Badge and Chevron Indicator */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-1">
        {score !== undefined && (
          <div className="flex items-center gap-1.5 bg-[#1F1F1A] text-white px-2.5 py-1.5 rounded-xl shadow-lg border border-white/10 group-hover:scale-105 transition-transform">
            <Target className="w-3.5 h-3.5 text-[#FDCC4B]" />
            <span className="text-xs font-black">{score}</span>
          </div>
        )}
        {/* Disclosure Chevron: Subtle indicator that the card is a link/button */}
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
      </div>
    </div>
  )
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border-2 border-[#E6DFC8] p-4 rounded-2xl flex flex-col gap-1 text-left shadow-sm">
      <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60">
        <div className="scale-75 origin-left">{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-[#1F1F1A] font-black text-sm uppercase truncate">{value}</span>
    </div>
  )
}
