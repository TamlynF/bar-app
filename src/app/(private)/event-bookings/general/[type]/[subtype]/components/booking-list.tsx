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
  Coins,
  ExternalLink,
  List,
  Loader2,
  Mail,
  MessageSquareQuote,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  Star,
  Table as TableIcon,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { statusTheme } from "@/lib/booking-status-theme";
import { useMediaQuery } from "@/hooks/use-media-query";
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

const normStatus = (s?: string | null) => (s || "").trim().toLowerCase();

// Date strings come from the DB as YYYY-MM-DD — anchor to local midnight to
// avoid timezone shifts (see CLAUDE.md).
const parseDate = (d?: string | null) => (d ? new Date(d + "T00:00:00") : null);

const initials = (name?: string | null) =>
  (name || "?")
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// The master–detail two-pane kicks in here; below this the detail opens as a
// bottom sheet. Keep in sync with the `xl:` grid class on the layout.
const WIDE_QUERY = "(min-width: 1280px)";

export default function BookingList({
  bookings,
  showDate = true,
  type,
  subtype,
}: {
  bookings: GeneralBooking[];
  showDate?: boolean;
  type: string;
  subtype: string;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const isWide = useMediaQuery(WIDE_QUERY);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // Derive the selected booking from the (possibly refreshed) list so it always
  // reflects the latest server data without a sync effect — and resolves to null
  // once a booking is deleted.
  const selectedBooking = selectedId ? bookings.find(b => b.id === selectedId) ?? null : null;
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

  // Reset the overlay sheet scroll whenever a booking opens (bottom-sheet only).
  useEffect(() => {
    if (selectedId && !isWide) {
      const timer = setTimeout(() => {
        topFocusRef.current?.focus();
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedId, isWide]);

  const handleSelectBooking = (booking: GeneralBooking) => {
    setSelectedId(booking.id);
    setIsEditing(false);
  };

  const closeSheet = () => {
    setSelectedId(null);
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
  const showTableConfirmedHint =
    selectedBooking?.events?.seating_required !== false && originalTableId === "" && editForm.table_id !== "" && editForm.status === "confirmed";
  const showTableCancelledHint =
    selectedBooking?.events?.seating_required !== false && originalTableId !== "" && editForm.table_id === "" && editForm.status === "cancelled";
  const showStatusTableUnassignedHint =
    selectedBooking?.events?.seating_required !== false && originalStatus === "confirmed" && editForm.status !== "confirmed" && editForm.table_id === "";
  const showEventMoveHint =
    selectedBooking?.events?.seating_required !== false && originalEventId !== editForm.event_id;

  /**
   * The view/edit/delete surface, rendered either inline (desktop right pane)
   * or inside the bottom sheet (mobile). Returns plain JSX (not a component) so
   * the edit-form inputs keep their identity across re-renders.
   */
  const renderPanel = (placement: "inline" | "bottom") => {
    const isOverlay = placement === "bottom";

    if (!selectedBooking) {
      if (placement !== "inline") return null;
      return (
        <div className="h-full flex flex-col items-center justify-center text-center px-10 bg-white">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5 bg-[#F7F4EA] text-[#5F624F]">
            <List className="w-7 h-7" />
          </div>
          <p className="text-base font-black uppercase tracking-tight text-[#1F1F1A]">No booking selected</p>
          <p className="text-sm mt-1.5 max-w-60 text-[#5F624F]">
            Pick a team from the list to see and edit its details here.
          </p>
        </div>
      );
    }

    const status = normStatus(selectedBooking.status) || "pending";
    const theme = statusTheme[status] || statusTheme.pending;
    const eventDate = parseDate(selectedBooking.events?.event_date);
    const tableName = selectedBooking.booking_table_mappings?.[0]?.tables?.tables_name || "Unassigned";
    const hasTable = !!selectedBooking.booking_table_mappings?.[0]?.tables;
    const hasPayment = selectedBooking.paid_amount != null || selectedBooking.total_amount != null;
    const seatingRequired = selectedBooking.events?.seating_required !== false;

    const header = (
      <div className="shrink-0">
        <div className={cn("h-1.5 w-full", theme.dot)} />
        <div className="px-5 sm:px-6 pt-4 pb-3.5 flex items-start justify-between gap-3 bg-white/90 backdrop-blur-md border-b border-[#E6DFC8]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F624F]">
              {isEditing ? "Editing" : "Booking"} · Ref {selectedBooking.id}
            </p>
            {isOverlay ? (
              <SheetTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight truncate mt-0.5 text-[#1F1F1A]">
                {selectedBooking.group_name || "Guest Team"}
              </SheetTitle>
            ) : (
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight truncate mt-0.5 text-[#1F1F1A]">
                {selectedBooking.group_name || "Guest Team"}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing && (
              <span
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border",
                  theme.bg,
                  theme.text,
                  theme.border,
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", theme.dot)} />
                {status}
              </span>
            )}
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close panel"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F7F4EA] text-[#5F624F] hover:bg-[#E6DFC8] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );

    const viewBody = (
      <div className="space-y-5 animate-in fade-in duration-300">
        {/* Key facts grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <Fact icon={<Calendar className="w-4 h-4" />} label="Event date" value={eventDate ? format(eventDate, "do MMM yyyy") : "—"} />
          <Fact icon={<Users className="w-4 h-4" />} label="Group size" value={`${selectedBooking.group_size ?? 0} guests`} />
          {seatingRequired && (
            <Fact icon={<TableIcon className="w-4 h-4" />} label="Table" value={tableName} accent={!hasTable} />
          )}
          <Fact
            icon={<Clock3 className="w-4 h-4" />}
            label="Booked on"
            value={selectedBooking.booking_created_at ? format(new Date(selectedBooking.booking_created_at), "dd MMM yyyy · HH:mm") : "—"}
            small
          />
        </div>

        {/* Payment strip */}
        {hasPayment && (
          <div className="rounded-2xl p-4 flex items-center justify-between bg-[#F7F4EA] border border-[#E6DFC8]">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-white text-[#5C4033]">
                <Coins className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">Payment</p>
                <p className="text-sm font-black tabular-nums text-[#1F1F1A]">
                  £{(selectedBooking.paid_amount ?? 0).toFixed(2)}{" "}
                  <span className="text-[#5F624F]">/ £{(selectedBooking.total_amount ?? 0).toFixed(2)}</span>
                </p>
              </div>
            </div>
            {selectedBooking.payment_status && <PayBadge status={selectedBooking.payment_status} />}
          </div>
        )}

        {/* Primary contact */}
        {selectedBooking.contacts && (
          <section>
            <SectionLabel>Primary contact</SectionLabel>
            <div className="rounded-2xl p-4 flex items-center gap-3.5 bg-white border border-[#E6DFC8]">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shrink-0 bg-[#F7F4EA] text-[#5C4033] border border-[#E6DFC8]">
                {initials(selectedBooking.contacts.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black uppercase tracking-tight truncate text-[#1F1F1A]">{selectedBooking.contacts.full_name}</p>
                {selectedBooking.contacts.email && (
                  <p className="text-xs font-semibold truncate text-[#5F624F]">{selectedBooking.contacts.email}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {selectedBooking.contacts.email && (
                  <Link
                    href={`mailto:${selectedBooking.contacts.email}`}
                    aria-label="Email contact"
                    title="Email"
                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#5C4033]/7 text-[#5C4033] hover:bg-[#5C4033] hover:text-white transition-all active:scale-95"
                  >
                    <Mail className="w-4 h-4" />
                  </Link>
                )}
                {selectedBooking.contacts.phone_no && (
                  <Link
                    href={`tel:${selectedBooking.contacts.country_code ?? ""}${selectedBooking.contacts.phone_no}`}
                    aria-label="Call contact"
                    title="Call"
                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#5C4033]/7 text-[#5C4033] hover:bg-[#5C4033] hover:text-white transition-all active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Staff instructions */}
        {selectedBooking.special_requests && (
          <div className="rounded-2xl p-4 bg-[#5C4033]/5 border border-[#5C4033]/15">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquareQuote className="w-4 h-4 text-[#5C4033]" />
              <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">Staff instructions</span>
            </div>
            <p className="text-sm font-bold italic leading-relaxed text-[#1F1F1A]">&ldquo;{selectedBooking.special_requests}&rdquo;</p>
          </div>
        )}

        {/* Manage event */}
        {selectedBooking.event_id && (
          <Link
            href={`/event-bookings/event/${selectedBooking.event_id}`}
            className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 bg-white border border-[#E6DFC8] hover:bg-[#F7F4EA] transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <CalendarDays className="w-4 h-4 text-[#5C4033]" />
              <span className="text-xs font-black uppercase tracking-wide text-[#5C4033]">Manage event</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-[#5F624F]" />
          </Link>
        )}
      </div>
    );

    const editBody = (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Event */}
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Event Date &amp; Session</Label>
          <div className="relative">
            <select
              title="Select Event"
              value={editForm.event_id}
              onChange={e => handleEventChange(e.target.value)}
              className="w-full h-12 rounded-xl border-[1.5px] border-[#E6DFC8] bg-white px-3.5 text-sm font-bold appearance-none outline-none focus:border-[#5C4033] transition-colors"
            >
              {availableEvents.map(e => (
                <option key={e.id} value={e.id}>
                  {format(parseDate(e.date)!, "dd MMM yyyy")} - {e.title || "Untitled Event"}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F] pointer-events-none" />
          </div>
          {showEventMoveHint && (
            <Hint tone="blue" icon={<CalendarDays className="w-3.5 h-3.5" />}>Moving event. Table assignment has been reset.</Hint>
          )}
        </div>

        {/* Group name */}
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Group Name</Label>
          <Input
            aria-label="Group Name"
            value={editForm.group_name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({ ...prev, group_name: e.target.value }))}
            className="h-12 rounded-xl border-[1.5px] border-[#E6DFC8] bg-white text-base font-bold px-3.5 focus:border-[#5C4033]"
          />
        </div>

        {/* Group size + Table */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Group Size</Label>
            <Input
              aria-label="Group Size"
              type="number"
              min={1}
              value={editForm.group_size || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleGroupSizeChange(Number(e.target.value) || 0)}
              className="h-12 rounded-xl border-[1.5px] border-[#E6DFC8] bg-white text-base font-bold px-3.5 focus:border-[#5C4033]"
            />
          </div>
          {seatingRequired && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">Table</Label>
              <div className="relative">
                <select
                  title="Select Table"
                  value={editForm.table_id}
                  onChange={e => handleTableChange(e.target.value)}
                  className={cn(
                    "w-full h-12 rounded-xl px-3.5 pr-9 text-sm font-bold appearance-none outline-none transition-colors",
                    editForm.table_id ? "bg-white border-[1.5px] border-[#E6DFC8] focus:border-[#5C4033]" : "bg-[#F7F4EA] border-[1.5px] border-dashed border-[#E6DFC8]",
                  )}
                >
                  <option value="">Unassigned</option>
                  {availableTables.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (seats {t.max_capacity})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F] pointer-events-none" />
              </div>
            </div>
          )}
        </div>
        {showTableConfirmedHint && (
          <Hint tone="green" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>Table selected. Status will update to Confirmed.</Hint>
        )}
        {showTableCancelledHint && (
          <Hint tone="red" icon={<AlertCircle className="w-3.5 h-3.5" />}>Table removed. Status will update to Cancelled.</Hint>
        )}

        {/* Status */}
        <div>
          <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1 mb-2 block">Status</Label>
          <div className="grid grid-cols-2 gap-2">
            {["confirmed", "waitlisted", "pending", "cancelled"].map(s => {
              const st = statusTheme[s];
              const active = editForm.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChangeInEdit(s)}
                  className={cn(
                    "flex items-center gap-2 h-12 rounded-xl px-3 font-black uppercase tracking-wide text-[11px] transition-all border-2",
                    active ? cn(st.bg, st.text, st.cardBorder) : "bg-white text-[#5F624F] border-[#E6DFC8]",
                  )}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full", st.dot)} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              );
            })}
          </div>
          {showStatusTableUnassignedHint && (
            <div className="mt-2">
              <Hint tone="amber" icon={<RefreshCw className="w-3.5 h-3.5" />}>Status changed. Table assignment will be cleared.</Hint>
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
            placeholder="Dietary needs, table preference, occasion…"
            className="min-h-28 rounded-xl border-[1.5px] border-[#E6DFC8] bg-white text-sm font-medium p-3.5 focus:border-[#5C4033] resize-none"
          />
        </div>
      </div>
    );

    const footer = (
      <div className="shrink-0 px-5 sm:px-6 py-4 bg-white/90 backdrop-blur-md border-t border-[#E6DFC8] shadow-[0_-10px_30px_rgba(0,0,0,0.04)]">
        {isEditing ? (
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsEditing(false)}
              className="h-12 rounded-xl font-black uppercase tracking-wide text-[11px] px-5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDetails}
              disabled={isPending}
              className="h-12 rounded-xl bg-[#1B4332] text-white font-black uppercase tracking-widest text-xs"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Save className="w-4 h-4 mr-2" /> Save</>)}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete booking",
                  description: "Permanently delete this booking? This cannot be undone.",
                  confirmLabel: "Delete",
                  variant: "destructive",
                });
                if (ok) handleDeleteBooking(selectedBooking.id);
              }}
              className="h-12 rounded-xl font-black uppercase tracking-wide text-[11px] px-5 text-[#5C4033] hover:bg-red-50! hover:text-red-600!"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete
            </Button>
            <Button
              onClick={handleEnterEditMode}
              className="h-12 rounded-xl bg-[#B45309] text-white font-black uppercase tracking-widest text-xs"
            >
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </Button>
          </div>
        )}
      </div>
    );

    return (
      <div className="flex flex-col h-full overflow-hidden bg-white">
        {isOverlay && <span ref={topFocusRef} tabIndex={-1} className="sr-only" />}
        {header}
        <div ref={isOverlay ? scrollContainerRef : undefined} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 bg-[#F7F4EA] min-h-0 overscroll-contain">
          {isEditing ? editBody : viewBody}
          <div className="h-2" />
        </div>
        {footer}
      </div>
    );
  };

  const listItems = (
    <div className="space-y-2.5">
      {bookings.length === 0 ? (
        <EmptyList />
      ) : (
        bookings.map(b => (
          <RefinedCard
            key={b.id}
            booking={b}
            showDate={showDate}
            selected={selectedBooking?.id === b.id}
            onClick={() => handleSelectBooking(b)}
          />
        ))
      )}
    </div>
  );

  return (
    <div>
      {isWide ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          {listItems}
          <aside
            className="sticky top-4 self-start rounded-3xl overflow-hidden border border-[#E6DFC8] shadow-lg h-[calc(100vh-7rem)] min-h-135"
          >
            {renderPanel("inline")}
          </aside>
        </div>
      ) : (
        <>
          {listItems}
          <Sheet open={!!selectedBooking} onOpenChange={open => { if (!open) closeSheet(); }}>
            <SheetContent
              side="bottom"
              onOpenAutoFocus={e => e.preventDefault()}
              className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[88vh] flex flex-col outline-none shadow-2xl"
            >
              {renderPanel("bottom")}
            </SheetContent>
          </Sheet>
        </>
      )}

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

// ---- List card ------------------------------------------------------------
function RefinedCard({
  booking,
  onClick,
  selected,
  showDate,
}: {
  booking: GeneralBooking;
  onClick: () => void;
  selected: boolean;
  showDate?: boolean;
}) {
  const status = normStatus(booking.status) || "pending";
  const theme = statusTheme[status] || statusTheme.pending;
  const table = booking.booking_table_mappings?.[0]?.tables;
  const capacity = table?.tables_capacity;
  const eventDate = parseDate(booking.events?.event_date);
  const seatingRequired = booking.events?.seating_required !== false;
  const StatusIcon = theme.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl p-3 flex items-center gap-3 bg-white transition-all active:scale-[0.99]",
        selected ? "border-2 border-[#5C4033] shadow-lg" : "border border-[#E6DFC8] shadow-sm",
      )}
    >
      <div className={cn("w-1 self-stretch rounded-full shrink-0", theme.dot)} />
      <div className={cn("w-11 h-11 rounded-full flex items-center justify-center shrink-0 border", theme.bg, theme.text, theme.border)}>
        {showDate && eventDate ? (
          <div className="flex flex-col leading-none items-center justify-center">
            <span className="text-[9px] font-black uppercase tracking-tighter opacity-80">{format(eventDate, "MMM")}</span>
            <span className="text-base font-black tracking-tighter">{format(eventDate, "dd")}</span>
          </div>
        ) : (
          <StatusIcon className="w-5 h-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-sm font-black uppercase tracking-tight truncate text-[#1F1F1A]">{booking.group_name || "Guest Team"}</h4>
          {booking.special_requests && (
            <span title="Has staff instructions" className="inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 bg-amber-50 text-amber-700">
              <Star className="w-3 h-3 fill-current" />
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className="text-xs font-semibold truncate text-[#5F624F]">{booking.contacts?.full_name}</span>
          <div className="flex items-center gap-2 shrink-0">
            {seatingRequired && <TableChip name={table?.tables_name} />}
            <span className="inline-flex items-center gap-1 text-sm font-black tabular-nums text-[#1F1F1A]">
              <Users className="w-3.5 h-3.5 text-[#5F624F]/55" />
              {booking.group_size}
              {seatingRequired && capacity ? <span className="text-[#5F624F]/70">/{capacity}</span> : null}
            </span>
          </div>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 text-[#5F624F]/50" />
    </button>
  );
}

function TableChip({ name }: { name?: string | null }) {
  if (!name) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-[#F7F4EA] text-[#5F624F] border border-dashed border-[#E6DFC8]">
        <TableIcon className="w-3 h-3" /> No table
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-[#5C4033]/7 text-[#5C4033]">
      <TableIcon className="w-3 h-3" /> {name.replace("Table ", "T")}
    </span>
  );
}

function EmptyList() {
  return (
    <div className="rounded-2xl p-10 text-center bg-white border border-[#E6DFC8]">
      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-[#F7F4EA] text-[#5F624F]">
        <CalendarDays className="w-5 h-5" />
      </div>
      <p className="text-sm font-black uppercase tracking-tight text-[#1F1F1A]">No bookings match</p>
      <p className="text-xs mt-1 text-[#5F624F]">Try clearing a filter or the search.</p>
    </div>
  );
}

// ---- Detail building blocks ----------------------------------------------
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-[#5F624F]/70">{children}</p>;
}

function Fact({ icon, label, value, small, accent }: { icon: React.ReactNode; label: string; value: string; small?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-2xl p-3.5 bg-white border border-[#E6DFC8]">
      <div className="flex items-center gap-1.5 mb-1.5 text-[#5F624F]">
        <span className="opacity-70">{icon}</span>
        <span className="text-[9.5px] font-black uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("font-black leading-tight", small ? "text-xs" : "text-sm", accent ? "text-[#C8956D]" : "text-[#1F1F1A]")}>{value}</p>
    </div>
  );
}

function PayBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Paid: "bg-green-50 text-green-700",
    "Part-paid": "bg-amber-50 text-amber-700",
    Unpaid: "bg-[#F7F4EA] text-[#5F624F]",
    Refunded: "bg-red-50 text-red-700",
  };
  const cls = map[status] || "bg-[#F7F4EA] text-[#5F624F]";
  return <span className={cn("px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide", cls)}>{status}</span>;
}

function Hint({ tone, icon, children }: { tone: "blue" | "green" | "red" | "amber"; icon: React.ReactNode; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={cn("flex items-center gap-2 p-3 rounded-xl border animate-in fade-in slide-in-from-top-1", tones[tone])}>
      {icon}
      <p className="text-[10px] font-black uppercase tracking-tight">{children}</p>
    </div>
  );
}
