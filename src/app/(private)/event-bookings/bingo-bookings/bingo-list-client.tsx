"use client";

import React, { useMemo, useState, useTransition, useEffect, useRef } from "react";
import { format, isSameDay } from "date-fns";
import {
  updateBingoBookingDetails,
  deleteBingoBooking,
  refundBingoBooking,
  getBingoEventList,
} from "./actions";
import { getAvailableTablesForEvent } from "@/app/(private)/event-bookings/quiz-bookings/actions";
import { statusTheme } from "@/app/(private)/event-bookings/quiz-bookings/components/booking-list-client";
import StatusCircle from "@/app/(private)/event-bookings/quiz-bookings/components/status-circle";
import type { BingoBooking } from "./page";
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
  AlertCircle,
  Trash2,
  Calendar,
  Hash,
  User,
  ExternalLink,
  ChevronDown,
  Save,
  MessageSquareQuote,
  RefreshCw,
  CalendarDays,
  CreditCard,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

interface SelectableTable {
  id: number;
  name: string;
  max_capacity: number;
}

interface SelectableEvent {
  id: string;
  date: string;
  title: string | null;
}

export default function BingoBookingListClient({
  bookings,
  selectedDate,
  filterStatus,
  filterPaymentStatus,
  filterFromDate,
  filterMinTotal,
}: {
  bookings: BingoBooking[];
  selectedDate?: string;
  filterStatus?: string;
  filterPaymentStatus?: string;
  filterFromDate?: string;
  filterMinTotal?: string;
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(new Set());
  const [activePaymentStatusFilters, setActivePaymentStatusFilters] = useState<Set<string>>(new Set());
  const [selectedBooking, setSelectedBooking] = useState<BingoBooking | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [availableTables, setAvailableTables] = useState<SelectableTable[]>([]);
  const [availableEvents, setAvailableEvents] = useState<SelectableEvent[]>([]);

  const [editForm, setEditForm] = useState({
    group_name: "",
    group_size: 0,
    special_requests: "",
    table_id: "",
    status: "",
    event_id: "",
  });

  const searchParams = useSearchParams();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topFocusRef = useRef<HTMLSpanElement>(null);

  const isDateFiltered = !!(selectedDate || searchParams.get("date"));

  const toggleStatusFilter = (status: string) => {
    const next = new Set(activeStatusFilters);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setActiveStatusFilters(next);
  };

  const handleEnterEditMode = async () => {
    if (!selectedBooking) return;
    const currentTableId = selectedBooking.booking_table_mappings?.[0]?.tables?.tables_id;
    const currentEventId = String(selectedBooking.event_id ?? "");

    setEditForm({
      group_name: selectedBooking.group_name || "",
      group_size: Number(selectedBooking.group_size) || 0,
      special_requests: selectedBooking.special_requests || "",
      table_id: currentTableId || "",
      status: normStatus(selectedBooking.status) || "pending",
      event_id: currentEventId,
    });
    setIsEditing(true);

    if (selectedBooking.event_id) {
      const tables = await getAvailableTablesForEvent(
        currentEventId,
        Number(selectedBooking.group_size) || 0,
        currentTableId
      );
      setAvailableTables(tables as unknown as SelectableTable[]);
    }

    const events = await getBingoEventList("games", "bingo");
    setAvailableEvents(
      events.map((e) => ({
        id: String(e.id),
        date: String(e.date),
        title: (e as { title?: string | null }).title ?? null,
      }))
    );
  };

  const handleEventChange = async (newEventId: string) => {
    setEditForm((prev) => ({ ...prev, event_id: newEventId, table_id: "" }));
    const tables = await getAvailableTablesForEvent(newEventId, editForm.group_size, "");
    setAvailableTables(tables as unknown as SelectableTable[]);
  };

  const handleTableChange = (newTableId: string, forcedStatus?: string) => {
    const originalTableId = selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id || "";
    const wasUnassigned = originalTableId === "";
    const isUnassigned = newTableId === "";
    let newStatus = forcedStatus || editForm.status;
    if (!forcedStatus) {
      if (wasUnassigned && !isUnassigned) newStatus = "confirmed";
      else if (!wasUnassigned && isUnassigned) newStatus = "cancelled";
    }
    setEditForm((prev) => ({ ...prev, table_id: newTableId, status: newStatus }));
  };

  const handleStatusChangeInEdit = (newStatus: string) => {
    const originalStatus = normStatus(selectedBooking?.status) || "pending";
    let newTableId = editForm.table_id;
    if (originalStatus === "confirmed" && newStatus !== "confirmed") newTableId = "";
    setEditForm((prev) => ({ ...prev, status: newStatus, table_id: newTableId }));
  };

  const handleGroupSizeChange = async (size: number) => {
    setEditForm((prev) => ({ ...prev, group_size: size }));
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
      const isCurrentValid = newAvailableTables.some((t) => String(t.id) === String(currentTableId));
      if (!isCurrentValid) {
        if (newAvailableTables.length > 0) {
          handleTableChange(String(newAvailableTables[0].id));
          toast.info(`Group size updated. Table auto-reassigned to ${newAvailableTables[0].name}.`);
        } else {
          handleTableChange("", "waitlisted");
          toast.warning("No suitable tables available for this group size. Booking moved to waitlist.");
        }
      }
    }
  };

  const handleSelectBooking = (booking: BingoBooking) => {
    setSelectedBooking(booking);
    setIsEditing(false);
  };

  useEffect(() => {
    if (selectedBooking) {
      const timer = setTimeout(() => {
        topFocusRef.current?.focus();
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedBooking]);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        const bDate = b.events?.event_date ? new Date(b.events.event_date) : null;
        const matchesDate = selectedDate && bDate ? isSameDay(bDate, new Date(selectedDate)) : !selectedDate;
        const bStatus = normStatus(b.status);
        const matchesStatus = activeStatusFilters.size === 0 ? true : activeStatusFilters.has(bStatus);
        const q = searchQuery.trim().toLowerCase();
        return (
          matchesDate &&
          matchesStatus &&
          (q === "" ||
            (b.group_name || "").toLowerCase().includes(q) ||
            (b.contacts?.full_name || "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const dateA = a.events?.event_date || "";
        const dateB = b.events?.event_date || "";
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (a.group_name || "").localeCompare(b.group_name || "");
      });
  }, [bookings, selectedDate, activeStatusFilters, searchQuery]);

  const stats = useMemo(() => {
    const contextBookings = selectedDate
      ? bookings.filter((b) => b.events?.event_date === selectedDate)
      : bookings;
    const getAgg = (list: BingoBooking[]) => ({
      teams: list.length,
      guests: list.reduce((acc, b) => acc + (Number(b.group_size) || 0), 0),
    });
    return {
      total: getAgg(contextBookings),
      confirmed: getAgg(contextBookings.filter((b) => normStatus(b.status) === "confirmed")),
      waitlisted: getAgg(contextBookings.filter((b) => normStatus(b.status) === "waitlisted")),
      pending: getAgg(
        contextBookings.filter((b) => {
          const s = normStatus(b.status);
          return s === "" || s === "pending";
        })
      ),
      cancelled: getAgg(contextBookings.filter((b) => normStatus(b.status) === "cancelled")),
    };
  }, [bookings, selectedDate]);

  const handleSaveDetails = () => {
    if (!selectedBooking) return;
    startTransition(async () => {
      try {
        await updateBingoBookingDetails(selectedBooking.id, editForm);

        const table = availableTables.find((t) => String(t.id) === String(editForm.table_id));
        const tableMapping = editForm.table_id
          ? [{ tables: { tables_id: editForm.table_id, tables_name: table?.name || "Assigned", tables_capacity: table?.max_capacity } }]
          : [];

        const targetEvent = availableEvents.find((e) => String(e.id) === String(editForm.event_id));

        setSelectedBooking((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            ...editForm,
            event_id: editForm.event_id,
            events: targetEvent
              ? { ...prev.events, event_date: targetEvent.date, event_title: targetEvent.title ?? undefined }
              : prev.events,
            booking_table_mappings: tableMapping as BingoBooking["booking_table_mappings"],
          };
        });

        setIsEditing(false);
        toast.success("Booking updated successfully");
      } catch (error) {
        console.error(error);
        toast.error("Failed to save changes");
      }
    });
  };

  const handleDeleteBooking = (id: string) => {
    startTransition(async () => {
      try {
        await deleteBingoBooking(id);
        setSelectedBooking(null);
        setIsEditing(false);
        toast.success("Booking deleted permanently");
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete booking");
      }
    });
  };

  const handleRefund = (id: string) => {
    startTransition(async () => {
      try {
        await refundBingoBooking(id);
        setSelectedBooking((prev) =>
          prev ? { ...prev, payment_status: "refunded", status: "cancelled" } : null
        );
        toast.success("Refund processed successfully");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Refund failed");
      }
    });
  };

  const originalTableId = selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id || "";
  const originalStatus = normStatus(selectedBooking?.status) || "pending";
  const originalEventId = String(selectedBooking?.event_id || "");

  const showTableConfirmedHint = originalTableId === "" && editForm.table_id !== "" && editForm.status === "confirmed";
  const showTableCancelledHint = originalTableId !== "" && editForm.table_id === "" && editForm.status === "cancelled";
  const showStatusTableUnassignedHint = originalStatus === "confirmed" && editForm.status !== "confirmed" && editForm.table_id === "";
  const showEventMoveHint = originalEventId !== editForm.event_id;

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* Stats + Search grouped card */}
      <div className="bg-white border border-[#E6DFC8] rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center">

          {/* Stats Bar */}
          <div className="overflow-x-auto no-scrollbar px-2 pt-2 sm:flex-1 sm:pt-0">
            <div className="flex items-stretch gap-3 w-full px-2 py-3 min-w-max sm:min-w-0 sm:justify-evenly sm:gap-0">
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

          {/* Divider */}
          <div className="border-t border-[#E6DFC8] mx-3 sm:hidden" />
          <div className="hidden sm:block w-px bg-[#E6DFC8] sm:self-stretch sm:my-2" />

          {/* Search */}
          <div className="flex justify-center px-4 mb-3 sm:mb-0 sm:py-2 sm:px-3 sm:shrink-0">
            <div className="flex items-center gap-3 h-10 px-4 w-full max-w-sm sm:w-56 rounded-xl border border-[#E6DFC8] focus-within:border-slate-400 transition-colors">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
                <input
                  type="text"
                  placeholder="Search group names or guests..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-sm text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/50 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                />
              </div>
              {(activeStatusFilters.size > 0 || searchQuery.length > 0) && (
                <button
                  type="button"
                  title="Cancel"
                  onClick={() => { setActiveStatusFilters(new Set()); setSearchQuery(""); }}
                  className="shrink-0 p-1 rounded-lg hover:bg-[#E6DFC8] transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[#5F624F]/50" />
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Booking Cards */}
      <div className="space-y-2 pb-2">
        {filteredBookings.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-[#E6DFC8]">
            <Inbox className="w-10 h-10 text-[#5F624F]/50 mx-auto mb-3" />
            <p className="text-[#5F624F] text-sm font-medium">No bookings found</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <BingoBookingCard
              key={b.id}
              booking={b}
              showDate={!isDateFiltered}
              onClick={() => handleSelectBooking(b)}
            />
          ))
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet
        open={!!selectedBooking}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBooking(null);
            setIsEditing(false);
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

              {/* Header */}
              <div className="shrink-0 p-2 pb-2 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 flex flex-row items-start justify-between gap-2">
                <div className="flex-1 min-w-0 text-left">
                  <SheetTitle className="text-xl sm:text-2xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                    {isEditing ? "Modify Record" : (selectedBooking.group_name || "Guest Group")}
                  </SheetTitle>
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

                {/* Status + Group Size Banner */}
                {!isEditing && (
                  <div
                    className={cn(
                      "flex items-center justify-between w-full px-5 py-4 rounded-2xl border-2 animate-in fade-in slide-in-from-top-2 duration-300",
                      statusTheme[normStatus(selectedBooking.status) || "pending"]?.bg,
                      statusTheme[normStatus(selectedBooking.status) || "pending"]?.border,
                    )}
                  >
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
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* Event */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-[#5F624F] ml-1">Event Date & Session</Label>
                      <div className="relative group">
                        <select
                          title="Select Event"
                          value={editForm.event_id}
                          onChange={(e) => handleEventChange(e.target.value)}
                          className="w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold appearance-none outline-none focus:border-[#26300D] transition-all"
                        >
                          {availableEvents.map((e) => (
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

                    {/* Group Name */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-[#5F624F] ml-1">Group Name</Label>
                      <Input
                        value={editForm.group_name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditForm((prev) => ({ ...prev, group_name: e.target.value }))
                        }
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white text-base font-bold px-4 focus:ring-2 focus:ring-[#26300D]/10 focus:border-[#26300D]"
                      />
                    </div>

                    {/* Group Size */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-[#5F624F] ml-1">Group Size</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editForm.group_size || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleGroupSizeChange(parseInt(e.target.value) || 0)
                        }
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white text-base font-bold px-4 focus:ring-2 focus:ring-[#26300D]/10 focus:border-[#26300D]"
                      />
                    </div>

                    {/* Table Assignment */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-[#5F624F] ml-1">Table Assignment</Label>
                      <div className="relative group">
                        <select
                          title="Select Table"
                          value={editForm.table_id}
                          onChange={(e) => handleTableChange(e.target.value)}
                          className={cn(
                            "w-full h-14 rounded-2xl border-2 px-4 text-sm font-bold appearance-none outline-none transition-all",
                            editForm.table_id
                              ? "bg-white border-[#E6DFC8] focus:border-[#26300D]"
                              : "bg-[#F7F4EA] border-dashed border-[#E6DFC8]"
                          )}
                        >
                          <option value="">Unassigned / No Table</option>
                          {availableTables.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} (Cap: {t.max_capacity})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5F624F] opacity-40 pointer-events-none" />
                      </div>
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

                    {/* Status */}
                    <div className="pt-6 border-t border-[#E6DFC8]">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-[#5F624F] ml-1 mb-3 block">Status</Label>
                      <div
                        className={cn(
                          "flex items-center h-14 rounded-2xl border-2 overflow-hidden transition-all",
                          statusTheme[editForm.status]?.border || "border-[#E6DFC8]",
                          statusTheme[editForm.status]?.bg || "bg-white",
                        )}
                      >
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
                          {Object.keys(statusTheme)
                            .filter((s) => s !== "all")
                            .map((s) => (
                              <option key={s} value={s} className="text-[#1F1F1A] bg-white normal-case font-bold">
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                        </select>
                        <svg className={cn("w-4 h-4 mr-4 shrink-0 opacity-60", statusTheme[editForm.status]?.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {showStatusTableUnassignedHint && (
                        <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                          <p className="text-[10px] font-black uppercase text-amber-700 tracking-tight">Status changed. Table assignment will be cleared.</p>
                        </div>
                      )}
                    </div>

                    {/* Special Requests */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-[#5F624F] ml-1">Special Requests</Label>
                      <Textarea
                        value={editForm.special_requests}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setEditForm((prev) => ({ ...prev, special_requests: e.target.value }))
                        }
                        placeholder="Dietary requirements, seating preference..."
                        className="min-h-[140px] rounded-2xl border-2 border-[#E6DFC8] bg-white text-sm font-medium p-4 focus:ring-2 focus:ring-[#26300D]/10 focus:border-[#26300D] resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="space-y-8 animate-in fade-in duration-300">

                    {/* Payment pill */}
                    {selectedBooking.payment_status && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          selectedBooking.payment_status === "paid"
                            ? "bg-green-50 border-green-200 text-green-700"
                            : selectedBooking.payment_status === "refunded"
                            ? "bg-[#F7F4EA] border-[#E6DFC8] text-[#5F624F]"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        )}>
                          <CreditCard className="w-3 h-3" />
                          {selectedBooking.payment_status}
                        </span>
                        {(selectedBooking.paid_amount != null || selectedBooking.total_amount != null) && (
                          <span className="text-[11px] font-black text-[#5F624F]">
                            £{(selectedBooking.paid_amount ?? selectedBooking.total_amount ?? 0).toFixed(2)}
                            {selectedBooking.total_amount != null && selectedBooking.paid_amount !== selectedBooking.total_amount && (
                              <span className="opacity-50"> / £{selectedBooking.total_amount.toFixed(2)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden shadow-sm">
                      <InfoRow
                        icon={<Calendar className="w-4 h-4" />}
                        label="Event Date"
                        value={selectedBooking.events?.event_date ? format(new Date(selectedBooking.events.event_date), "do MMMM yyyy") : "—"}
                      />
                      <InfoRow
                        icon={<User className="w-4 h-4" />}
                        label="Table Name"
                        value={selectedBooking.group_name || "—"}
                      />
                      <InfoRow
                        icon={<Users className="w-4 h-4" />}
                        label="Group Size"
                        value={`${selectedBooking.group_size} Guests`}
                      />
                      <InfoRow
                        icon={<TableIcon className="w-4 h-4" />}
                        label="Table"
                        value={selectedBooking.booking_table_mappings?.[0]?.tables?.tables_name || "Unassigned"}
                      />
                      <InfoRow
                        icon={<Clock3 className="w-4 h-4" />}
                        label="Booked On"
                        value={selectedBooking.booking_created_at ? format(new Date(selectedBooking.booking_created_at), "dd MMM yyyy · HH:mm") : "—"}
                      />
                    </div>

                    {/* Contact */}
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-40 px-1">Primary Contact</h3>
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl p-5 shadow-sm flex items-center gap-4 hover:border-[#26300D]/30 transition-all group/contact">
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
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#26300D]">Special Requests</span>
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

              {/* Sticky Footer */}
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
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="ghost"
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#26300D] font-black uppercase tracking-[0.1em] text-[10px] bg-white"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: "Delete booking",
                            description: "Permanently delete this booking? This cannot be undone.",
                            confirmLabel: "Delete",
                            variant: "destructive",
                          });
                          if (ok) handleDeleteBooking(selectedBooking.id);
                        }}
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />Delete
                      </Button>
                      <Button
                        variant="outline"
                        title="Edit Details"
                        onClick={handleEnterEditMode}
                        className="h-14 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                      >
                        <Pencil className="w-4 h-4 mr-2" />Edit
                      </Button>
                    </div>
                    {selectedBooking.payment_status === "paid" && (
                      <Button
                        variant="outline"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: "Process refund",
                            description: "This will cancel the booking and attempt a refund via Square. Are you sure?",
                            confirmLabel: "Refund",
                            variant: "destructive",
                          });
                          if (ok) handleRefund(selectedBooking.id);
                        }}
                        disabled={isPending}
                        className="h-12 w-full rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-widest text-[10px] bg-white hover:bg-[#F7F4EA]"
                      >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Refund via Square
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Syncing indicator */}
      {isPending && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-100 bg-[#26300D] text-[#FDCC4B] px-6 py-3.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Loader2 className="w-4 h-4 animate-spin" /> Syncing with DB...
        </div>
      )}
      {ConfirmDialogUI}
    </div>
  );
}

function BingoBookingCard({
  booking,
  onClick,
  showDate,
}: {
  booking: BingoBooking;
  onClick: () => void;
  showDate?: boolean;
}) {
  const status = normStatus(booking.status) || "pending";
  const theme = statusTheme[status] || statusTheme.pending;
  const tableName = booking.booking_table_mappings?.[0]?.tables?.tables_name || "--";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group active:scale-[0.98] active:bg-slate-50 transition-all border-2 border-[#E6DFC8] rounded-2xl p-3 flex items-center justify-between cursor-pointer bg-white shadow-sm gap-3"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
        <div className={cn("w-11 h-11 rounded-full flex flex-col items-center justify-center shrink-0 border", theme.bg, theme.text, theme.border)}>
          {showDate && booking.events?.event_date ? (
            <div className="flex flex-col leading-none items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-tighter opacity-80 mb-0.5">
                {format(new Date(booking.events.event_date), "MMM")}
              </span>
              <span className="text-base font-black tracking-tighter">
                {format(new Date(booking.events.event_date), "dd")}
              </span>
            </div>
          ) : (
            theme.icon
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h4 className="text-sm font-black text-[#1F1F1A] truncate uppercase tracking-tight">
                {booking.group_name || booking.contacts?.full_name || "Guest Group"}
              </h4>
              {booking.special_requests && (
                <span className="shrink-0 text-[10px] font-black text-red-700 uppercase bg-red-50 px-1.5 py-0.5 rounded border border-red-200">★</span>
              )}
            </div>
            <span className="shrink-0 text-[11px] font-black text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 ml-2">
              T: {tableName}
            </span>
          </div>
          <div className="flex items-center justify-between text-[#5F624F] mt-1 gap-2">
            <p className="text-xs truncate font-semibold min-w-0">{booking.contacts?.full_name}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {booking.payment_status && (
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded border leading-none",
                  booking.payment_status === "paid"
                    ? "bg-green-50 border-green-200 text-green-700"
                    : booking.payment_status === "refunded"
                    ? "bg-[#F7F4EA] border-[#E6DFC8] text-[#5F624F]"
                    : normStatus(booking.status) === "confirmed"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                )}>
                  {booking.payment_status}
                </span>
              )}
              <div className="flex items-center gap-1 text-[#1F1F1A]">
                <Users className="w-3.5 h-3.5 text-[#5F624F]/50" />
                <span className="text-sm font-black">{booking.group_size}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{label}</span>
      </div>
      <span className={cn("text-sm font-black text-right flex-1 leading-snug", label === "Booked On" ? "text-[#5F624F]" : "text-[#1F1F1A]")}>
        {value}
      </span>
    </div>
  );
}
