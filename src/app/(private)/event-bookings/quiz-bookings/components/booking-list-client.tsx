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
  Inbox,
  Loader2,
  Pencil,
  Search,
  Table as TableIcon,
  Users,
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
  UserCheck,
  X
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
import StatusCircle from "../../../../../components/editorial/status-circle"
import { statusTheme } from "@/lib/booking-status-theme"

const formatDateStr = (d: Date | string) => {
  if (typeof d === 'string') return d;
  const date = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return date.toISOString().split("T")[0]
}

const normStatus = (s?: string) => (s || "").trim().toLowerCase()



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
      
      if (selectedBooking.event_id) {
        const tables = await getAvailableTablesForEvent(
          currentEventId, 
          Number(selectedBooking.group_size) || 0,
          currentTableId
        );
        setAvailableTables(tables as unknown as SelectableTable[]);
      }

      if (selectedBooking.events?.event_types) {
        const events = await getQuizEvents(
          selectedBooking.events.event_types.category || "games",
          selectedBooking.events.event_subtypes?.sub_type || "quiz"
        );
        setAvailableEvents(events as unknown as SelectableEvent[]);
      }
    }
  }

  const handleEventChange = async (newEventId: string) => {
    setEditForm(prev => ({ ...prev, event_id: newEventId, table_id: "" }));
    
    const tables = await getAvailableTablesForEvent(
      newEventId, 
      editForm.group_size,
      "" 
    );
    setAvailableTables(tables as unknown as SelectableTable[]);
  }

  const handleTableChange = (newTableId: string, forcedStatus?: string) => {
    const originalTableIdFromBooking = selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id || "";
    const wasUnassigned = originalTableIdFromBooking === "";
    const isUnassigned = newTableId === "";
    
    let newStatus = forcedStatus || editForm.status;

    if (!forcedStatus) {
      if (wasUnassigned && !isUnassigned) {
        newStatus = "confirmed";
      } 
      else if (!wasUnassigned && isUnassigned) {
        newStatus = "cancelled";
      }
    }

    setEditForm(prev => ({ ...prev, table_id: newTableId, status: newStatus }));
  }

  const handleStatusChangeInEdit = (newStatus: string) => {
    const originalStatusFromBooking = normStatus(selectedBooking?.status) || "pending";
    const wasConfirmed = originalStatusFromBooking === "confirmed";
    const isNowOther = newStatus !== "confirmed";
    
    let newTableId = editForm.table_id;

    if (wasConfirmed && isNowOther) {
      newTableId = "";
    }

    setEditForm(prev => ({ ...prev, status: newStatus, table_id: newTableId }));
  }

  const handleGroupSizeChange = async (size: number) => {
    setEditForm(prev => ({...prev, group_size: size}));
    
    if (editForm.event_id) {
      const tables = await getAvailableTablesForEvent(
        editForm.event_id, 
        size,
        selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id
      );
      
      const newAvailableTables = tables as unknown as SelectableTable[];
      setAvailableTables(newAvailableTables);

      const currentTableId = editForm.table_id;
      
      if (currentTableId === "") return;

      const isCurrentTableValid = newAvailableTables.some(t => String(t.id) === String(currentTableId));

      if (!isCurrentTableValid) {
        if (newAvailableTables.length > 0) {
          handleTableChange(String(newAvailableTables[0].id));
          toast.info(`Team size updated. Table auto-reassigned to ${newAvailableTables[0].name}.`);
        } else {
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

  const handleSaveDetails = async () => {
    if (!selectedBooking) return

    const origStatus = normStatus(selectedBooking.status) || "pending";
    const origTableId = selectedBooking.booking_table_mappings?.[0]?.tables?.tables_id ?? "";
    const hadTable = String(origTableId) !== "";
    const losesTable = hadTable && !editForm.table_id;
    const leavesConfirmed = origStatus === "confirmed" && normStatus(editForm.status) !== "confirmed";

    if (losesTable || leavesConfirmed) {
      const ok = await confirm({
        title: leavesConfirmed ? "Change status & free table?" : "Remove table assignment?",
        description: leavesConfirmed
          ? `This booking is currently confirmed with a table. Changing it to "${editForm.status || "pending"}" will free its table for other guests.`
          : "This will remove the table assignment and return the table to the pool.",
        confirmLabel: "Save changes",
        variant: "destructive",
      });
      if (!ok) return;
    }

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
        toast.error(error instanceof Error ? error.message : "Failed to save changes")
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

  const originalTableIdFromRec = selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id || "";
  const originalStatusFromRec = normStatus(selectedBooking?.status) || "pending";
  const originalEventIdFromRec = String(selectedBooking?.event_id || "");
  
  const showTableConfirmedHint = originalTableIdFromRec === "" && editForm.table_id !== "" && editForm.status === "confirmed";
  const showTableCancelledHint = originalTableIdFromRec !== "" && editForm.table_id === "" && editForm.status === "cancelled";
  const showStatusTableUnassignedHint = originalStatusFromRec === "confirmed" && editForm.status !== "confirmed" && editForm.table_id === "";
  const showEventMoveHint = originalEventIdFromRec !== editForm.event_id;

  return (
    <div className="animate-in space-y-3 duration-500 fade-in">
      <div className="rounded-2xl border border-[#D8D5C8] bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center">

          <div className="no-scrollbar overflow-x-auto px-2 pt-2 sm:flex-1 sm:pt-0">
            <div className="flex w-full min-w-max items-stretch gap-3 px-2 py-3 sm:min-w-0 sm:justify-evenly sm:gap-0">
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

          <div className="mx-3 border-t border-[#D8D5C8] sm:hidden" />
          <div className="hidden w-px bg-[#D8D5C8] sm:my-2 sm:block sm:self-stretch" />

          <div className="mb-3 flex justify-center px-4 sm:mb-0 sm:shrink-0 sm:px-3 sm:py-2">
            <div className="flex h-10 w-full max-w-sm items-center gap-3 rounded-xl border border-[#D8D5C8] px-4 transition-colors focus-within:border-[#34451F] sm:w-56">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-[#5E6654]/50" />
                <input
                  type="text"
                  placeholder="Search team names or guests..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#20231A] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#5E6654]/40 placeholder:normal-case"
                />
              </div>
              {(activeStatusFilters.size > 0 || searchQuery.length > 0) && (
                <button
                  type="button"
                  title="Cancel"
                  onClick={() => { setActiveStatusFilters(new Set()); setSearchQuery(""); }}
                  className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#D8D5C8]"
                >
                  <X className="h-3.5 w-3.5 text-[#5E6654]/50" />
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="space-y-2 pb-2">
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8D5C8] bg-white py-16 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-[#5E6654]/50" />
            <p className="text-sm font-medium text-[#5E6654]">No bookings found</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <BookingCard key={b.id} booking={b} showDate={!isDateFiltered} onClick={() => handleSelectBooking(b)} />
          ))
        )}
      </div>

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
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#D8D5C8] bg-[#F4F1E8] p-0 shadow-2xl outline-none"
        >
          {selectedBooking && (
            <>
              <span ref={topFocusRef} tabIndex={-1} className="sr-only" />
              
              <div className="sticky top-0 z-30 flex shrink-0 flex-row items-start justify-between gap-2 border-b border-[#D8D5C8] bg-white/80 p-2 pb-2 backdrop-blur-md">
                <div className="min-w-0 flex-1 text-left">
                  <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#20231A] uppercase sm:text-2xl">
                    {isEditing ? "Modify Record" : (selectedBooking.group_name || "Guest Team")}
                  </SheetTitle>
                  
                  <div className="mt-1 flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-[#5E6654]" />
                    <span className="font-black text-xs tracking-wide text-[#5E6654] uppercase tabular-nums">
                      Ref: {selectedBooking.id}
                    </span>
                  </div>
                </div>
              </div>

              <div ref={scrollContainerRef} className="min-h-0 flex-1 touch-pan-y space-y-6 overflow-y-auto overscroll-contain px-6 py-6 text-left">
                
                {!isEditing && (
                  <div className={cn(
                    "flex w-full animate-in items-center justify-between rounded-2xl border-2 px-5 py-4 duration-300 fade-in slide-in-from-top-2",
                    statusTheme[normStatus(selectedBooking.status) || "pending"]?.bg,
                    statusTheme[normStatus(selectedBooking.status) || "pending"]?.border,
                  )}>
                    <div className="flex items-center gap-2.5">
                      <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusTheme[normStatus(selectedBooking.status) || "pending"]?.dot)} />
                      <span className={cn("font-black text-sm tracking-wide uppercase", statusTheme[normStatus(selectedBooking.status) || "pending"]?.text)}>
                        {normStatus(selectedBooking.status) || "pending"}
                      </span>
                    </div>
                    <div className={cn("flex items-center gap-1.5", statusTheme[normStatus(selectedBooking.status) || "pending"]?.text)}>
                      <Users className="h-4 w-4 opacity-50" />
                      <span className="font-black text-2xl leading-none tabular-nums">{selectedBooking.group_size}</span>
                      <span className="mb-0.5 self-end text-[10px] font-bold uppercase opacity-50">guests</span>
                    </div>
                  </div>
                )}

                {isEditing ? (
                  <div className="animate-in space-y-6 duration-300 fade-in slide-in-from-bottom-2">
                    <div className="space-y-2">
                      <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Event Date & Session</Label>
                      <div className="group relative">
                        <select 
                          title="Select Event"
                          value={editForm.event_id}
                          onChange={(e) => handleEventChange(e.target.value)}
                          className="h-14 w-full appearance-none rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold transition-all outline-none focus:border-[#34451F]"
                        >
                          {availableEvents.map(e => (
                            <option key={e.id} value={e.id}>
                              {format(new Date(e.date), "dd MMM yyyy")} - {e.title || "Untitled Event"}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-[#5E6654] opacity-40" />
                      </div>
                      {showEventMoveHint && (
                        <div className="flex animate-in items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 fade-in slide-in-from-top-1">
                          <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                          <p className="font-black text-[10px] tracking-tight text-blue-700 uppercase">Moving event. Table assignment has been reset.</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Team Name</Label>
                      <Input 
                        value={editForm.group_name} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({...prev, group_name: e.target.value}))}
                        className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-base font-bold focus:border-[#34451F] focus:ring-2 focus:ring-[#34451F]/10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Team Size</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {[4, 5, 6].map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => handleGroupSizeChange(size)}
                            className={cn(
                              "h-12 rounded-xl border-2 font-black text-xs transition-all",
                              editForm.group_size === size 
                                ? "scale-105 border-[#34451F] bg-[#34451F] text-white shadow-md" 
                                : "border-[#D8D5C8] bg-white text-[#5E6654] hover:border-[#34451F]/30"
                            )}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Table Assignment</Label>
                      <div className="group relative">
                        <select 
                          title="Select Table"
                          value={editForm.table_id}
                          onChange={(e) => handleTableChange(e.target.value)}
                          className={cn(
                            "h-14 w-full appearance-none rounded-2xl border-2 px-4 text-sm font-bold transition-all outline-none",
                            editForm.table_id ? "border-[#D8D5C8] bg-white focus:border-[#34451F]" : "border-dashed border-[#D8D5C8] bg-[#F4F1E8]"
                          )}
                        >
                          <option value="">Unassigned / No Table</option>
                          {availableTables.map(t => (
                            <option key={t.id} value={t.id}>{t.name} (Cap: {t.max_capacity})</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-[#5E6654] opacity-40" />
                      </div>
                      
                      {showTableConfirmedHint && (
                        <div className="flex animate-in items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 fade-in slide-in-from-top-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <p className="font-black text-[10px] tracking-tight text-green-700 uppercase">Table selected. Status will update to Confirmed.</p>
                        </div>
                      )}
                      {showTableCancelledHint && (
                        <div className="flex animate-in items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 fade-in slide-in-from-top-1">
                          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                          <p className="font-black text-[10px] tracking-tight text-red-700 uppercase">Table removed. Status will update to Cancelled.</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t border-[#D8D5C8] pt-6">
                       <Label className="mb-3 ml-1 block font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Status</Label>
                       <div className={cn(
                         "flex h-14 items-center overflow-hidden rounded-2xl border-2 transition-all",
                         statusTheme[editForm.status]?.border || "border-[#D8D5C8]",
                         statusTheme[editForm.status]?.bg || "bg-white",
                       )}>
                         <div className={cn("ml-4 h-2.5 w-2.5 shrink-0 rounded-full", statusTheme[editForm.status]?.dot)} />
                        <select
                          title="Status"
                           value={editForm.status}
                           onChange={(e) => handleStatusChangeInEdit(e.target.value)}
                           className={cn(
                             "h-full flex-1 cursor-pointer appearance-none bg-transparent px-3 font-black text-sm tracking-wide uppercase outline-none",
                             statusTheme[editForm.status]?.text || "text-[#20231A]",
                           )}
                         >
                           {Object.keys(statusTheme).filter(s => s !== 'all').map(s => (
                             <option key={s} value={s} className="bg-white font-bold text-[#20231A] normal-case">
                               {s.charAt(0).toUpperCase() + s.slice(1)}
                             </option>
                           ))}
                         </select>
                         <svg className={cn("mr-4 h-4 w-4 shrink-0 opacity-60", statusTheme[editForm.status]?.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                       </div>
                       
                       {showStatusTableUnassignedHint && (
                        <div className="mt-3 flex animate-in items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 fade-in slide-in-from-top-1">
                          <RefreshCw className="animate-spin-slow h-3.5 w-3.5 text-amber-600" />
                          <p className="font-black text-[10px] tracking-tight text-amber-700 uppercase">Status changed. Table assignment will be cleared.</p>
                        </div>
                       )}
                    </div>

                    <div className="space-y-2">
                      <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">Special Requests</Label>
                      <Textarea 
                        value={editForm.special_requests} 
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => ({...prev, special_requests: e.target.value}))}
                        placeholder="Dietary requirements, table preference..."
                        className="min-h-35 resize-none rounded-2xl border-2 border-[#D8D5C8] bg-white p-4 text-sm font-medium focus:border-[#34451F] focus:ring-2 focus:ring-[#34451F]/10"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="animate-in space-y-8 duration-300 fade-in">
                    {selectedBooking.booking_scores?.[0] && (
                      <div className="group relative flex items-center justify-between overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#34451F] p-6 text-white shadow-xl">
                        <div className="pointer-events-none absolute top-0 left-0 h-full w-full bg-[#34451F]/5 transition-colors group-hover:bg-[#34451F]/10" />
                        <div className="relative z-10">
                          <p className="mb-1 font-black text-[10px] tracking-[0.3em] text-white uppercase opacity-60">Game Performance</p>
                          <h3 className="font-black text-5xl tracking-tighter tabular-nums">{selectedBooking.booking_scores[0].score} <span className="ml-1 text-sm font-bold tracking-normal opacity-30">pts</span></h3>
                        </div>
                        {selectedBooking.booking_scores[0].is_winner && (
                          <div className="rotate-12 rounded-2xl bg-[#C8956D] p-4 shadow-lg transition-transform group-hover:rotate-0">
                            <Trophy className="h-10 w-10 text-[#34451F]" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="overflow-hidden rounded-3xl border-2 border-[#D8D5C8] bg-white shadow-sm">
                      <InfoRow icon={<Calendar className="h-4 w-4" />}      label="Event Date" value={selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMMM yyyy") : "-"} />
                      <InfoRow icon={<Users className="h-4 w-4" />}      label="Group Size" value={`${selectedBooking.group_size} Guests`} />
                      
                        <InfoRow icon={<TableIcon className="h-4 w-4" />} label="Table" value={selectedBooking.booking_table_mappings?.[0]?.tables?.tables_name || "Unassigned"} />
                      <InfoRow icon={<Clock3 className="h-4 w-4" />}        label="Booked On"  value={selectedBooking.booking_created_at ? format(new Date(selectedBooking.booking_created_at), "dd MMM yyyy · HH:mm") : "-"} />
                      {selectedBooking.updated_at && (
                        <InfoRow icon={<History className="h-4 w-4" />} label="Last Modified" value={format(new Date(selectedBooking.updated_at), "dd MMM yyyy · HH:mm")} />
                      )}
                      {(selectedBooking.updated_by_employee || selectedBooking.updated_by_contact) && (
                        <InfoRow
                          icon={<UserCheck className="h-4 w-4" />}
                          label="Modified By"
                          value={
                            selectedBooking.updated_by_employee?.full_name
                              ?? `${selectedBooking.updated_by_contact!.full_name} (customer)`
                          }
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="px-1 font-black text-[10px] tracking-[0.2em] text-[#5E6654] uppercase opacity-40">Primary Contact</h3>
                      <div className="group/contact flex items-center gap-4 rounded-3xl border-2 border-[#D8D5C8] bg-white p-5 shadow-sm transition-all hover:border-[#34451F]/30">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D8D5C8] bg-[#F4F1E8] font-black text-xl text-[#34451F]">
                          {selectedBooking.contacts?.full_name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate font-black text-base tracking-tight text-[#20231A] uppercase">{selectedBooking.contacts?.full_name}</p>
                          <p className="mt-0.5 text-xs font-bold break-all text-[#5E6654] opacity-60">{selectedBooking.contacts?.email}</p>
                        </div>
                        <Link href={`mailto:${selectedBooking.contacts?.email}`} className="rounded-2xl bg-[#34451F]/5 p-4 text-[#34451F] shadow-xs transition-all hover:bg-[#34451F] hover:text-white active:scale-95">
                          <ExternalLink className="h-5 w-5" />
                        </Link>
                      </div>
                    </div>

                    {selectedBooking.special_requests && (
                      <div className="relative overflow-hidden rounded-3xl border-2 border-[#34451F]/15 bg-[#34451F]/5 p-6 shadow-sm">
                        <div className="relative z-10 mb-4 flex items-center gap-2">
                          <MessageSquareQuote className="h-5 w-5 text-[#34451F] opacity-40" />
                          <span className="font-black text-[10px] tracking-wide text-[#34451F] uppercase">Staff Instructions</span>
                        </div>
                        <p className="relative z-10 text-left text-[15px] leading-relaxed font-bold text-[#20231A] italic">
                          &quot;{selectedBooking.special_requests}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="h-32" />
              </div>

              <div className="z-40 shrink-0 border-t-2 border-[#D8D5C8] bg-white/80 p-6 pt-4 pb-12 shadow-[0_-15px_40px_rgba(0,0,0,0.05)] backdrop-blur-md">
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      onClick={handleSaveDetails} 
                      disabled={isPending}
                      className="h-14 rounded-2xl bg-[#34451F] font-black text-xs tracking-widest text-white uppercase shadow-lg transition-transform hover:bg-[#283719] active:scale-95"
                    >
                      {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                      className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white font-black text-[10px] tracking-wide text-[#5E6654] uppercase shadow-sm"
                    >
                      Discard
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="ghost"
                          className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white font-black text-[10px] tracking-widest text-[#34451F] uppercase"
                           onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({ title: "Delete booking", description: "Permanently delete this booking? This cannot be undone.", confirmLabel: "Delete", variant: "destructive" })
                          if (ok) handleDeleteBooking(selectedBooking.id)
                          }}
                          title="Delete Record"
                        >
                          <><Trash2 className="mr-2 h-4 w-4" />Delete</>
                            
                      </Button>
                      <Button 
                          variant="outline" 
                          title="Edit Details"
                          onClick={handleEnterEditMode}
                          className="h-14 rounded-2xl border border-[#34451F] font-black text-[10px] tracking-widest text-[#34451F] uppercase hover:bg-[#E5EBD8] active:scale-95"
                        
                      >
                        <><Pencil className="mr-2 h-4 w-4" />Edit</>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {isPending && (
        <div className="fixed bottom-10 left-1/2 z-100 flex -translate-x-1/2 animate-in items-center gap-3 rounded-full border border-white/10 bg-[#34451F] px-6 py-3.5 font-black text-[11px] tracking-wide text-white uppercase shadow-2xl duration-300 fade-in slide-in-from-bottom-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Syncing with DB...
        </div>
      )}
      {ConfirmDialogUI}
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
        "group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-[#D8D5C8] bg-white p-3 shadow-sm transition-all active:scale-[0.98] active:bg-[#F4F1E8]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <div className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border", theme.bg, theme.text, theme.border)}>
          {showDate && booking.events?.event_date ? (
            <div className="flex flex-col items-center justify-center leading-none">
              <span className="mb-0.5 font-black text-[10px] tracking-tighter uppercase opacity-80">{format(new Date(booking.events.event_date), "MMM")}</span>
              <span className="font-black text-base tracking-tighter">{format(new Date(booking.events.event_date), "dd")}</span>
            </div>
          ) : (
            booking.booking_scores?.[0]?.is_winner ? <Trophy className="h-5 w-5" /> : <theme.icon className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <h4 className="truncate font-black text-sm tracking-tight text-[#20231A] uppercase">{booking.group_name || "Guest Team"}</h4>
              {booking.special_requests && (
                <span className="shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 font-black text-[10px] text-red-700 uppercase">★</span>
              )}
            </div>
            <span className="ml-2 shrink-0 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-black text-[11px] text-blue-700 uppercase">T: {tableName}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[#5E6654]">
             <p className="truncate text-xs font-semibold">{booking.contacts?.full_name}</p>
             <div className="flex items-center gap-1.5 text-[#20231A]">
                <Users className="h-3.5 w-3.5 text-[#5E6654]/50" />
                <span className="font-black text-sm">{booking.group_size}</span>
                <span className="font-black text-sm">/ {group_max_capacity}</span>
             </div>
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#5E6654]/50" />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#D8D5C8] px-5 py-4 last:border-0">
      <div className="flex shrink-0 items-center gap-2 text-[#5E6654] opacity-60">
        {icon}
        <span className="font-black text-[10px] tracking-wide whitespace-nowrap uppercase">{label}</span>
      </div>
      {label === "Booked On" || label === "Last Modified" || label === "Modified By" ? (
        <span className="flex-1 text-right font-black text-sm leading-snug text-[#5E6654]">{value}</span>
      ) : (
        <span className="flex-1 text-right font-black text-sm leading-snug text-[#20231A]">{value}</span>
      )}
      </div>
  )
}
