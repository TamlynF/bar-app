"use client"

import React, { useMemo, useState, useTransition, useEffect, useRef } from "react"
import { format, isSameDay } from "date-fns"
import { 
  deleteBooking, 
  updateBookingDetails, 
  getAvailableTablesForEvent,
  getQuizEvents
} from "@/app/(private)/event-bookings/quiz-bookings/actions"
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
  LayoutDashboard,
  Trophy,
  AlertCircle,
  Trash2,
  Calendar,
  Hash,
  ExternalLink,
  ChevronDown,
  Save,
  MessageSquareQuote,
  RefreshCw,
  CalendarDays,
  History,
  UserCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useConfirm } from "@/components/ui/confirm-dialog"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Booking } from "@/app/(private)/event-bookings/quiz-bookings/page"

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

// Local interface for selection states
interface SelectableTable {
  id: number;
  name: string;
  max_capacity: number;
}

interface SelectableEvent {
  id: string;
  date: string;
  title: string;
}

export default function BookingListClient({ initialBookings, selectedDate }: { initialBookings: Booking[], selectedDate?: string | undefined }) {
  const { confirm, ConfirmDialogUI } = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(new Set())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [availableTables, setAvailableTables] = useState<SelectableTable[]>([])
  const [availableEvents, setAvailableEvents] = useState<SelectableEvent[]>([])
  
  const [editForm, setEditForm] = useState({
    group_name: "",
    group_size: 0,
    special_requests: "",
    table_id: "",
    status: "",
    event_id: ""
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

  const handleEnterEditMode = async () => {
    if (selectedBooking) {
      const currentTableId = selectedBooking.booking_table_mappings?.[0]?.tables?.tables_id;
      const currentEventId = String(selectedBooking.event_id);
      
      setEditForm({
        group_name: selectedBooking.group_name || "",
        group_size: Number(selectedBooking.group_size) || 0,
        special_requests: selectedBooking.special_requests || "",
        table_id: currentTableId || "",
        status: normStatus(selectedBooking.status) || "pending",
        event_id: currentEventId
      })
      
      setIsEditing(true)
      
      // Fetch compatible tables
      if (selectedBooking.event_id) {
        const tables = await getAvailableTablesForEvent(
          currentEventId, 
          Number(selectedBooking.group_size) || 0,
          currentTableId
        );
        setAvailableTables(tables as unknown as SelectableTable[]);
      }

      // Fetch all upcoming events of same type to allow movement
      if (selectedBooking.events?.event_types) {
        const events = await getQuizEvents(
          selectedBooking.events.event_types.category || "game",
          selectedBooking.events.event_types.sub_type || "quiz"
        );
        setAvailableEvents(events as unknown as SelectableEvent[]);
      }
    }
  }

  const handleEventChange = async (newEventId: string) => {
    // When changing event, table assignment is cleared as it's date-specific
    setEditForm(prev => ({ ...prev, event_id: newEventId, table_id: "" }));
    
    // Refresh tables for the new event context
    const tables = await getAvailableTablesForEvent(
      newEventId, 
      editForm.group_size,
      "" 
    );
    setAvailableTables(tables as unknown as SelectableTable[]);
  }

  /**
   * Logical rule handler for Table selection. 
   * Includes forcedStatus parameter to allow other automated processes (like size changes)
   * to bypass default status rules if necessary.
   */
  const handleTableChange = (newTableId: string, forcedStatus?: string) => {
    const originalTableIdFromBooking = selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id || "";
    const wasUnassigned = originalTableIdFromBooking === "";
    const isUnassigned = newTableId === "";
    
    let newStatus = forcedStatus || editForm.status;

    if (!forcedStatus) {
      // RULE: If table id was Unassigned and then changed to a table name -> set status to confirmed
      if (wasUnassigned && !isUnassigned) {
        newStatus = "confirmed";
      } 
      // RULE: If table id was assigned to a table and then changed to unassigned -> set status to cancelled
      else if (!wasUnassigned && isUnassigned) {
        newStatus = "cancelled";
      }
    }

    setEditForm(prev => ({ ...prev, table_id: newTableId, status: newStatus }));
  }

  /**
   * Logical rule handler for Status changes in edit mode
   */
  const handleStatusChangeInEdit = (newStatus: string) => {
    const originalStatusFromBooking = normStatus(selectedBooking?.status) || "pending";
    const wasConfirmed = originalStatusFromBooking === "confirmed";
    const isNowOther = newStatus !== "confirmed";
    
    let newTableId = editForm.table_id;

    // RULE: if the status is changed from confirmed to any other status -> set table id to unassigned
    if (wasConfirmed && isNowOther) {
      newTableId = "";
    }

    setEditForm(prev => ({ ...prev, status: newStatus, table_id: newTableId }));
  }

  /**
   * Refined group size handler.
   * Automatically updates available tables and attempts to keep the current assignment 
   * or auto-reassign to the smallest suitable table.
   */
  const handleGroupSizeChange = async (size: number) => {
    // 1. Update the size in the form state immediately
    setEditForm(prev => ({...prev, group_size: size}));
    
    if (editForm.event_id) {
      // 2. Fetch tables that fit the NEW size for THIS event
      const tables = await getAvailableTablesForEvent(
        editForm.event_id, 
        size,
        selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id
      );
      
      const newAvailableTables = tables as unknown as SelectableTable[];
      setAvailableTables(newAvailableTables);

      // 3. Automation: Check if the current selected table is still valid
      const currentTableId = editForm.table_id;
      
      // If the booking was previously unassigned, don't auto-assign just because size changed
      if (currentTableId === "") return;

      const isCurrentTableValid = newAvailableTables.some(t => String(t.id) === String(currentTableId));

      if (!isCurrentTableValid) {
        if (newAvailableTables.length > 0) {
          // Current table too small or taken; auto-pick the smallest suitable table
          handleTableChange(String(newAvailableTables[0].id));
          toast.info(`Team size updated. Table auto-reassigned to ${newAvailableTables[0].name}.`);
        } else {
          // No suitable tables exist for this group size at this event
          handleTableChange("", "waitlisted");
          toast.warning("No suitable tables available for this group size. Booking moved to waitlist.");
        }
      }
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

    const getAggregates = (list: Booking[]) => ({
      teams: list.length,
      guests: list.reduce((acc, b) => acc + (Number(b.group_size) || 0), 0)
    });

    return {
      total: getAggregates(contextBookings),
      confirmed: getAggregates(contextBookings.filter((b) => normStatus(b.status) === "confirmed")),
      waitlisted: getAggregates(contextBookings.filter((b) => normStatus(b.status) === "waitlisted")),
      pending: getAggregates(contextBookings.filter((b) => {
        const s = normStatus(b.status)
        return s === "" || s === "pending"
      })),
      cancelled: getAggregates(contextBookings.filter((b) => normStatus(b.status) === "cancelled")),
    }
  }, [initialBookings, selectedDate])

  const handleSaveDetails = () => {
    if (!selectedBooking) return
    startTransition(async () => {
      try {
        await updateBookingDetails(selectedBooking.id, editForm)
        
        const table = availableTables.find(t => String(t.id) === String(editForm.table_id));
        const tableMapping = editForm.table_id ? [{ 
          tables: { 
            tables_id: editForm.table_id, 
            tables_name: table?.name || "Assigned" 
          } 
        }] : [];

        const targetEvent = availableEvents.find(e => String(e.id) === String(editForm.event_id));

        setSelectedBooking(prev => {
          if (!prev) return null;
          return { 
            ...prev, 
            ...editForm,
            // event_id is stored as string in state, matching interface requirement
            event_id: editForm.event_id, 
            events: targetEvent ? {
               ...prev.events,
               event_date: targetEvent.date,
               event_title: targetEvent.title
            } : prev.events,
            booking_table_mappings: tableMapping as Booking['booking_table_mappings']
          };
        });
        
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

  // Reactive hint flags for UI feedback
  const originalTableIdFromRec = selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id || "";
  const originalStatusFromRec = normStatus(selectedBooking?.status) || "pending";
  const originalEventIdFromRec = String(selectedBooking?.event_id || "");
  
  const showTableConfirmedHint = originalTableIdFromRec === "" && editForm.table_id !== "" && editForm.status === "confirmed";
  const showTableCancelledHint = originalTableIdFromRec !== "" && editForm.table_id === "" && editForm.status === "cancelled";
  const showStatusTableUnassignedHint = originalStatusFromRec === "confirmed" && editForm.status !== "confirmed" && editForm.table_id === "";
  const showEventMoveHint = originalEventIdFromRec !== editForm.event_id;

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* Stats Bar - Redesigned for Guest/Team Visibility */}
      <div className="bg-white dark:bg-slate-900 border border-[#E6DFC8] rounded-2xl p-2 shadow-sm overflow-x-auto no-scrollbar">
        <div className="flex items-center justify-start gap-4 sm:gap-6 w-full px-2 min-w-max py-4">
          <StatusCircle 
            guestCount={stats.total.guests} 
            teamCount={stats.total.teams} 
            status="all" 
            label="Total" 
            isActive={activeStatusFilters.size === 0} 
            onClick={() => setActiveStatusFilters(new Set())} 
          />
          <StatusCircle 
            guestCount={stats.confirmed.guests} 
            teamCount={stats.confirmed.teams} 
            status="confirmed" 
            label="Joining" 
            isActive={activeStatusFilters.has("confirmed")} 
            onClick={() => toggleStatusFilter("confirmed")} 
          />
          <StatusCircle 
            guestCount={stats.waitlisted.guests} 
            teamCount={stats.waitlisted.teams} 
            status="waitlisted" 
            label="Waiting" 
            isActive={activeStatusFilters.has("waitlisted")} 
            onClick={() => toggleStatusFilter("waitlisted")} 
          />
          <StatusCircle 
            guestCount={stats.pending.guests} 
            teamCount={stats.pending.teams} 
            status="pending" 
            label="Pending" 
            isActive={activeStatusFilters.has("pending")} 
            onClick={() => toggleStatusFilter("pending")} 
          />
          <StatusCircle 
            guestCount={stats.cancelled.guests} 
            teamCount={stats.cancelled.teams} 
            status="cancelled" 
            label="Dropped" 
            isActive={activeStatusFilters.has("cancelled")} 
            onClick={() => toggleStatusFilter("cancelled")} 
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative group bg-white">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search team names or guests..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="h-11 rounded-xl pl-10 text-sm shadow-sm"
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
              <div className="shrink-0 p-2 pb-2 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 flex flex-row items-start justify-between gap-2">
                <div className="flex-1 min-w-0 text-left">
                  <SheetTitle className="text-xl sm:text-2xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                    {isEditing ? "Modify Record" : (selectedBooking.group_name || "Guest Team")}
                  </SheetTitle>
                  
                  {/* REFERENCE ID */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <Hash className="w-3 h-3 text-[#5F624F]" />
                    <span className="text-xs font-black text-[#5F624F] uppercase tracking-widest tabular-nums">
                      Ref: {selectedBooking.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scrollable Body */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0 touch-pan-y overscroll-contain text-left">
                
                {/* STATUS + GROUP SIZE BANNER */}
                {!isEditing && (
                  <div className={cn(
                    "flex items-center justify-between w-full px-5 py-4 rounded-2xl border-2 animate-in fade-in slide-in-from-top-2 duration-300",
                    statusTheme[normStatus(selectedBooking.status) || "pending"]?.bg,
                    statusTheme[normStatus(selectedBooking.status) || "pending"]?.border,
                  )}>
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", statusTheme[normStatus(selectedBooking.status) || "pending"]?.dot)} />
                      <span className={cn("text-sm font-black uppercase tracking-widest", statusTheme[normStatus(selectedBooking.status) || "pending"]?.text)}>
                        {normStatus(selectedBooking.status) || "pending"}
                      </span>
                    </div>
                    <div className={cn("flex items-center gap-1.5", statusTheme[normStatus(selectedBooking.status) || "pending"]?.text)}>
                      <Users className="w-4 h-4 opacity-50" />
                      <span className="text-2xl font-black tabular-nums leading-none">{selectedBooking.group_size}</span>
                      <span className="text-[10px] font-bold opacity-50 uppercase self-end mb-0.5">guests</span>
                    </div>
                  </div>
                )}

                {isEditing ? (
                  // EDIT MODE FORM - Consistent with Quiz Generator inline editor
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Event Date & Session</Label>
                      <div className="relative group">
                        <select 
                          title="Select Event"
                          value={editForm.event_id}
                          onChange={(e) => handleEventChange(e.target.value)}
                          className="w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold appearance-none outline-none focus:border-[#26300D] transition-all"
                        >
                          {availableEvents.map(e => (
                            <option key={e.id} value={e.id}>
                              {format(new Date(e.date), "dd MMM yyyy")} - {e.title || "Untitled Event"}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5F624F] opacity-40 pointer-events-none" />
                      </div>
                      {showEventMoveHint && (
                        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                          <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-[10px] font-black uppercase text-blue-700 tracking-tight">Moving event. Table assignment has been reset.</p>
                        </div>
                      )}
                    </div>

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
                        {[4, 5, 6].map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => handleGroupSizeChange(size)}
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

                    {/* SEATING SELECTION */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1">Table Assignment</Label>
                      <div className="relative group">
                        <select 
                          title="Select Table"
                          value={editForm.table_id}
                          onChange={(e) => handleTableChange(e.target.value)}
                          className={cn(
                            "w-full h-14 rounded-2xl border-2 px-4 text-sm font-bold appearance-none outline-none transition-all",
                            editForm.table_id ? "bg-white border-[#E6DFC8] focus:border-[#26300D]" : "bg-[#F7F4EA] border-dashed border-[#E6DFC8]"
                          )}
                        >
                          <option value="">Unassigned / No Table</option>
                          {availableTables.map(t => (
                            <option key={t.id} value={t.id}>{t.name} (Cap: {t.max_capacity})</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5F624F] opacity-40 pointer-events-none" />
                      </div>
                      
                      {/* TABLE TO STATUS INDICATORS */}
                      {showTableConfirmedHint && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <p className="text-[10px] font-black uppercase text-emerald-700 tracking-tight">Table selected. Status will update to Confirmed.</p>
                        </div>
                      )}
                      {showTableCancelledHint && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                          <p className="text-[10px] font-black uppercase text-red-700 tracking-tight">Table removed. Status will update to Cancelled.</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-6 border-t border-[#E6DFC8]">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] ml-1 mb-3 block">Status</Label>
                       <div className={cn(
                         "flex items-center h-14 rounded-2xl border-2 overflow-hidden transition-all",
                         statusTheme[editForm.status]?.border || "border-[#E6DFC8]",
                         statusTheme[editForm.status]?.bg || "bg-white",
                       )}>
                         <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 ml-4", statusTheme[editForm.status]?.dot)} />
                        <select
                          title="Status"
                           value={editForm.status}
                           onChange={(e) => handleStatusChangeInEdit(e.target.value)}
                           className={cn(
                             "flex-1 h-full px-3 bg-transparent outline-none text-sm font-black uppercase tracking-widest cursor-pointer appearance-none",
                             statusTheme[editForm.status]?.text || "text-[#1F1F1A]",
                           )}
                         >
                           {Object.keys(statusTheme).filter(s => s !== 'all').map(s => (
                             <option key={s} value={s} className="text-[#1F1F1A] bg-white normal-case font-bold">
                               {s.charAt(0).toUpperCase() + s.slice(1)}
                             </option>
                           ))}
                         </select>
                         <svg className={cn("w-4 h-4 mr-4 shrink-0 opacity-60", statusTheme[editForm.status]?.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                       </div>
                       
                       {/* STATUS TO TABLE INDICATOR */}
                       {showStatusTableUnassignedHint && (
                        <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin-slow" />
                          <p className="text-[10px] font-black uppercase text-amber-700 tracking-tight">Status changed. Table assignment will be cleared.</p>
                        </div>
                       )}
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

                    <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden shadow-sm">
                      <InfoRow icon={<Calendar className="w-4 h-4" />}      label="Event Date" value={selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMMM yyyy") : "—"} />
                      <InfoRow icon={<Users className="w-4 h-4" />}      label="Group Size" value={`${selectedBooking.group_size} Guests`} />
                      
                        <InfoRow icon={<TableIcon className="w-4 h-4" />} label="Table" value={selectedBooking.booking_table_mappings?.[0]?.tables?.tables_name || "Unassigned"} />
                      <InfoRow icon={<Clock3 className="w-4 h-4" />}        label="Booked On"  value={selectedBooking.booking_created_at ? format(new Date(selectedBooking.booking_created_at), "dd MMM yyyy · HH:mm") : "—"} />
                      {selectedBooking.updated_at && (
                        <InfoRow icon={<History className="w-4 h-4" />} label="Last Modified" value={format(new Date(selectedBooking.updated_at), "dd MMM yyyy · HH:mm")} />
                      )}
                      {selectedBooking.updated_by_employee && (
                        <InfoRow icon={<UserCheck className="w-4 h-4" />} label="Modified By" value={selectedBooking.updated_by_employee.full_name} />
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-40 px-1">Primary Contact</h3>
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl p-5 shadow-sm flex items-center gap-4 transition-all hover:border-[#26300D]/30 group/contact">
                        <div className="w-14 h-14 rounded-2xl bg-[#F7F4EA] flex items-center justify-center font-black text-xl text-[#26300D] border border-[#E6DFC8]">
                          {selectedBooking.contacts?.full_name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-base font-black text-[#1F1F1A] uppercase tracking-tight truncate">{selectedBooking.contacts?.full_name}</p>
                          <p className="text-xs font-bold text-[#5F624F] opacity-60 break-all mt-0.5">{selectedBooking.contacts?.email}</p>
                        </div>
                        <Link href={`mailto:${selectedBooking.contacts?.email}`} className="p-4 bg-[#26300D]/5 rounded-2xl text-[#26300D] hover:bg-[#26300D] hover:text-white transition-all active:scale-95 shadow-xs">
                          <ExternalLink className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>

                    {selectedBooking.special_requests && (
                      <div className="bg-[#FDCC4B]/5 p-6 rounded-3xl border-2 border-[#FDCC4B]/20 shadow-sm relative overflow-hidden">
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
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      onClick={handleSaveDetails} 
                      disabled={isPending}
                      className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-xs shadow-lg active:scale-95 transition-transform"
                    >
                      {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save</>}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-widest text-[10px] bg-white shadow-sm"
                    >
                      Discard
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="ghost"
                          className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#26300D] font-black uppercase tracking-[0.1em] text-[10px] bg-white"
                           onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({ title: "Delete booking", description: "Permanently delete this booking? This cannot be undone.", confirmLabel: "Delete", variant: "destructive" })
                          if (ok) handleDeleteBooking(selectedBooking.id)
                          }}
                          title="Delete Record"
                        >
                          <><Trash2 className="w-4 h-4 mr-2" />Delete</>
                            
                      </Button>
                      <Button 
                          variant="outline" 
                          title="Edit Details"
                          onClick={handleEnterEditMode}
                          className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                        
                      >
                        <><Pencil className="w-4 h-4 mr-2" />Edit</>
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
      {ConfirmDialogUI}
    </div>
  )
}

function StatusCircle({ 
  guestCount, 
  teamCount, 
  status, 
  label, 
  isActive, 
  onClick 
}: { 
  guestCount: number, 
  teamCount: number,
  status: string, 
  label: string, 
  isActive: boolean, 
  onClick: () => void 
}) {
  const theme = statusTheme[status] || statusTheme.pending

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-14 shrink-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all touch-manipulation hover:scale-105 active:scale-95",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white dark:bg-slate-800 ${theme.border}`,
        )}
      >
        <span className={cn("text-sm font-black", isActive ? "text-white" : theme.text)}>
          {teamCount}
        </span>
      </button>
      <div className="flex flex-col items-center leading-none">
        <span className={cn("text-[9px] font-black uppercase tracking-tight", isActive ? theme.text : "text-slate-500")}>
          {label}
        </span>
        <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
          {guestCount} Guests
        </span>
      </div>
    </div>
  )
}

function BookingCard({ booking, onClick, showDate }: { booking: Booking, onClick: () => void, showDate?: boolean }) {
  const status = normStatus(booking.status) || "pending"
  const theme = statusTheme[status] || statusTheme.pending
  const tableName = booking.booking_table_mappings?.[0]?.tables?.tables_name || "--";
  const group_max_capacity = booking.booking_table_mappings?.[0]?.tables?.tables_capacity || "-";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group active:scale-[0.98] active:bg-slate-50 transition-all border-2 rounded-2xl p-3 flex items-center justify-between cursor-pointer bg-white shadow-sm gap-3",
        theme.cardBorder
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
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

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h4 className="text-sm font-black text-[#1F1F1A] truncate uppercase tracking-tight">{booking.group_name || "Guest Team"}</h4>
              {booking.special_requests && (
                <span className="shrink-0 text-[10px] font-black text-red-700 uppercase bg-red-50 px-1.5 py-0.5 rounded border border-red-200">★</span>
              )}
            </div>
            <span className="shrink-0 text-[11px] font-black text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 ml-2">T: {tableName}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 mt-1">
             <p className="text-xs truncate font-semibold">{booking.contacts?.full_name}</p>
             <div className="flex items-center gap-1.5 text-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-black">{booking.group_size}</span>
                <span className="text-sm font-black">/ {group_max_capacity}</span>
             </div>
          </div>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{label}</span>
      </div>
      {label === "Booked On" || label === "Last Modified" || label === "Modified By" ? (
        <span className="text-sm font-black text-[#5F624F] text-right flex-1 leading-snug">{value}</span>
      ) : (
        <span className="text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug">{value}</span>
      )}
      </div>
  )
}
