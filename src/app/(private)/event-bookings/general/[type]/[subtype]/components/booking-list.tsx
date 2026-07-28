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
  event_start_time?: string | null;
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

const parseDate = (d?: string | null) => (d ? new Date(d + "T00:00:00") : null);

const formatTime = (t?: string | null) => {
  if (!t) return null;
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  if (Number.isNaN(h)) return null;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
};

const initials = (name?: string | null) =>
  (name || "?")
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const WIDE_QUERY = "(min-width: 1280px)";

export default function BookingList({
  bookings,
  showDate = true,
  type,
  subtype,
  initialSelectedId = null,
}: {
  bookings: GeneralBooking[];
  showDate?: boolean;
  type: string;
  subtype: string;
  initialSelectedId?: string | null;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const isWide = useMediaQuery(WIDE_QUERY);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (!initialSelectedId) return null;
    const match = bookings.find(b => String(b.id) === String(initialSelectedId));
    return match ? match.id : null;
  });
  const [isEditing, setIsEditing] = useState(false);
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
    guardedClose(() => {
      setSelectedId(booking.id);
      setIsEditing(false);
    });
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

    const events = await getEventsForType(type, subtype);
    setAvailableEvents(events as unknown as SelectableEvent[]);
  };

  const handleEventChange = async (newEventId: string) => {
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

  const isDirty = () => {
    if (!selectedBooking) return false;
    const currentTableId = selectedBooking.booking_table_mappings?.[0]?.tables?.tables_id || "";
    return (
      editForm.group_name !== (selectedBooking.group_name || "") ||
      editForm.group_size !== (Number(selectedBooking.group_size) || 0) ||
      editForm.special_requests !== (selectedBooking.special_requests || "") ||
      editForm.table_id !== currentTableId ||
      editForm.status !== (normStatus(selectedBooking.status) || "pending") ||
      editForm.event_id !== String(selectedBooking.event_id ?? "")
    );
  };

  const persistEdits = async (): Promise<boolean> => {
    if (!selectedBooking) return true;

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
      if (!ok) return false;
    }

    const bookingId = selectedBooking.id;
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          await updateGeneralBookingDetails(bookingId, editForm);
          toast.success("Booking updated successfully");
          router.refresh();
          resolve(true);
        } catch (error) {
          console.error(error);
          toast.error(error instanceof Error ? error.message : "Failed to save changes");
          resolve(false);
        }
      });
    });
  };

  const guardedClose = async (proceed: () => void) => {
    if (isEditing && isDirty()) {
      const save = await confirm({
        title: "Save changes?",
        description: "You've made changes to this booking. Save them before closing?",
        confirmLabel: "Save changes",
        cancelLabel: "Discard",
        dismissible: false,
      });
      if (save) {
        const ok = await persistEdits();
        if (!ok) return; // save failed or was backed out of — stay in the editor
      }
    }
    proceed();
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

  const renderPanel = (placement: "inline" | "bottom") => {
    const isOverlay = placement === "bottom";

    if (!selectedBooking) {
      if (placement !== "inline") return null;
      return (
        <div className="flex h-full flex-col items-center justify-center bg-[#ECE4CE] px-10 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F7F4EA] text-[#5F624F]">
            <List className="h-7 w-7" />
          </div>
          <p className="font-black text-base tracking-tight text-[#1F1F1A] uppercase">No booking selected</p>
          <p className="mt-1.5 max-w-60 text-sm text-[#5F624F]">
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
        <div className="flex items-start justify-between gap-3 border-b border-[#E6DFC8] bg-white/90 px-5 pt-4 pb-3.5 backdrop-blur-md sm:px-6">
          <div className="min-w-0">
            <p className="font-black text-[10px] tracking-[0.18em] text-[#5F624F] uppercase">
              {isEditing ? "Editing" : "Booking"} · Ref {selectedBooking.id}
            </p>
            {isOverlay ? (
              <SheetTitle className="mt-0.5 truncate font-black text-xl leading-tight tracking-tight text-[#1F1F1A] uppercase sm:text-2xl">
                {selectedBooking.group_name || "Guest Team"}
              </SheetTitle>
            ) : (
              <h2 className="mt-0.5 truncate font-black text-xl leading-tight tracking-tight text-[#1F1F1A] uppercase sm:text-2xl">
                {selectedBooking.group_name || "Guest Team"}
              </h2>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isEditing && (
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-black text-[11px] tracking-wider uppercase",
                  theme.bg,
                  theme.text,
                  theme.border,
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
                {status}
              </span>
            )}
            <button
              type="button"
              onClick={() => guardedClose(closeSheet)}
              aria-label="Close panel"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F7F4EA] text-[#5F624F] transition-colors hover:bg-[#E6DFC8]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );

    const viewBody = (
      <div className="animate-in space-y-5 duration-300 fade-in">
        <div className="grid grid-cols-2 gap-2.5">
          <Fact icon={<Calendar className="h-4 w-4" />} label="Event date" value={eventDate ? format(eventDate, "do MMM yyyy") : "—"} />
          <Fact icon={<Users className="h-4 w-4" />} label="Group size" value={`${selectedBooking.group_size ?? 0} guests`} />
          {seatingRequired && (
            <Fact icon={<TableIcon className="h-4 w-4" />} label="Table" value={tableName} accent={!hasTable} />
          )}
          <Fact
            icon={<Clock3 className="h-4 w-4" />}
            label="Booked on"
            value={selectedBooking.booking_created_at ? format(new Date(selectedBooking.booking_created_at), "dd MMM yyyy · HH:mm") : "—"}
            small
          />
        </div>

        {hasPayment && (
          <div className="flex items-center justify-between rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#5C4033]">
                <Coins className="h-4 w-4" />
              </span>
              <div>
                <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Payment</p>
                <p className="font-black text-sm text-[#1F1F1A] tabular-nums">
                  £{(selectedBooking.paid_amount ?? 0).toFixed(2)}{" "}
                  <span className="text-[#5F624F]">/ £{(selectedBooking.total_amount ?? 0).toFixed(2)}</span>
                </p>
              </div>
            </div>
            {selectedBooking.payment_status && <PayBadge status={selectedBooking.payment_status} />}
          </div>
        )}

        {selectedBooking.contacts && (
          <section>
            <SectionLabel>Primary contact</SectionLabel>
            <div className="flex items-center gap-3.5 rounded-2xl border border-[#E6DFC8] bg-white p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] font-black text-base text-[#5C4033]">
                {initials(selectedBooking.contacts.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-sm tracking-tight text-[#1F1F1A] uppercase">{selectedBooking.contacts.full_name}</p>
                {selectedBooking.contacts.email && (
                  <p className="truncate text-xs font-semibold text-[#5F624F]">{selectedBooking.contacts.email}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {selectedBooking.contacts.email && (
                  <Link
                    href={`mailto:${selectedBooking.contacts.email}`}
                    aria-label="Email contact"
                    title="Email"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5C4033]/7 text-[#5C4033] transition-all hover:bg-[#5C4033] hover:text-white active:scale-95"
                  >
                    <Mail className="h-4 w-4" />
                  </Link>
                )}
                {selectedBooking.contacts.phone_no && (
                  <Link
                    href={`tel:${selectedBooking.contacts.country_code ?? ""}${selectedBooking.contacts.phone_no}`}
                    aria-label="Call contact"
                    title="Call"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5C4033]/7 text-[#5C4033] transition-all hover:bg-[#5C4033] hover:text-white active:scale-95"
                  >
                    <Phone className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {selectedBooking.special_requests && (
          <div className="rounded-2xl border border-[#5C4033]/15 bg-[#5C4033]/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquareQuote className="h-4 w-4 text-[#5C4033]" />
              <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">Staff instructions</span>
            </div>
            <p className="text-sm leading-relaxed font-bold text-[#1F1F1A] italic">&ldquo;{selectedBooking.special_requests}&rdquo;</p>
          </div>
        )}

        {selectedBooking.event_id && (
          <Link
            href={`/event-bookings/event/${selectedBooking.event_id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#E6DFC8] bg-white px-4 py-3.5 transition-colors hover:bg-[#F7F4EA]"
          >
            <span className="flex items-center gap-2.5">
              <CalendarDays className="h-4 w-4 text-[#5C4033]" />
              <span className="font-black text-xs tracking-wide text-[#5C4033] uppercase">Manage event</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-[#5F624F]" />
          </Link>
        )}
      </div>
    );

    const editBody = (
      <div className="animate-in space-y-5 duration-300 fade-in slide-in-from-bottom-2">
        <div className="space-y-2">
          <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Event Date &amp; Session</Label>
          <div className="relative">
            <select
              title="Select Event"
              value={editForm.event_id}
              onChange={e => handleEventChange(e.target.value)}
              className="h-12 w-full appearance-none rounded-xl border-[1.5px] border-[#E6DFC8] bg-white px-3.5 text-sm font-bold transition-colors outline-none focus:border-[#5C4033]"
            >
              {availableEvents.map(e => (
                <option key={e.id} value={e.id}>
                  {format(parseDate(e.date)!, "dd MMM yyyy")} - {e.title || "Untitled Event"}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#5F624F]" />
          </div>
          {showEventMoveHint && (
            <Hint tone="blue" icon={<CalendarDays className="h-3.5 w-3.5" />}>Moving event. Table assignment has been reset.</Hint>
          )}
        </div>

        <div className="space-y-2">
          <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Group Name</Label>
          <Input
            aria-label="Group Name"
            value={editForm.group_name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({ ...prev, group_name: e.target.value }))}
            className="h-12 rounded-xl border-[1.5px] border-[#E6DFC8] bg-white px-3.5 text-base font-bold focus:border-[#5C4033]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Group Size</Label>
            <Input
              aria-label="Group Size"
              type="number"
              min={1}
              value={editForm.group_size || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleGroupSizeChange(Number(e.target.value) || 0)}
              className="h-12 rounded-xl border-[1.5px] border-[#E6DFC8] bg-white px-3.5 text-base font-bold focus:border-[#5C4033]"
            />
          </div>
          {seatingRequired && (
            <div className="space-y-2">
              <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Table</Label>
              <div className="relative">
                <select
                  title="Select Table"
                  value={editForm.table_id}
                  onChange={e => handleTableChange(e.target.value)}
                  className={cn(
                    "h-12 w-full appearance-none rounded-xl px-3.5 pr-9 text-sm font-bold transition-colors outline-none",
                    editForm.table_id ? "border-[1.5px] border-[#E6DFC8] bg-white focus:border-[#5C4033]" : "border-[1.5px] border-dashed border-[#E6DFC8] bg-[#F7F4EA]",
                  )}
                >
                  <option value="">Unassigned</option>
                  {availableTables.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (seats {t.max_capacity})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#5F624F]" />
              </div>
            </div>
          )}
        </div>
        {showTableConfirmedHint && (
          <Hint tone="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Table selected. Status will update to Confirmed.</Hint>
        )}
        {showTableCancelledHint && (
          <Hint tone="red" icon={<AlertCircle className="h-3.5 w-3.5" />}>Table removed. Status will update to Cancelled.</Hint>
        )}

        <div>
          <Label className="mb-2 ml-1 block font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Status</Label>
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
                    "flex h-12 items-center gap-2 rounded-xl border-2 px-3 font-black text-[11px] tracking-wide uppercase transition-all",
                    active ? cn(st.bg, st.text, st.cardBorder) : "border-[#E6DFC8] bg-white text-[#5F624F]",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", st.dot)} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              );
            })}
          </div>
          {showStatusTableUnassignedHint && (
            <div className="mt-2">
              <Hint tone="amber" icon={<RefreshCw className="h-3.5 w-3.5" />}>Status changed. Table assignment will be cleared.</Hint>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Special Requests</Label>
          <Textarea
            aria-label="Special Requests"
            value={editForm.special_requests}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => ({ ...prev, special_requests: e.target.value }))}
            placeholder="Dietary needs, table preference, occasion…"
            className="min-h-28 resize-none rounded-xl border-[1.5px] border-[#E6DFC8] bg-white p-3.5 text-sm font-medium focus:border-[#5C4033]"
          />
        </div>
      </div>
    );

    const footer = isEditing ? null : (
      <div className="shrink-0 border-t border-[#E6DFC8] bg-white/90 px-5 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.04)] backdrop-blur-md sm:px-6">
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
            className="h-12 rounded-xl px-5 font-black text-[11px] tracking-wide text-[#5C4033] uppercase hover:bg-red-50! hover:text-red-600!"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
          <Button
            onClick={handleEnterEditMode}
            className="h-12 rounded-xl bg-[#B45309] font-black text-xs tracking-widest text-white uppercase hover:bg-[#B45309]/85"
          >
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        </div>
      </div>
    );

    return (
      <div className="flex h-full flex-col overflow-hidden bg-[#ECE4CE]">
        {isOverlay && <span ref={topFocusRef} tabIndex={-1} className="sr-only" />}
        {header}
        <div ref={isOverlay ? scrollContainerRef : undefined} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#ECE4CE] px-5 py-5 sm:px-6">
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
    <div className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      {isWide ? (
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="h-full min-h-0 overflow-y-auto pr-1">
            {listItems}
          </div>
          <aside
            className="h-full min-h-0 self-stretch overflow-hidden rounded-3xl border-2 border-[#5C4033]/15 shadow-xl"
          >
            {renderPanel("inline")}
          </aside>
        </div>
      ) : (
        <>
          {listItems}
          <Sheet open={!!selectedBooking} onOpenChange={open => { if (!open) guardedClose(closeSheet); }}>
            <SheetContent
              side="bottom"
              onOpenAutoFocus={e => e.preventDefault()}
              className="flex h-[88vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl outline-none"
            >
              {renderPanel("bottom")}
            </SheetContent>
          </Sheet>
        </>
      )}

      {isPending && (
        <div className="fixed bottom-10 left-1/2 z-100 flex -translate-x-1/2 animate-in items-center gap-3 rounded-full border border-white/10 bg-[#5C4033] px-6 py-3.5 font-black text-[11px] tracking-wide text-white uppercase shadow-2xl duration-300 fade-in slide-in-from-bottom-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Syncing with DB...
        </div>
      )}
      {ConfirmDialogUI}
    </div>
  );
}

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
  const eventTime = formatTime(booking.events?.event_start_time);
  const seatingRequired = booking.events?.seating_required !== false;
  const StatusIcon = theme.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all active:scale-[0.99]",
        selected
          ? "border-2 border-[#B45309] bg-[#B45309]/4 shadow-lg ring-2 ring-[#B45309]/20"
          : "border border-[#E6DFC8] bg-white shadow-sm",
      )}
    >
      <div className={cn("w-1 shrink-0 self-stretch rounded-full", theme.dot)} />
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border", theme.bg, theme.text, theme.border)}>
        {showDate && eventDate ? (
          <div className="flex flex-col items-center justify-center leading-none">
            <span className="font-black text-[9px] tracking-tighter uppercase opacity-80">{format(eventDate, "MMM")}</span>
            <span className="font-black text-base tracking-tighter">{format(eventDate, "dd")}</span>
          </div>
        ) : (
          <StatusIcon className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {showDate && (
          <div className="mb-1 hidden min-w-0 items-center gap-1.5 sm:flex">
            <CalendarDays className="h-3 w-3 shrink-0 text-[#5F624F]/55" />
            <span className="truncate font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
              {booking.events?.event_title || "Untitled Event"}
              {eventTime ? ` · ${eventTime}` : ""}
            </span>
          </div>
        )}
        <div className="flex min-w-0 items-center gap-1.5">
          <h4 className="truncate font-black text-sm tracking-tight text-[#1F1F1A] uppercase">{booking.group_name || "Guest Team"}</h4>
          {booking.special_requests && (
            <span title="Has staff instructions" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Star className="h-3 w-3 fill-current" />
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-[#5F624F]">{booking.contacts?.full_name}</span>
          <div className="flex shrink-0 items-center gap-2">
            {seatingRequired && <TableChip name={table?.tables_name} />}
            <span className="inline-flex items-center gap-1 font-black text-sm text-[#1F1F1A] tabular-nums">
              <Users className="h-3.5 w-3.5 text-[#5F624F]/55" />
              {booking.group_size}
              {seatingRequired && capacity ? <span className="text-[#5F624F]/70">/{capacity}</span> : null}
            </span>
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F]/50" />
    </button>
  );
}

function TableChip({ name }: { name?: string | null }) {
  if (!name) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#E6DFC8] bg-[#F7F4EA] px-2 py-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
        <TableIcon className="h-3 w-3" /> No table
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#5C4033]/7 px-2 py-0.5 font-black text-[10px] tracking-wide text-[#5C4033] uppercase">
      <TableIcon className="h-3 w-3" /> {name.replace("Table ", "T")}
    </span>
  );
}

function EmptyList() {
  return (
    <div className="rounded-2xl border border-[#E6DFC8] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F4EA] text-[#5F624F]">
        <CalendarDays className="h-5 w-5" />
      </div>
      <p className="font-black text-sm tracking-tight text-[#1F1F1A] uppercase">No bookings match</p>
      <p className="mt-1 text-xs text-[#5F624F]">Try clearing a filter or the search.</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 font-black text-[10px] tracking-[0.2em] text-[#5F624F]/70 uppercase">{children}</p>;
}

function Fact({ icon, label, value, small, accent }: { icon: React.ReactNode; label: string; value: string; small?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#E6DFC8] bg-white p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[#5F624F]">
        <span className="opacity-70">{icon}</span>
        <span className="font-black text-[9.5px] tracking-wide uppercase">{label}</span>
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
  return <span className={cn("rounded-full px-3 py-1.5 font-black text-[10px] tracking-wide uppercase", cls)}>{status}</span>;
}

function Hint({ tone, icon, children }: { tone: "blue" | "green" | "red" | "amber"; icon: React.ReactNode; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={cn("flex animate-in items-center gap-2 rounded-xl border p-3 fade-in slide-in-from-top-1", tones[tone])}>
      {icon}
      <p className="font-black text-[10px] tracking-tight uppercase">{children}</p>
    </div>
  );
}
