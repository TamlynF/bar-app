"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
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

export const STATUS_ORDER = ["confirmed", "waitlisted", "pending", "cancelled"] as const;

export const STATUS_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  confirmed: {
    label: "Confirmed",
    bg: "bg-[#E7F2E0]",
    text: "text-[#3B7A2A]",
    border: "border-[#BAD6A8]",
    dot: "bg-[#3B7A2A]",
  },
  waitlisted: {
    label: "Waitlisted",
    bg: "bg-[#FBF3DC]",
    text: "text-[#B07A16]",
    border: "border-[#E8D49A]",
    dot: "bg-[#B07A16]",
  },
  pending: {
    label: "Pending",
    bg: "bg-[#ECE9DE]",
    text: "text-[#5E6654]",
    border: "border-[#D8D5C8]",
    dot: "bg-[#5E6654]",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-[#F8E5E3]",
    text: "text-[#B33A32]",
    border: "border-[#EBC9C6]",
    dot: "bg-[#B33A32]",
  },
};

const FIELD_LABEL = "text-[11px] font-semibold text-[#5E6654]";
const PANEL = "overflow-hidden rounded-[14px] border border-[#C4C0B0] bg-white";
const PANEL_HEAD =
  "border-b border-[#C4C0B0] bg-[#ECE9DE] px-4 py-2.5 text-[13px] font-semibold text-[#5E6654]";
const FIELD =
  "h-10.5 w-full rounded-[11px] border-[1.5px] border-[#C9BB93] bg-white px-3 text-sm font-medium text-[#20231A] shadow-none focus-visible:border-[#34451F] focus-visible:ring-[3px] focus-visible:ring-[#D7A928]/30";
const ACTION =
  "inline-flex items-center justify-center gap-2 text-[13px] font-semibold transition-[filter,box-shadow] hover:brightness-[0.94] active:scale-[0.98]";

const normStatus = (s?: string | null) => (s || "").trim().toLowerCase();

const parseDate = (d?: string | null) => (d ? new Date(d + "T00:00:00") : null);

const initials = (name?: string | null) =>
  (name || "?")
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        style.bg,
        style.text,
        style.border,
      )}
    >
      <span className={cn("h-1.75 w-1.75 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3.5 border-b border-[#E3DCC6] px-4 py-2.5 last:border-b-0">
      <span className={cn(FIELD_LABEL, "w-22 shrink-0 sm:w-27.5")}>{label}</span>
      <span className="text-[13px] font-semibold text-[#20231A]">{children}</span>
    </div>
  );
}

function Hint({
  tone,
  icon,
  children,
}: {
  tone: "green" | "red" | "amber";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    green: "border-[#BAD6A8] bg-[#E7F2E0] text-[#2F6420]",
    red: "border-[#EBC9C6] bg-[#F8E5E3] text-[#B33A32]",
    amber: "border-[#E8D49A] bg-[#FBF3DC] text-[#8A5F0E]",
  };
  return (
    <div className={cn("flex items-center gap-2 rounded-[9px] border px-2.5 py-1.75 text-xs font-medium", tones[tone])}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

const hasPaymentFor = (booking: GeneralBooking) =>
  Number(booking.events?.event_payment_amount) > 0 || Number(booking.total_amount) > 0;

export default function BookingList({
  bookings,
  showEventColumn = false,
  seatingRequired = true,
  showPayment = true,
  initialSelectedId = null,
}: {
  bookings: GeneralBooking[];
  showEventColumn?: boolean;
  seatingRequired?: boolean;
  showPayment?: boolean;
  initialSelectedId?: string | null;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(() => {
    if (!initialSelectedId) return null;
    const match = bookings.find(b => String(b.id) === String(initialSelectedId));
    return match ? match.id : null;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [availableTables, setAvailableTables] = useState<SelectableTable[]>([]);
  const [editForm, setEditForm] = useState({
    group_name: "",
    group_size: 0,
    special_requests: "",
    table_id: "",
    status: "",
    event_id: "",
  });

  const openBooking = openId ? bookings.find(b => b.id === openId) ?? null : null;
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    if (!initialSelectedId) return;
    const row = rowRefs.current[initialSelectedId];
    if (row) row.scrollIntoView({ block: "center" });
  }, [initialSelectedId]);

  const columnCount =
    5 + (showEventColumn ? 1 : 0) + (seatingRequired ? 1 : 0) + (showPayment ? 1 : 0);

  const handleEnterEditMode = async () => {
    if (!openBooking) return;
    const currentTableId = openBooking.booking_table_mappings?.[0]?.tables?.tables_id;
    const currentEventId = String(openBooking.event_id ?? "");

    setEditForm({
      group_name: openBooking.group_name || "",
      group_size: Number(openBooking.group_size) || 0,
      special_requests: openBooking.special_requests || "",
      table_id: currentTableId || "",
      status: normStatus(openBooking.status) || "pending",
      event_id: currentEventId,
    });

    setIsEditing(true);

    if (openBooking.event_id) {
      const tables = await getAvailableTablesForEventGeneral(
        currentEventId,
        Number(openBooking.group_size) || 0,
        currentTableId,
      );
      setAvailableTables(tables as unknown as SelectableTable[]);
    }
  };

  const handleTableChange = (newTableId: string, forcedStatus?: string) => {
    const originalTableId = openBooking?.booking_table_mappings?.[0]?.tables?.tables_id || "";
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
    const wasConfirmed = (normStatus(openBooking?.status) || "pending") === "confirmed";
    let newTableId = editForm.table_id;
    if (wasConfirmed && newStatus !== "confirmed") newTableId = "";
    setEditForm(prev => ({ ...prev, status: newStatus, table_id: newTableId }));
  };

  const handleGroupSizeChange = async (size: number) => {
    setEditForm(prev => ({ ...prev, group_size: size }));

    if (!editForm.event_id) return;

    const tables = await getAvailableTablesForEventGeneral(
      editForm.event_id,
      size,
      openBooking?.booking_table_mappings?.[0]?.tables?.tables_id,
    );
    const newAvailableTables = tables as unknown as SelectableTable[];
    setAvailableTables(newAvailableTables);

    const currentTableId = editForm.table_id;
    if (currentTableId === "") return;

    const isCurrentTableValid = newAvailableTables.some(t => String(t.id) === String(currentTableId));
    if (isCurrentTableValid) return;

    if (newAvailableTables.length > 0) {
      handleTableChange(String(newAvailableTables[0].id));
      toast.info(`Group size updated. Table auto-reassigned to ${newAvailableTables[0].name}.`);
    } else {
      handleTableChange("", "waitlisted");
      toast.warning("No suitable tables available for this group size. Booking moved to waitlist.");
    }
  };

  const isDirty = () => {
    if (!openBooking) return false;
    const currentTableId = openBooking.booking_table_mappings?.[0]?.tables?.tables_id || "";
    return (
      editForm.group_name !== (openBooking.group_name || "") ||
      editForm.group_size !== (Number(openBooking.group_size) || 0) ||
      editForm.special_requests !== (openBooking.special_requests || "") ||
      editForm.table_id !== currentTableId ||
      editForm.status !== (normStatus(openBooking.status) || "pending")
    );
  };

  const persistEdits = async (): Promise<boolean> => {
    if (!openBooking) return true;

    const origStatus = normStatus(openBooking.status) || "pending";
    const origTableId = openBooking.booking_table_mappings?.[0]?.tables?.tables_id ?? "";
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

    const bookingId = openBooking.id;
    return new Promise<boolean>(resolve => {
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
        if (!ok) return;
      }
    }
    proceed();
  };

  const handleSave = async () => {
    const ok = await persistEdits();
    if (ok) setIsEditing(false);
  };

  const toggleRow = (booking: GeneralBooking) => {
    guardedClose(() => {
      setOpenId(current => (current === booking.id ? null : booking.id));
      setIsEditing(false);
    });
  };

  const handleDeleteBooking = (id: string) => {
    startTransition(async () => {
      try {
        await deleteGeneralBooking(id);
        setOpenId(null);
        setIsEditing(false);
        toast.success("Booking deleted permanently");
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete booking");
      }
    });
  };

  const renderView = (booking: GeneralBooking) => {
    const table = booking.booking_table_mappings?.[0]?.tables;
    const bookingSeating = seatingRequired && booking.events?.seating_required !== false;
    const paid = Number(booking.paid_amount) || 0;
    const total = Number(booking.total_amount) || 0;
    const isPaid = total > 0 && paid >= total;
    const contact = booking.contacts;

    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-3.5 whitespace-normal">
        <div className={PANEL}>
          <div className={PANEL_HEAD}>Booking details</div>
          <DetailRow label="Booking ref">#{booking.id}</DetailRow>
          <DetailRow label="Booked on">
            {booking.booking_created_at
              ? format(new Date(booking.booking_created_at), "dd MMM yyyy · HH:mm")
              : "-"}
          </DetailRow>
          {bookingSeating && (
            <DetailRow label="Table">
              {table?.tables_name ? (
                <>
                  {table.tables_name}
                  {table.tables_capacity ? ` · seats ${table.tables_capacity}` : ""}
                </>
              ) : (
                <span className="text-[#8A5F0E]">Not assigned yet</span>
              )}
            </DetailRow>
          )}
          {hasPaymentFor(booking) && (
            <DetailRow label="Payment">
              <span className="tabular-nums">£{paid.toFixed(2)}</span>{" "}
              <span className="text-[#5E6654] tabular-nums">of £{total.toFixed(2)}</span>
              <span
                className={cn(
                  "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                  isPaid ? "bg-[#E7F2E0] text-[#2F6420]" : "bg-[#ECE9DE] text-[#5E6654]",
                )}
              >
                {isPaid ? "Paid" : "Unpaid"}
              </span>
            </DetailRow>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <div className={PANEL}>
            <div className={PANEL_HEAD}>Contact</div>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-[10px] bg-[#E5EBD8] text-[11px] font-semibold text-[#34451F]">
                {initials(contact?.full_name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#20231A]">
                  {contact?.full_name || "Unknown"}
                </span>
                {contact?.email && (
                  <span className="block truncate text-xs font-medium text-[#5E6654]">{contact.email}</span>
                )}
                {contact?.phone_no && (
                  <span className="block text-xs font-medium text-[#5E6654] tabular-nums">
                    {contact.country_code ?? ""}
                    {contact.phone_no}
                  </span>
                )}
              </span>
              {contact?.email && (
                <Link
                  href={`mailto:${contact.email}`}
                  className={cn(
                    ACTION,
                    "h-9 shrink-0 rounded-full border border-[#34451F] bg-[#E5EBD8] px-4 text-[#34451F]",
                  )}
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </Link>
              )}
            </div>
          </div>

          {booking.special_requests && (
            <div className="rounded-[14px] border border-[#E8D49A] bg-[#FBF3DC] px-4 py-2.5">
              <span className={cn(FIELD_LABEL, "text-[#8A5F0E]")}>Staff note</span>
              <p className="mt-1 text-[13px] leading-snug font-medium text-[#20231A] italic">
                &ldquo;{booking.special_requests}&rdquo;
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEnterEditMode}
              className={cn(
                ACTION,
                "h-11 flex-1 rounded-full border border-[#34451F] bg-[#E5EBD8] px-4 text-[#34451F]",
              )}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit booking
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete booking",
                  description: "Permanently delete this booking? This cannot be undone.",
                  confirmLabel: "Delete",
                  variant: "destructive",
                });
                if (ok) handleDeleteBooking(booking.id);
              }}
              className={cn(ACTION, "h-11 rounded-full border border-[#D8D5C8] bg-white px-4 text-[#96302A]")}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEditor = (booking: GeneralBooking) => {
    const originalTableId = booking.booking_table_mappings?.[0]?.tables?.tables_id || "";
    const originalStatus = normStatus(booking.status) || "pending";
    const bookingSeating = seatingRequired && booking.events?.seating_required !== false;

    const showTableConfirmedHint =
      bookingSeating && originalTableId === "" && editForm.table_id !== "" && editForm.status === "confirmed";
    const showTableCancelledHint =
      bookingSeating && originalTableId !== "" && editForm.table_id === "" && editForm.status === "cancelled";
    const showStatusTableUnassignedHint =
      bookingSeating && originalStatus === "confirmed" && editForm.status !== "confirmed" && editForm.table_id === "";

    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-3.5 whitespace-normal">
        <div className={PANEL}>
          <div className={PANEL_HEAD}>Editing booking #{booking.id}</div>
          <div className="flex flex-col gap-3 px-4 py-3.5">
            <div>
              <label htmlFor={`team-${booking.id}`} className={cn(FIELD_LABEL, "mb-1.5 block")}>
                Team name
              </label>
              <Input
                id={`team-${booking.id}`}
                value={editForm.group_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditForm(prev => ({ ...prev, group_name: e.target.value }))
                }
                className={FIELD}
              />
            </div>
            <div className={cn("grid gap-2.5", bookingSeating && "grid-cols-2")}>
              <div>
                <label htmlFor={`size-${booking.id}`} className={cn(FIELD_LABEL, "mb-1.5 block")}>
                  Group size
                </label>
                <Input
                  id={`size-${booking.id}`}
                  type="number"
                  min={1}
                  value={editForm.group_size || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleGroupSizeChange(Number(e.target.value) || 0)
                  }
                  className={FIELD}
                />
              </div>
              {bookingSeating && (
                <div>
                  <label htmlFor={`table-${booking.id}`} className={cn(FIELD_LABEL, "mb-1.5 block")}>
                    Table
                  </label>
                  <select
                    id={`table-${booking.id}`}
                    value={editForm.table_id}
                    onChange={e => handleTableChange(e.target.value)}
                    className={cn(FIELD, "appearance-none focus:border-[#34451F] focus:ring-[3px] focus:ring-[#D7A928]/30")}
                  >
                    <option value="">No table yet</option>
                    {availableTables.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} (seats {t.max_capacity})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {showTableConfirmedHint && (
              <Hint tone="green" icon={<CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}>
                Table picked — status will change to Confirmed.
              </Hint>
            )}
            {showTableCancelledHint && (
              <Hint tone="red" icon={<AlertCircle className="h-3.5 w-3.5 shrink-0" />}>
                Table removed — status will change to Cancelled.
              </Hint>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className={PANEL}>
            <div className={PANEL_HEAD}>Status &amp; notes</div>
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <div className="grid grid-cols-2 gap-2">
                {STATUS_ORDER.map(key => {
                  const style = STATUS_STYLES[key];
                  const active = editForm.status === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleStatusChangeInEdit(key)}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] text-[13px] font-semibold transition-colors sm:h-10",
                        active
                          ? cn(style.bg, style.text, style.border)
                          : "border-[#C9BB93] bg-white text-[#5E6654] hover:bg-[#F4F1E8]",
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                      {style.label}
                    </button>
                  );
                })}
              </div>
              {showStatusTableUnassignedHint && (
                <Hint tone="amber" icon={<RefreshCw className="h-3.5 w-3.5 shrink-0" />}>
                  Status changed — the table assignment will be cleared.
                </Hint>
              )}
              <div>
                <label htmlFor={`note-${booking.id}`} className={cn(FIELD_LABEL, "mb-1.5 block")}>
                  Staff note
                </label>
                <Textarea
                  id={`note-${booking.id}`}
                  value={editForm.special_requests}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setEditForm(prev => ({ ...prev, special_requests: e.target.value }))
                  }
                  placeholder="Dietary needs, table preference, occasion…"
                  className={cn(FIELD, "h-auto min-h-16 resize-y py-2.5")}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className={cn(ACTION, "h-11 flex-1 rounded-[11px] bg-[#34451F] px-4 text-white hover:bg-[#283719]")}
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className={cn(ACTION, "h-11 rounded-[11px] border border-[#C9BB93] bg-white px-4 text-[#5E6654]")}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const headCell = "sticky top-0 z-10 bg-[#34451F] px-2.5 py-3 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-[#EDE9D8] uppercase shadow-[inset_0_-2px_0_#26300D] sm:px-4";
  const secondaryCell = "hidden sm:table-cell";
  const bodyCell = (open: boolean) =>
    cn(
      "px-2.5 py-3.25 align-middle text-[13px] font-medium whitespace-nowrap sm:px-4",
      open ? "border-b border-dotted border-[#C4C0B0]" : "border-b border-[#EDEAE0]",
    );

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-[#D8D5C8] bg-white sm:max-h-[calc(100svh-24rem)] sm:overflow-y-auto">
        <table className="w-full border-collapse sm:min-w-175">
          <thead>
            <tr>
              <th className={cn(headCell, "w-11 px-0 sm:w-14 sm:px-1.5")}>
                <span className="sr-only">Expand</span>
              </th>
              {showEventColumn && <th className={cn(headCell, secondaryCell)}>Event</th>}
              <th className={headCell}>Team name</th>
              <th className={cn(headCell, secondaryCell)}>Booked by</th>
              <th className={cn(headCell, "w-15 text-center sm:w-17.5")}>Guests</th>
              {seatingRequired && <th className={cn(headCell, secondaryCell, "sm:w-25")}>Table</th>}
              {showPayment && <th className={cn(headCell, secondaryCell, "sm:w-27.5")}>Payment</th>}
              <th className={cn(headCell, "w-25 sm:w-30")}>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-8 text-center text-[13px] font-medium text-[#5E6654]">
                  No bookings match — try another filter or clear the search.
                </td>
              </tr>
            ) : (
              bookings.map(booking => {
                const open = openId === booking.id;
                const status = normStatus(booking.status) || "pending";
                const table = booking.booking_table_mappings?.[0]?.tables;
                const bookingSeating = booking.events?.seating_required !== false;
                const paid = Number(booking.paid_amount) || 0;
                const total = Number(booking.total_amount) || 0;
                const eventDate = parseDate(booking.events?.event_date);
                const teamName = booking.group_name || "Guest team";

                return (
                  <React.Fragment key={booking.id}>
                    <tr
                      ref={el => {
                        rowRefs.current[booking.id] = el;
                      }}
                      onClick={() => toggleRow(booking)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        open ? "bg-[#ECE9DE]" : "hover:bg-[#F4F1E8]",
                      )}
                    >
                      <td className={cn(bodyCell(open), "px-0 py-0 sm:px-1.5", open && "shadow-[inset_4px_0_0_#34451F]")}>
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`${open ? "Hide" : "Show"} details for ${teamName}`}
                          onClick={e => {
                            e.stopPropagation();
                            toggleRow(booking);
                          }}
                          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#5E6654] transition-colors hover:bg-black/5"
                        >
                          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
                        </button>
                      </td>
                      {showEventColumn && (
                        <td className={cn(bodyCell(open), secondaryCell, "text-[#5E6654]")}>
                          {booking.events?.event_title || "Untitled event"}
                          {eventDate ? ` · ${format(eventDate, "d MMM yy")}` : ""}
                        </td>
                      )}
                      <td className={cn(bodyCell(open), "max-sm:whitespace-normal")}>
                        <span className="text-sm font-semibold text-[#20231A]">{teamName}</span>
                        {booking.special_requests && (
                          <span title="Has a staff note" className="ml-1.5 inline-block align-[-2px]">
                            <Star className="h-3.5 w-3.5 fill-[#B07A16] text-[#B07A16]" />
                          </span>
                        )}
                      </td>
                      <td className={cn(bodyCell(open), secondaryCell, "text-[#5E6654]")}>
                        {booking.contacts?.full_name || "-"}
                      </td>
                      <td className={cn(bodyCell(open), "text-center text-sm font-semibold text-[#20231A] tabular-nums")}>
                        {booking.group_size ?? 0}
                      </td>
                      {seatingRequired && (
                        <td className={cn(bodyCell(open), secondaryCell)}>
                          {!bookingSeating ? (
                            <span className="text-[#5E6654]">—</span>
                          ) : table?.tables_name ? (
                            <span className="text-[#20231A]">{table.tables_name}</span>
                          ) : (
                            <span className="font-semibold text-[#8A5F0E]">None yet</span>
                          )}
                        </td>
                      )}
                      {showPayment && (
                        <td className={cn(bodyCell(open), secondaryCell)}>
                          {!hasPaymentFor(booking) ? (
                            <span className="text-[#5E6654]">—</span>
                          ) : paid >= total ? (
                            <span className="font-semibold text-[#2F6420] tabular-nums">
                              Paid £{paid.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[#5E6654] tabular-nums">
                              £{paid.toFixed(2)} of £{total.toFixed(2)}
                            </span>
                          )}
                        </td>
                      )}
                      <td className={bodyCell(open)}>
                        <StatusPill status={status} />
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td
                          colSpan={columnCount}
                          className="border-b border-dotted border-[#C4C0B0] bg-[#F6F4EC] px-3 py-4 shadow-[inset_4px_0_0_#34451F] sm:px-5 sm:py-4.5"
                        >
                          {isEditing ? renderEditor(booking) : renderView(booking)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isPending && (
        <div className="fixed bottom-10 left-1/2 z-100 flex -translate-x-1/2 animate-in items-center gap-3 rounded-full border border-white/10 bg-[#34451F] px-6 py-3.5 text-[13px] font-semibold text-white shadow-2xl duration-300 fade-in slide-in-from-bottom-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Saving…
        </div>
      )}
      {ConfirmDialogUI}
    </>
  );
}
