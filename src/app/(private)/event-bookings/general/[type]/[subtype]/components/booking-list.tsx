"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  ExternalLink,
  Hash,
  HelpCircle,
  Loader2,
  Mail,
  MessageSquareQuote,
  Pencil,
  RefreshCw,
  Save,
  Table as TableIcon,
  Trash2,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getEventsForType,
  getAvailableTablesForEventGeneral,
  updateGeneralBookingDetails,
  deleteGeneralBooking,
} from "../actions";

interface TableRow {
  tables_id: string;
  tables_name?: string;
  tables_capacity?: number;
}

interface ContactRow {
  full_name?: string;
  email?: string;
  country_code?: string;
  phone_no?: string;
}

interface EventRow {
  event_date?: string;
  event_title?: string | null;
  event_payment_amount?: number | null;
  seating_required?: boolean | null;
}

export interface GeneralBooking {
  id: string;
  event_id?: string;
  group_name?: string | null;
  group_size?: number | null;
  status?: string | null;
  payment_status?: string | null;
  paid_amount?: number | null;
  total_amount?: number | null;
  special_requests?: string | null;
  booking_created_at?: string;
  contacts?: ContactRow | null;
  events?: EventRow;
  booking_table_mappings?: { tables?: TableRow | null }[];
}

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

const STATUS_TABS = ["All", "Confirmed", "Waitlisted", "Pending", "Cancelled"] as const;

const normStatus = (s?: string | null) => (s || "").trim().toLowerCase();

// Date strings come from the DB as YYYY-MM-DD — anchor to local midnight to
// avoid timezone shifts (see CLAUDE.md).
const parseDate = (d?: string | null) => (d ? new Date(d + "T00:00:00") : null);

// Mirrors statusTheme in quiz-bookings/components/booking-list-client.tsx so the
// cards and detail sheet read consistently across booking surfaces.
const statusTheme: Record<
  string,
  { bg: string; text: string; border: string; dot: string; icon: React.ReactNode }
> = {
  all: {
    bg: "bg-[#F7F4EA]",
    text: "text-[#1F1F1A]",
    border: "border-[#E6DFC8]",
    dot: "bg-[#5F624F]",
    icon: <TableIcon className="w-5 h-5" />,
  },
  confirmed: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  waitlisted: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
    icon: <Clock3 className="w-5 h-5" />,
  },
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-yellow-200",
    dot: "bg-amber-500",
    icon: <HelpCircle className="w-5 h-5" />,
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    icon: <XCircle className="w-5 h-5" />,
  },
};

export default function BookingList({
  bookings,
  activeStatus,
  showDate = true,
  type,
  subtype,
}: {
  bookings: GeneralBooking[];
  activeStatus?: string;
  showDate?: boolean;
  type: string;
  subtype: string;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [internalTab, setInternalTab] = useState("All");
  const [selectedBooking, setSelectedBooking] = useState<GeneralBooking | null>(null);
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topFocusRef = useRef<HTMLSpanElement>(null);

  // When `activeStatus` is supplied the filter is controlled by the parent (the
  // stats bar) and the internal tab row is hidden. Otherwise BookingList owns it.
  const controlled = activeStatus !== undefined;
  const effectiveStatus = (controlled ? activeStatus! : internalTab).toLowerCase();

  const tabCounts = Object.fromEntries(
    STATUS_TABS.map(t => [
      t,
      t === "All"
        ? bookings.length
        : bookings.filter(b => normStatus(b.status) === t.toLowerCase()).length,
    ])
  );

  const visibleTabs = STATUS_TABS.filter(t => t === "All" || tabCounts[t] > 0);

  const filtered = effectiveStatus === "all"
    ? bookings
    : bookings.filter(b => normStatus(b.status) === effectiveStatus);

  // Reset scroll to top whenever a booking opens.
  useEffect(() => {
    if (selectedBooking) {
      const timer = setTimeout(() => {
        topFocusRef.current?.focus();
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedBooking]);

  const handleSelectBooking = (booking: GeneralBooking) => {
    setSelectedBooking(booking);
    setIsEditing(false);
  };

  const closeSheet = () => {
    setSelectedBooking(null);
    setIsEditing(false);
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
      const tables = await getAvailableTablesForEventGeneral(
        currentEventId,
        Number(selectedBooking.group_size) || 0,
        currentTableId,
      );
      setAvailableTables(tables as unknown as SelectableTable[]);
    }

    // All events of this type/subtype, so the booking can be moved.
    const events = await getEventsForType(type, subtype);
    setAvailableEvents(events as unknown as SelectableEvent[]);
  };

  const handleEventChange = async (newEventId: string) => {
    // Moving event clears the (date-specific) table assignment.
    setEditForm(prev => ({ ...prev, event_id: newEventId, table_id: "" }));
    const tables = await getAvailableTablesForEventGeneral(newEventId, editForm.group_size, "");
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

    setEditForm(prev => ({ ...prev, table_id: newTableId, status: newStatus }));
  };

  const handleStatusChangeInEdit = (newStatus: string) => {
    const wasConfirmed = (normStatus(selectedBooking?.status) || "pending") === "confirmed";
    let newTableId = editForm.table_id;
    if (wasConfirmed && newStatus !== "confirmed") newTableId = "";
    setEditForm(prev => ({ ...prev, status: newStatus, table_id: newTableId }));
  };

  const handleGroupSizeChange = async (size: number) => {
    setEditForm(prev => ({ ...prev, group_size: size }));

    if (editForm.event_id) {
      const tables = await getAvailableTablesForEventGeneral(
        editForm.event_id,
        size,
        selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id,
      );
      const newAvailableTables = tables as unknown as SelectableTable[];
      setAvailableTables(newAvailableTables);

      const currentTableId = editForm.table_id;
      if (currentTableId === "") return;

      const isCurrentTableValid = newAvailableTables.some(t => String(t.id) === String(currentTableId));
      if (!isCurrentTableValid) {
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

  const handleSaveDetails = () => {
    if (!selectedBooking) return;
    startTransition(async () => {
      try {
        await updateGeneralBookingDetails(selectedBooking.id, editForm);
        setIsEditing(false);
        setSelectedBooking(null);
        toast.success("Booking updated successfully");
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error("Failed to save changes");
      }
    });
  };

  const handleDeleteBooking = (id: string) => {
    startTransition(async () => {
      try {
        await deleteGeneralBooking(id);
        closeSheet();
        toast.success("Booking deleted permanently");
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete booking");
      }
    });
  };

  // Reactive hint flags for edit-mode UI feedback
  const originalTableId = selectedBooking?.booking_table_mappings?.[0]?.tables?.tables_id || "";
  const originalStatus = normStatus(selectedBooking?.status) || "pending";
  const originalEventId = String(selectedBooking?.event_id || "");
  const showTableConfirmedHint = selectedBooking?.events?.seating_required !== false && originalTableId === "" && editForm.table_id !== "" && editForm.status === "confirmed";
  const showTableCancelledHint = selectedBooking?.events?.seating_required !== false && originalTableId !== "" && editForm.table_id === "" && editForm.status === "cancelled";
  const showStatusTableUnassignedHint = selectedBooking?.events?.seating_required !== false && originalStatus === "confirmed" && editForm.status !== "confirmed" && editForm.table_id === "";
  const showEventMoveHint = selectedBooking?.events?.seating_required !== false && originalEventId !== editForm.event_id;

  if (bookings.length === 0) {
    return (
      <div className="bg-white border border-[#E6DFC8] rounded-2xl p-10 text-center">
        <CalendarDays className="w-8 h-8 text-[#5F624F] opacity-20 mx-auto mb-3" />
        <p className="text-sm font-black text-[#1F1F1A]">No bookings</p>
        <p className="text-[11px] text-[#5F624F] opacity-60 mt-1">Select an event above to filter bookings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status tabs — hidden when filtering is controlled by the stats bar */}
      {!controlled && (
        <div className="flex flex-wrap gap-1.5">
          {visibleTabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setInternalTab(tab)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors",
                internalTab === tab
                  ? "bg-[#5C4033] text-white"
                  : "bg-[#F7F4EA] text-[#5F624F] hover:bg-[#E6DFC8]"
              )}
            >
              {tab}
              {tabCounts[tab] > 0 && (
                <span className="ml-1 opacity-60">({tabCounts[tab]})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E6DFC8] rounded-2xl p-6 text-center">
          <p className="text-[11px] font-bold text-[#5F624F] uppercase tracking-wide opacity-60">
            No {effectiveStatus === "all" ? "" : effectiveStatus} bookings
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => (
            <BookingCard key={b.id} booking={b} showDate={showDate} onClick={() => handleSelectBooking(b)} />
          ))}
        </div>
      )}

      {/* Detail bottom sheet */}
      <Sheet open={!!selectedBooking} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh] flex flex-col outline-none shadow-2xl"
        >
          {selectedBooking && (() => {
            const status = normStatus(selectedBooking.status) || "pending";
            const theme = statusTheme[status] || statusTheme.pending;
            const eventDate = parseDate(selectedBooking.events?.event_date);
            const tableName = selectedBooking.booking_table_mappings?.[0]?.tables?.tables_name || "Unassigned";
            const hasPayment = selectedBooking.paid_amount != null || selectedBooking.total_amount != null;
            const seatingRequired = selectedBooking.events?.seating_required !== false;

            return (
              <>
                <span ref={topFocusRef} tabIndex={-1} className="sr-only" />

                {/* Header */}
                <div className="shrink-0 p-2 pb-2 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 flex flex-row items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 text-left">
                    <SheetTitle className="text-xl sm:text-2xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
                      {isEditing ? "Modify Booking" : "View Booking"}
                    </SheetTitle>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Hash className="w-3 h-3 text-[#5F624F]" />
                      <span className="text-xs font-black text-[#5F624F] uppercase tracking-wide tabular-nums">
                        Ref: {selectedBooking.id}
                      </span>
                    </div>
                  </div>
                  {/* Status pill — right-aligned, view mode only */}
                  {!isEditing && (
                    <span className={cn(
                      "shrink-0 self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black uppercase tracking-wider",
                      theme.bg,
                      theme.text,
                      theme.border,
                    )}>
                      <span className={cn("w-2 h-2 rounded-full shrink-0", theme.dot)} />
                      {status}
                    </span>
                  )}
                </div>

                {/* Scrollable Body */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0 touch-pan-y overscroll-contain text-left">

                  {isEditing ? (
                    /* EDIT MODE FORM */
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* Event */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Event Date &amp; Session</Label>
                        <div className="relative group">
                          <select
                            title="Select Event"
                            value={editForm.event_id}
                            onChange={(e) => handleEventChange(e.target.value)}
                            className="w-full h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold appearance-none outline-none focus:border-[#5C4033] transition-all"
                          >
                            {availableEvents.map(e => (
                              <option key={e.id} value={e.id}>
                                {format(parseDate(e.date)!, "dd MMM yyyy")} - {e.title || "Untitled Event"}
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

                      {/* Group name */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Group Name</Label>
                        <Input
                          aria-label="Group Name"
                          value={editForm.group_name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({ ...prev, group_name: e.target.value }))}
                          className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white text-base font-bold px-4 focus:ring-2 focus:ring-[#5C4033]/10 focus:border-[#5C4033]"
                        />
                      </div>

                      {/* Group size */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Group Size</Label>
                        <Input
                          aria-label="Group Size"
                          type="number"
                          min={1}
                          value={editForm.group_size || ""}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleGroupSizeChange(Number(e.target.value) || 0)}
                          className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white text-base font-bold px-4 focus:ring-2 focus:ring-[#5C4033]/10 focus:border-[#5C4033]"
                        />
                      </div>

                      {/* Table assignment */}
                      {seatingRequired && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Table Assignment</Label>
                        <div className="relative group">
                          <select
                            title="Select Table"
                            value={editForm.table_id}
                            onChange={(e) => handleTableChange(e.target.value)}
                            className={cn(
                              "w-full h-14 rounded-2xl border-2 px-4 text-sm font-bold appearance-none outline-none transition-all",
                              editForm.table_id ? "bg-white border-[#E6DFC8] focus:border-[#5C4033]" : "bg-[#F7F4EA] border-dashed border-[#E6DFC8]"
                            )}
                          >
                            <option value="">Unassigned / No Table</option>
                            {availableTables.map(t => (
                              <option key={t.id} value={t.id}>{t.name} (Cap: {t.max_capacity})</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5F624F] opacity-40 pointer-events-none" />
                        </div>
                        {showTableConfirmedHint && (
                          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            <p className="text-[10px] font-black uppercase text-green-700 tracking-tight">Table selected. Status will update to Confirmed.</p>
                          </div>
                        )}
                        {showTableCancelledHint && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                            <p className="text-[10px] font-black uppercase text-red-700 tracking-tight">Table removed. Status will update to Cancelled.</p>
                          </div>
                        )}
                      </div>
                      )}

                      {/* Status */}
                      <div className="pt-6 border-t border-[#E6DFC8]">
                        <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1 mb-3 block">Status</Label>
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
                              "flex-1 h-full px-3 bg-transparent outline-none text-sm font-black uppercase tracking-wide cursor-pointer appearance-none",
                              statusTheme[editForm.status]?.text || "text-[#1F1F1A]",
                            )}
                          >
                            {Object.keys(statusTheme).filter(s => s !== "all").map(s => (
                              <option key={s} value={s} className="text-[#1F1F1A] bg-white normal-case font-bold">
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className={cn("w-4 h-4 mr-4 shrink-0 opacity-60", statusTheme[editForm.status]?.text)} />
                        </div>
                        {showStatusTableUnassignedHint && (
                          <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                            <p className="text-[10px] font-black uppercase text-amber-700 tracking-tight">Status changed. Table assignment will be cleared.</p>
                          </div>
                        )}
                      </div>

                      {/* Special requests */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Special Requests</Label>
                        <Textarea
                          aria-label="Special Requests"
                          value={editForm.special_requests}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => ({ ...prev, special_requests: e.target.value }))}
                          placeholder="Dietary requirements, table preference..."
                          className="min-h-35 rounded-2xl border-2 border-[#E6DFC8] bg-white text-sm font-medium p-4 focus:ring-2 focus:ring-[#5C4033]/10 focus:border-[#5C4033] resize-none"
                        />
                      </div>
                    </div>
                  ) : (
                    /* VIEW MODE DETAILS */
                    <div className="space-y-8 animate-in fade-in duration-300">
                      <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden shadow-sm">
                        <InfoRow icon={<Calendar className="w-4 h-4" />} label="Event Date" value={eventDate ? format(eventDate, "do MMMM yyyy") : "—"} />
                        <InfoRow icon={<User className="w-4 h-4" />} label="Group Name" value={selectedBooking.group_name?.trim() || selectedBooking.contacts?.full_name || "—"} />
                        <InfoRow icon={<Users className="w-4 h-4" />} label="Group Size" value={selectedBooking.group_size != null ? `${selectedBooking.group_size} Guests` : "—"} />
                        {seatingRequired && (
                          <InfoRow icon={<TableIcon className="w-4 h-4" />} label="Table" value={tableName} />
                        )}
                        <InfoRow icon={<Clock3 className="w-4 h-4" />} label="Booked On" value={selectedBooking.booking_created_at ? format(new Date(selectedBooking.booking_created_at), "dd MMM yyyy · HH:mm") : "—"} />
                        {hasPayment && (
                          <InfoRow
                            icon={<CreditCard className="w-4 h-4" />}
                            label="Payment"
                            value={`£${(selectedBooking.paid_amount ?? 0).toFixed(2)} / £${(selectedBooking.total_amount ?? 0).toFixed(2)}`}
                          />
                        )}
                        {selectedBooking.payment_status && (
                          <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Pay Status" value={selectedBooking.payment_status} />
                        )}
                      </div>

                      {/* Primary contact */}
                      {selectedBooking.contacts && (
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F624F] opacity-40 px-1">Primary Contact</h3>
                          <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl p-5 shadow-sm flex items-center gap-4 transition-all hover:border-[#5C4033]/30">
                            <div className="w-14 h-14 rounded-2xl bg-[#F7F4EA] flex items-center justify-center font-black text-xl text-[#5C4033] border border-[#E6DFC8]">
                              {selectedBooking.contacts.full_name?.charAt(0) || "U"}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-base font-black text-[#1F1F1A] uppercase tracking-tight truncate">{selectedBooking.contacts.full_name}</p>
                              {selectedBooking.contacts.email && (
                                <p className="text-xs font-bold text-[#5F624F] opacity-60 break-all mt-0.5">{selectedBooking.contacts.email}</p>
                              )}
                              {selectedBooking.contacts.phone_no && (
                                <p className="text-xs font-bold text-[#5F624F] opacity-60 mt-0.5">
                                  {selectedBooking.contacts.country_code} {selectedBooking.contacts.phone_no}
                                </p>
                              )}
                            </div>
                            {selectedBooking.contacts.email && (
                              <Link href={`mailto:${selectedBooking.contacts.email}`} title="Email contact" className="p-4 bg-[#5C4033]/5 rounded-2xl text-[#5C4033] hover:bg-[#5C4033] hover:text-white transition-all active:scale-95 shadow-xs">
                                <Mail className="w-5 h-5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Special requests */}
                      {selectedBooking.special_requests && (
                        <div className="bg-[#5C4033]/5 p-6 rounded-3xl border-2 border-[#5C4033]/15 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <MessageSquareQuote className="w-5 h-5 text-[#5C4033] opacity-40" />
                            <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Staff Instructions</span>
                          </div>
                          <p className="text-[15px] text-[#1F1F1A] italic leading-relaxed font-bold text-left">
                            &quot;{selectedBooking.special_requests}&quot;
                          </p>
                        </div>
                      )}

                      {/* Linked event navigation */}
                      {selectedBooking.event_id && (
                        <Link
                          href={`/event-bookings/event/${selectedBooking.event_id}`}
                          className="flex items-center justify-between gap-3 bg-white border-2 border-[#E6DFC8] rounded-3xl px-5 py-4 hover:bg-[#F7F4EA] transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CalendarDays className="w-4 h-4 text-[#5C4033] shrink-0" />
                            <span className="text-xs font-black uppercase tracking-wide text-[#5C4033]">Manage Event</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-[#5F624F] group-hover:text-[#5C4033] transition-colors shrink-0" />
                        </Link>
                      )}
                    </div>
                  )}
                  <div className="h-32" />
                </div>

                {/* Sticky footer actions */}
                <div className="shrink-0 p-6 pt-4 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md pb-12 shadow-[0_-15px_40px_rgba(0,0,0,0.05)] z-40">
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={handleSaveDetails}
                        disabled={isPending}
                        className="h-14 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-transform"
                      >
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save</>}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white shadow-sm"
                      >
                        Discard
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="ghost"
                        title="Delete Record"
                        disabled={isPending}
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5C4033] font-black uppercase tracking-widest text-[10px] bg-white"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({ title: "Delete booking", description: "Permanently delete this booking? This cannot be undone.", confirmLabel: "Delete", variant: "destructive" });
                          if (ok) handleDeleteBooking(selectedBooking.id);
                        }}
                      >
                        <><Trash2 className="w-4 h-4 mr-2" />Delete</>
                      </Button>
                      <Button
                        variant="outline"
                        title="Edit Details"
                        onClick={handleEnterEditMode}
                        className="h-14 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95"
                      >
                        <><Pencil className="w-4 h-4 mr-2" />Edit</>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Global transition overlay */}
      {isPending && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-100 bg-[#5C4033] text-white px-6 py-3.5 rounded-full text-[11px] font-black uppercase tracking-wide shadow-2xl flex items-center gap-3 border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Loader2 className="w-4 h-4 animate-spin" /> Syncing with DB...
        </div>
      )}
      {ConfirmDialogUI}
    </div>
  );
}

function BookingCard({ booking, onClick, showDate }: { booking: GeneralBooking; onClick: () => void; showDate?: boolean }) {
  const status = normStatus(booking.status) || "pending";
  const theme = statusTheme[status] || statusTheme.pending;
  const tableName = booking.booking_table_mappings?.[0]?.tables?.tables_name || "--";
  const capacity = booking.booking_table_mappings?.[0]?.tables?.tables_capacity || "-";
  const eventDate = parseDate(booking.events?.event_date);
  const seatingRequired = booking.events?.seating_required !== false;

  return (
    <div
      onClick={onClick}
      className="group active:scale-[0.98] active:bg-[#F7F4EA] transition-all border-2 border-[#E6DFC8] rounded-2xl p-3 flex items-center justify-between cursor-pointer bg-white shadow-sm gap-3"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
        <div className={cn("w-11 h-11 rounded-full flex flex-col items-center justify-center shrink-0 border", theme.bg, theme.text, theme.border)}>
          {showDate && eventDate ? (
            <div className="flex flex-col leading-none items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-tighter opacity-80 mb-0.5">{format(eventDate, "MMM")}</span>
              <span className="text-base font-black tracking-tighter">{format(eventDate, "dd")}</span>
            </div>
          ) : (
            theme.icon
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
            {seatingRequired && (
              <span className="shrink-0 text-[11px] font-black text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 ml-2">T: {tableName}</span>
            )}
          </div>
          <div className="flex items-center justify-between text-[#5F624F] mt-1">
            <p className="text-xs truncate font-semibold">{booking.contacts?.full_name}</p>
            <div className="flex items-center gap-1.5 text-[#1F1F1A]">
              <Users className="w-3.5 h-3.5 text-[#5F624F]/50" />
              <span className="text-sm font-black">{booking.group_size}</span>
              {seatingRequired && <span className="text-sm font-black">/ {capacity}</span>}
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
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      <span className={cn(
        "text-sm font-black text-right flex-1 leading-snug",
        label === "Booked On" ? "text-[#5F624F]" : "text-[#1F1F1A]",
        label === "Pay Status" && "capitalize",
      )}>
        {value}
      </span>
    </div>
  );
}
