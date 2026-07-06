"use client";

import React, { useState, useTransition } from "react";
import { updateBandStatus, updateBandBookingFields, getClashingEvents, rescheduleConfirmedBooking } from "../actions";
import type { BandStatus } from "../actions";
import {
  ChevronRight,
  ChevronDown,
  Instagram,
  Facebook,
  Youtube,
  Music2,
  Link2,
  CheckCircle2,
  XCircle,
  Clock3,
  Loader2,
  Save,
  CreditCard,
  ExternalLink,
  MessageSquareQuote,
  AlertCircle,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { VideoFacade } from "@/components/video-facade";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { addHoursToTime, toHHMM, type ClashEvent } from "@/lib/event-clash";
import { buildRescheduleEmail } from "@/lib/band-emails";

const DEFAULT_START_TIME = "22:00"; // 10pm

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
}

export interface BandRequest {
  id: string;
  group_name: string | null;
  type: string | null;
  genre: string | null;
  booker_name: string;
  email: string;
  phone_no: string | null;
  social_links: SocialLinks | null;
  video_urls: string[] | null;
  preferred_dates: string[] | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  payment_amount: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  selected_date: string | null;
  selected_start_time: string | null;
  selected_end_time: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_payment_ref: string | null;
  is_favorite: boolean;
  event_id: number | null;
  updated_at?: string | null;
  updated_by?: number | null;
  /** Joined employee for `updated_by` — who last modified the request. */
  updated_by_employee?: { full_name: string | null } | null;
}

export const statusTheme: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    ring: string;
    cardBorder: string;
    icon: React.ReactNode;
    label: string;
  }
> = {
  all: {
    bg: "bg-[#F7F4EA]",
    text: "text-[#1F1F1A]",
    border: "border-[#E6DFC8]",
    dot: "bg-[#5F624F]",
    ring: "ring-slate-500/40",
    cardBorder: "border-[#E6DFC8]",
    icon: <Music2 className="w-5 h-5" />,
    label: "All",
  },
  confirmed: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    ring: "ring-green-500/40",
    cardBorder: "border-green-500/50",
    icon: <CheckCircle2 className="w-5 h-5" />,
    label: "Confirmed",
  },
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
    cardBorder: "border-amber-500/50",
    icon: <Clock3 className="w-5 h-5" />,
    label: "Pending",
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    ring: "ring-red-500/40",
    cardBorder: "border-red-500/50",
    icon: <XCircle className="w-5 h-5" />,
    label: "Cancelled",
  },
};

const SOCIAL_ICONS: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: Music2,
};

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

function SheetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 px-4 sm:px-5 py-3 border-[#E6DFC8] last:border-0 border-b">
      <span className="pt-0.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">
        {label}
      </span>
      <span className="font-bold text-[#1F1F1A] text-sm text-right">{value || "—"}</span>
    </div>
  );
}

/** A label + value row that becomes an input/select when `editable`. */
function EditRow({
  label,
  value,
  onChange,
  editable,
  type = "text",
  placeholder,
  options,
  readOnlyValue,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  type?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  readOnlyValue?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center gap-4 px-4 sm:px-5 py-3 border-[#E6DFC8] last:border-0 border-b">
      <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">{label}</span>
      {!editable ? (
        <span className="font-bold text-[#1F1F1A] text-sm text-right">{readOnlyValue ?? (value || "—")}</span>
      ) : options ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent outline-none font-bold text-[#1F1F1A] text-sm text-right [text-align-last:right] cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none font-bold text-[#1F1F1A] text-sm text-right placeholder:text-[#5F624F]/40"
        />
      )}
    </div>
  );
}

/** Collapsible card section — matches the layout/format of the event-setups sheet. */
function Section({
  title,
  defaultOpen = true,
  className,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("bg-white border-[#E6DFC8] border-2 rounded-3xl overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex justify-between items-center bg-[#F7F4EA] hover:bg-[#F0EDE0] px-4 sm:px-5 py-3 w-full text-left transition-colors"
      >
        <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">{title}</span>
        <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div className={cn(!open && "hidden")}>{children}</div>
    </div>
  );
}

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/** Full date + time, e.g. "8 May 2026, 14:32" — used in the audit trail. */
function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BandBookingCard({ request }: { request: BandRequest }) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [open, setOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [selectedDate, setSelectedDate] = useState(request.selected_date || "");
  const [selectedStartTime, setSelectedStartTime] = useState(toHHMM(request.selected_start_time));
  const [selectedEndTime, setSelectedEndTime] = useState(toHHMM(request.selected_end_time));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [clashes, setClashes] = useState<ClashEvent[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Editable detail fields (act, contact & payment). Seeded from the request; a
  // cancelled request is read-only, everything else can be edited.
  const [actName, setActName] = useState(request.group_name ?? "");
  const [reqType, setReqType] = useState(request.type ?? "");
  const [genre, setGenre] = useState(request.genre ?? "");
  const [bookerName, setBookerName] = useState(request.booker_name ?? "");
  const [email, setEmail] = useState(request.email ?? "");
  const [phone, setPhone] = useState(request.phone_no ?? "");
  const [paymentAmount, setPaymentAmount] = useState(request.payment_amount != null ? String(request.payment_amount) : "");
  const [paidAmount, setPaidAmount] = useState(request.paid_amount != null ? String(request.paid_amount) : "");
  const [paymentStatus, setPaymentStatus] = useState(request.payment_status ?? "unpaid");
  const [bankAccountName, setBankAccountName] = useState(request.bank_account_name ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(request.bank_account_no ?? "");
  const [bankSortCode, setBankSortCode] = useState(request.bank_sort_code ?? "");
  const [bankPaymentRef, setBankPaymentRef] = useState(request.bank_payment_ref ?? "");

  const status = normStatus(request.status);
  const theme = statusTheme[status] || statusTheme.pending;
  const editable = status !== "cancelled";

  const socials = request.social_links
    ? Object.entries(request.social_links).filter(([, v]) => v)
    : [];
  const videos = (request.video_urls ?? []).filter(Boolean);
  const dates = (request.preferred_dates ?? []).filter(Boolean);

  const needsPayment =
    (request.payment_amount ?? 0) > 0 && request.payment_status === "unpaid";

  // Original (normalised) values, to detect whether date/time actually changed.
  const origDate = request.selected_date || "";
  const origStart = toHHMM(request.selected_start_time);
  const origEnd = toHHMM(request.selected_end_time);
  const dateTimeChanged =
    selectedDate !== origDate || selectedStartTime !== origStart || selectedEndTime !== origEnd;

  // Have any editable fields diverged from the saved record? Drives the Save button.
  const detailsChanged =
    actName !== (request.group_name ?? "") ||
    reqType !== (request.type ?? "") ||
    genre !== (request.genre ?? "") ||
    bookerName !== (request.booker_name ?? "") ||
    email !== (request.email ?? "") ||
    phone !== (request.phone_no ?? "") ||
    paymentAmount !== (request.payment_amount != null ? String(request.payment_amount) : "") ||
    paidAmount !== (request.paid_amount != null ? String(request.paid_amount) : "") ||
    paymentStatus !== (request.payment_status ?? "unpaid") ||
    bankAccountName !== (request.bank_account_name ?? "") ||
    bankAccountNo !== (request.bank_account_no ?? "") ||
    bankSortCode !== (request.bank_sort_code ?? "") ||
    bankPaymentRef !== (request.bank_payment_ref ?? "") ||
    adminNotes !== (request.admin_notes ?? "");
  const hasChanges = detailsChanged || dateTimeChanged;

  // All editable detail fields except the schedule (date/time is handled separately
  // because a confirmed reschedule also emails the band and moves the linked event).
  const detailFields = () => ({
    group_name: actName || null,
    type: reqType || null,
    genre: genre || null,
    booker_name: bookerName,
    email,
    phone_no: phone || null,
    payment_amount: paymentAmount === "" ? null : Number(paymentAmount),
    paid_amount: paidAmount === "" ? null : Number(paidAmount),
    payment_status: paymentStatus,
    bank_account_name: bankAccountName || null,
    bank_account_no: bankAccountNo || null,
    bank_sort_code: bankSortCode || null,
    bank_payment_ref: bankPaymentRef || null,
    admin_notes: adminNotes || null,
  });

  // Picking a date defaults the start to 10pm (if unset); changing the start always
  // re-derives the end as start + 2 hours.
  const applyDate = (d: string) => {
    setSelectedDate(d);
    setClashes([]);
    if (d && !selectedStartTime) {
      setSelectedStartTime(DEFAULT_START_TIME);
      setSelectedEndTime(addHoursToTime(DEFAULT_START_TIME, 2));
    }
  };
  const applyStart = (v: string) => {
    setSelectedStartTime(v);
    setSelectedEndTime(v ? addHoursToTime(v, 2) : "");
    setClashes([]);
  };

  // Look up active events that overlap the chosen slot (excluding this booking's own
  // linked event). Returns the clashes and stores them for display.
  async function findClashes(): Promise<ClashEvent[]> {
    if (!selectedDate) {
      setClashes([]);
      return [];
    }
    const list = await getClashingEvents(
      selectedDate,
      selectedStartTime || null,
      selectedEndTime || null,
      request.event_id
    );
    setClashes(list);
    return list;
  }

  // Discard any unsaved edits and close the sheet.
  function handleCancel() {
    setActName(request.group_name ?? "");
    setReqType(request.type ?? "");
    setGenre(request.genre ?? "");
    setBookerName(request.booker_name ?? "");
    setEmail(request.email ?? "");
    setPhone(request.phone_no ?? "");
    setPaymentAmount(request.payment_amount != null ? String(request.payment_amount) : "");
    setPaidAmount(request.paid_amount != null ? String(request.paid_amount) : "");
    setPaymentStatus(request.payment_status ?? "unpaid");
    setBankAccountName(request.bank_account_name ?? "");
    setBankAccountNo(request.bank_account_no ?? "");
    setBankSortCode(request.bank_sort_code ?? "");
    setBankPaymentRef(request.bank_payment_ref ?? "");
    setSelectedDate(request.selected_date || "");
    setSelectedStartTime(toHHMM(request.selected_start_time));
    setSelectedEndTime(toHHMM(request.selected_end_time));
    setAdminNotes(request.admin_notes || "");
    setClashes([]);
    setError(null);
    setOpen(false);
  }

  function handleAction(newStatus: BandStatus) {
    setError(null);
    setClashes([]);
    startTransition(async () => {
      try {
        // Confirming places an event — block it if the slot clashes. The clashes
        // render inline under the Performance Time field, so no footer error here.
        if (newStatus === "confirmed") {
          const c = await findClashes();
          if (c.length) return;
        }
        // Persist any field / date edits before the status change.
        if (hasChanges) {
          await updateBandBookingFields(request.id, {
            ...detailFields(),
            selected_date: selectedDate || null,
            selected_start_time: selectedStartTime || null,
            selected_end_time: selectedEndTime || null,
          });
        }
        await updateBandStatus(request.id, newStatus, adminNotes || undefined);
        setOpen(false);
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  // Save Changes. A pending/other booking saves straight away. A CONFIRMED booking
  // always confirms first (its edits flow through to the linked event); a date/time
  // change additionally re-emails the band and moves the event off the schedule.
  function handleSave() {
    if (!hasChanges) return;
    setError(null);
    setClashes([]);
    startTransition(async () => {
      try {
        if (status !== "confirmed") {
          await updateBandBookingFields(request.id, {
            ...detailFields(),
            selected_date: selectedDate || null,
            selected_start_time: selectedStartTime || null,
            selected_end_time: selectedEndTime || null,
          });
          toast.success("Changes saved");
          setOpen(false);
          return;
        }

        // Confirmed + date/time change → clash check + reschedule email flow.
        if (dateTimeChanged) {
          const c = await findClashes();
          if (c.length) return;

          const preview = buildRescheduleEmail({
            name: request.booker_name,
            groupName: request.group_name,
            date: selectedDate || null,
            startTime: selectedStartTime || null,
            endTime: selectedEndTime || null,
          });

          const ok = await confirm({
            title: "Update slot & notify band",
            description:
              "This moves the booking back to Pending, takes the linked event off the schedule, and emails the band to re-confirm. Preview:",
            confirmLabel: "Update & Email",
            content: (
              <div className="space-y-1.5 bg-white p-3 border border-[#E6DFC8] rounded-xl text-left">
                <p className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
                  To: {request.email}
                </p>
                <p className="font-black text-[#1F1F1A] text-xs">{preview.subject}</p>
                <p className="text-[#5F624F] text-xs">{preview.greeting}</p>
                {preview.body.map((p, i) => (
                  <p key={i} className="text-[#5F624F] text-xs leading-relaxed">{p}</p>
                ))}
                {preview.dateLabel && (
                  <div className="bg-[#F7F4EA] mt-1 px-3 py-2 border border-[#E6DFC8] rounded-lg">
                    <p className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide">New Slot</p>
                    <p className="font-black text-[#1F1F1A] text-sm">{preview.dateLabel}</p>
                    {preview.timeLabel && (
                      <p className="font-bold text-[#5F624F] text-xs">{preview.timeLabel}</p>
                    )}
                  </div>
                )}
              </div>
            ),
          });
          if (!ok) return;

          await updateBandBookingFields(request.id, detailFields());
          await rescheduleConfirmedBooking(request.id, {
            selected_date: selectedDate || null,
            selected_start_time: selectedStartTime || null,
            selected_end_time: selectedEndTime || null,
            admin_notes: adminNotes || null,
          });
          toast.success("Booking updated — band notified");
          setOpen(false);
          return;
        }

        // Confirmed, detail-only change → confirm, then save.
        const ok = await confirm({
          title: "Save changes?",
          description:
            "This booking is confirmed — saving updates its details and the linked event.",
          confirmLabel: "Save Changes",
        });
        if (!ok) return;
        await updateBandBookingFields(request.id, detailFields());
        toast.success("Changes saved");
        setOpen(false);
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  return (
    <>
      {/* Card row */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "bg-white border-[#E6DFC8] border-2 rounded-2xl w-full overflow-hidden",
          "flex items-center gap-3 px-3 py-3.5 text-left",
          "hover:bg-[#F7F4EA]/60 transition-all active:scale-[0.98] shadow-sm"
        )}
      >
        {/* Status badge circle (left) */}
        <div
          className={cn(
            "flex flex-col justify-center items-center border rounded-full w-11 h-11 shrink-0",
            theme.bg,
            theme.text,
            theme.border
          )}
        >
          {status === "confirmed" && request.selected_date ? (
            <div className="flex flex-col justify-center items-center leading-none">
              <span className="opacity-80 mb-0.5 font-black text-[10px] uppercase tracking-tighter">
                {format(new Date(request.selected_date + "T00:00:00"), "MMM")}
              </span>
              <span className="font-black text-base tracking-tighter">
                {format(new Date(request.selected_date + "T00:00:00"), "dd")}
              </span>
            </div>
          ) : (
            theme.icon
          )}
        </div>

        {/* Names + type/genre */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-black text-[#1F1F1A] text-sm truncate uppercase tracking-tight">
              {request.group_name || request.booker_name}
            </p>
            {/* Indicators */}
            {request.notes && (
              <span className="bg-blue-50 px-1.5 py-0.5 border border-blue-200 rounded font-black text-[10px] text-blue-700 uppercase shrink-0">
                NOTE
              </span>
            )}
            {request.admin_notes && (
              <span className="bg-purple-50 px-1.5 py-0.5 border border-purple-200 rounded font-black text-[10px] text-purple-700 uppercase shrink-0">
                ADMIN
              </span>
            )}
            {needsPayment && (
              <span className="bg-amber-50 px-1.5 py-0.5 border border-amber-200 rounded font-black text-[10px] text-amber-700 uppercase shrink-0">
                PAY
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[#5F624F]">
            <p className="font-semibold text-xs truncate">{request.booker_name}</p>
            {(request.type || request.genre) && (
              <span className="opacity-60 font-bold text-[10px] truncate">
                {[toTitleCase(request.type), toTitleCase(request.genre)].filter(Boolean).join(" / ")}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
      </button>

      {/* Bottom sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-140 lg:w-6xl xl:w-7xl
            sm:h-auto sm:max-h-[80vh] lg:max-h-[90vh] sm:rounded-4xl sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sheet header */}
          <div className="top-0 z-30 sticky bg-white/80 backdrop-blur-md p-4 pb-3 border-[#E6DFC8] border-b sm:rounded-t-4xl shrink-0">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <SheetTitle className="font-black text-[#1F1F1A] text-lg truncate uppercase leading-tight tracking-tight">
                  {request.group_name || request.booker_name}
                </SheetTitle>
                {request.group_name && (
                  <p className="mt-0.5 text-[#5F624F] text-xs">{request.booker_name}</p>
                )}
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl font-black text-[10px] uppercase tracking-wider shrink-0",
                  theme.bg,
                  theme.text,
                  theme.border
                )}
              >
                <span className={cn("rounded-full w-2 h-2", theme.dot)} />
                {theme.label}
              </span>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6 min-h-0 overflow-y-auto touch-pan-y">
            <div className="items-start gap-5 space-y-4 sm:space-y-5 lg:space-y-0 lg:grid grid-cols-2 animate-in duration-200 fade-in">
              {/* Event details */}
              <Section title="Event Details">
                <EditRow label="Act Name" value={actName} onChange={setActName} editable={editable} placeholder="Act name" />
                <EditRow
                  label="Type"
                  value={reqType}
                  onChange={setReqType}
                  editable={editable}
                  options={[
                    { value: "band", label: "Band" },
                    { value: "singer", label: "Singer" },
                    { value: "dj", label: "DJ" },
                  ]}
                  readOnlyValue={toTitleCase(request.type) || "—"}
                />
                <EditRow label="Genre" value={genre} onChange={setGenre} editable={editable} placeholder="Genre" readOnlyValue={toTitleCase(request.genre) || "—"} />

                {/* Preferred dates — applicant's choices, shown above the selected slot */}
                {dates.length > 0 && (
                  <div className="px-4 sm:px-5 py-3 border-[#E6DFC8] last:border-0 border-b">
                    <span className="block mb-2 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
                      Preferred Dates
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {dates.map((d, i) => {
                        const isSelected = selectedDate === d;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={!editable}
                            onClick={() => applyDate(isSelected ? "" : d)}
                            className={cn(
                              "px-3 py-1.5 border rounded-xl font-bold text-xs transition-all",
                              isSelected
                                ? "bg-[#5C4033] text-white border-[#5C4033]"
                                : "bg-white border-[#E6DFC8] text-[#1F1F1A] hover:border-[#5C4033]/30",
                              !editable && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            {format(new Date(d + "T00:00:00"), "EEE, d MMM")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected date — label + value on one row (right-aligned); calendar popover when editable */}
                <div className="px-4 sm:px-5 py-3 border-[#E6DFC8] last:border-0 border-b">
                  <div className="flex justify-between items-center gap-4">
                    <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">
                      Selected Date
                    </span>
                    {editable ? (
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 font-bold text-[#1F1F1A] hover:text-[#5C4033] text-sm transition-colors"
                          >
                            {selectedDate
                              ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy")
                              : "Pick a date"}
                            <CalendarDays className="w-4 h-4 text-[#5F624F]/60 shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="bg-white p-0 border-[#E6DFC8] border-2 rounded-2xl w-auto">
                          <Calendar
                            mode="single"
                            selected={selectedDate ? new Date(selectedDate + "T00:00:00") : undefined}
                            onSelect={(d) => {
                              if (d) applyDate(format(d, "yyyy-MM-dd"));
                              setDatePickerOpen(false);
                            }}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="font-bold text-[#1F1F1A] text-sm text-right">
                        {selectedDate ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy") : "—"}
                      </span>
                    )}
                  </div>
                  {status === "pending" && !selectedDate && (
                    <FieldMessage warning="Pick a date before you can confirm." />
                  )}
                </div>

                {/* Time — label + start/end on one row (24h, matching the event view) */}
                <div className="px-4 sm:px-5 py-3 border-[#E6DFC8] last:border-0 border-b">
                  <div className="flex justify-between items-center gap-4">
                    <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">
                      Time
                    </span>
                    {editable ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          aria-label="Performance start time"
                          value={selectedStartTime}
                          onChange={(e) => applyStart(e.target.value)}
                          className="bg-transparent outline-none font-bold text-[#1F1F1A] text-sm text-right"
                        />
                        <span className="text-[#5F624F]/50 text-xs">-</span>
                        <input
                          type="time"
                          aria-label="Performance end time"
                          value={selectedEndTime}
                          onChange={(e) => {
                            setSelectedEndTime(e.target.value);
                            setClashes([]);
                          }}
                          className="bg-transparent outline-none font-bold text-[#1F1F1A] text-sm text-right"
                        />
                      </div>
                    ) : (
                      <span className="font-bold text-[#1F1F1A] text-sm text-right">
                        {selectedStartTime || selectedEndTime ? `${selectedStartTime} - ${selectedEndTime}` : "—"}
                      </span>
                    )}
                  </div>
                  {clashes.length > 0 && (
                    <div className="mt-2">
                      <ClashList clashes={clashes} />
                    </div>
                  )}
                </div>

                {/* Notes from applicant */}
                {request.notes && (
                  <div className="px-4 sm:px-5 py-3 border-[#E6DFC8] last:border-0 border-b">
                    <span className="block mb-1.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
                      Notes from Applicant
                    </span>
                    <p className="text-[#1F1F1A] text-sm italic leading-relaxed">
                      &quot;{request.notes}&quot;
                    </p>
                  </div>
                )}
              </Section>

              {/* Contact info */}
              <Section title="Contact Information">
                <EditRow label="Name" value={bookerName} onChange={setBookerName} editable={editable} placeholder="Contact name" />
                <EditRow label="Email" value={email} onChange={setEmail} editable={editable} type="email" placeholder="email@example.com" />
                <EditRow label="Phone" value={phone} onChange={setPhone} editable={editable} type="tel" placeholder="Phone number" />
              </Section>

              {/* Payment Details section */}
              {(editable || (request.payment_amount ?? 0) > 0) && (
                <Section title="Payment Details">
                  {/* Amount */}
                  <div className="flex justify-between items-center gap-4 px-4 sm:px-5 py-3 border-[#E6DFC8] last:border-0 border-b">
                    <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">Amount</span>
                    {editable ? (
                      <div className="flex flex-1 justify-end items-center gap-1">
                        <span className="font-bold text-[#5F624F] text-sm">£</span>
                        <input
                          aria-label="Amount"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="bg-transparent outline-none w-24 font-bold text-[#1F1F1A] text-sm text-right placeholder:text-[#5F624F]/40"
                        />
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 font-bold text-[#1F1F1A] text-sm">
                        <CreditCard className="opacity-50 w-3.5 h-3.5 text-[#5F624F]" />
                        £{(request.payment_amount ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* Paid */}
                  <div className="flex justify-between items-center gap-4 px-4 sm:px-5 py-3 border-[#E6DFC8] last:border-0 border-b">
                    <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide shrink-0">Paid</span>
                    {editable ? (
                      <div className="flex flex-1 justify-end items-center gap-1">
                        <span className="font-bold text-[#5F624F] text-sm">£</span>
                        <input
                          aria-label="Paid"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          className="bg-transparent outline-none w-24 font-bold text-[#1F1F1A] text-sm text-right placeholder:text-[#5F624F]/40"
                        />
                      </div>
                    ) : (
                      <span className="font-bold text-[#1F1F1A] text-sm text-right">£{(request.paid_amount ?? 0).toFixed(2)}</span>
                    )}
                  </div>
                  <EditRow
                    label="Status"
                    value={paymentStatus}
                    onChange={setPaymentStatus}
                    editable={editable}
                    options={[
                      { value: "unpaid", label: "Unpaid" },
                      { value: "paid", label: "Paid" },
                    ]}
                    readOnlyValue={
                      <span
                        className={cn(
                          "px-2 py-1 border rounded-lg font-black text-[10px] uppercase tracking-tight",
                          request.payment_status === "paid"
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        )}
                      >
                        {request.payment_status || "unpaid"}
                      </span>
                    }
                  />
                  <EditRow label="Account Name" value={bankAccountName} onChange={setBankAccountName} editable={editable} placeholder="—" />
                  <EditRow label="Account No." value={bankAccountNo} onChange={setBankAccountNo} editable={editable} placeholder="—" />
                  <EditRow label="Sort Code" value={bankSortCode} onChange={setBankSortCode} editable={editable} placeholder="—" />
                  <EditRow label="Payment Ref" value={bankPaymentRef} onChange={setBankPaymentRef} editable={editable} placeholder="—" />
                </Section>
              )}

              {/* Linked Event navigation */}
              {request.event_id && (
                <Link
                  href={`/event-setups/events?open=${request.event_id}`}
                  className="group flex justify-between items-center gap-3 bg-white hover:bg-[#F7F4EA] px-4 sm:px-5 py-3.5 border-[#E6DFC8] border-2 rounded-3xl h-fit transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarDays className="w-4 h-4 text-[#5C4033] shrink-0" />
                    <span className="font-black text-[#5C4033] text-xs uppercase tracking-wide">
                      View Linked Event
                    </span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#5F624F] group-hover:text-[#5C4033] transition-colors shrink-0" />
                </Link>
              )}

              {/* Social links */}
              {socials.length > 0 && (
                <Section title="Social Media">
                  <div className="flex flex-wrap gap-2 px-4 sm:px-5 py-3">
                    {socials.map(([key, url]) => {
                      const Icon = SOCIAL_ICONS[key] ?? Link2;
                      return (
                        <a
                          key={key}
                          href={url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-white hover:bg-[#F7F4EA] px-3 py-2 border border-[#E6DFC8] rounded-xl font-bold text-[#5C4033] text-xs transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </a>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Videos — play inline on the page (facade: loads on click) */}
              {videos.length > 0 && (
                <Section title="Performance Videos" className="lg:col-span-2">
                  <div className="gap-3 grid grid-cols-1 sm:grid-cols-2 px-4 sm:px-5 py-3">
                    {videos.map((url, i) => (
                      <VideoFacade key={i} url={url} title={`Video ${i + 1}`} />
                    ))}
                  </div>
                </Section>
              )}

              {/* System information — audit trail; collapsed by default */}
              <Section title="System Information" defaultOpen={false} className="lg:col-span-2">
                <SheetRow label="Submitted" value={formatDateTime(request.created_at)} />
                <SheetRow label="Last Modified" value={formatDateTime(request.updated_at)} />
                <SheetRow label="Modified By" value={request.updated_by_employee?.full_name || "—"} />
              </Section>

              {/* Admin notes (read-only if resolved, editable if pending) */}
              {status !== "pending" && request.admin_notes && (
                <Section title="Admin Notes" className="lg:col-span-2">
                  <div className="px-4 sm:px-5 py-3">
                    <div className="bg-[#5C4033]/5 p-4 border border-[#5C4033]/15 rounded-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquareQuote className="opacity-40 w-4 h-4 text-[#5C4033]" />
                        <span className="font-black text-[#5C4033] text-[10px] uppercase tracking-wide">Staff Note</span>
                      </div>
                      <p className="text-[#1F1F1A] text-sm italic leading-relaxed">
                        &quot;{request.admin_notes}&quot;
                      </p>
                    </div>
                  </div>
                </Section>
              )}
            </div>
            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="z-40 bg-white/80 backdrop-blur-md px-6 py-5 pb-10 sm:pb-5 border-[#E6DFC8] border-t-2 rounded-b-4xl shrink-0">
            {/* Action area — pending */}
            {status === "pending" && (
              <div className="space-y-3">
                <div>
                  <label className="block mb-1.5 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
                    Note to Applicant (optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add a message to include in the outcome email..."
                    rows={2}
                    className="bg-[#F7F4EA] px-4 py-3 border border-[#E6DFC8] focus:border-[#5C4033]/30 rounded-2xl focus:outline-none w-full text-[#1F1F1A] placeholder:text-[#5F624F]/50 text-sm transition-all resize-none"
                  />
                </div>

                {error && <p className="font-bold text-red-500 text-xs">{error}</p>}

                {/* Status actions */}
                <div className="gap-3 grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleAction("confirmed")}
                    disabled={isPending || !selectedDate}
                    className="flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-2xl h-14 font-black text-white text-[10px] uppercase tracking-widest transition-all active:scale-95"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("cancelled")}
                    disabled={isPending}
                    className="flex justify-center items-center gap-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 border border-red-200 rounded-2xl h-14 font-black text-red-700 text-[10px] uppercase tracking-widest transition-all"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Reject
                  </button>
                </div>

                {/* Cancel / Save Changes */}
                <div className="gap-3 grid grid-cols-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex justify-center items-center bg-white disabled:opacity-50 border-[#E6DFC8] border-2 rounded-2xl h-14 font-black text-[#5F624F] text-[10px] uppercase tracking-wide"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending || !hasChanges}
                    className="flex justify-center items-center gap-2 bg-[#1B4332] hover:bg-[#1B4332]/85 disabled:opacity-50 disabled:pointer-events-none shadow-lg rounded-2xl h-14 font-black text-white text-[10px] uppercase tracking-widest active:scale-95"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* Action area — confirmed */}
            {status === "confirmed" && (
              <div className="space-y-3">
                {error && <p className="font-bold text-red-500 text-xs">{error}</p>}

                {/* Status actions */}
                <div className="gap-3 grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleAction("cancelled")}
                    disabled={isPending}
                    className="flex justify-center items-center gap-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 border border-red-200 rounded-2xl h-14 font-black text-red-700 text-[10px] uppercase tracking-widest transition-all"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("pending")}
                    disabled={isPending}
                    className="flex justify-center items-center gap-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 border border-amber-200 rounded-2xl h-14 font-black text-amber-700 text-[10px] uppercase tracking-widest transition-all"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock3 className="w-3.5 h-3.5" />}
                    Set Pending
                  </button>
                </div>

                {/* Cancel / Save Changes */}
                <div className="gap-3 grid grid-cols-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="flex justify-center items-center bg-white disabled:opacity-50 border-[#E6DFC8] border-2 rounded-2xl h-14 font-black text-[#5F624F] text-[10px] uppercase tracking-wide"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending || !hasChanges}
                    className="flex justify-center items-center gap-2 bg-[#1B4332] hover:bg-[#1B4332]/85 disabled:opacity-50 disabled:pointer-events-none shadow-lg rounded-2xl h-14 font-black text-white text-[10px] uppercase tracking-widest active:scale-95"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
          {ConfirmDialogUI}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Inline error/warning line shown neatly under the field it relates to. */
function FieldMessage({ error, warning }: { error?: string; warning?: string }) {
  const message = error ?? warning;
  if (!message) return null;
  const isWarning = !error && !!warning;
  return (
    <p className={cn("flex items-center gap-1 mt-2 font-bold text-[11px] leading-snug", isWarning ? "text-amber-600" : "text-red-600")}>
      {isWarning ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
      {message}
    </p>
  );
}

function ClashList({ clashes }: { clashes: ClashEvent[] }) {
  if (clashes.length === 0) return null;
  return (
    <div className="space-y-1.5 bg-red-50 p-3 border border-red-200 rounded-xl">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <p className="font-black text-[10px] text-red-700 uppercase tracking-tight">
          Time slot full — conflicts with:
        </p>
      </div>
      <ul className="space-y-0.5 pl-6 list-disc">
        {clashes.map((c) => (
          <li key={c.id} className="font-bold text-[11px] text-red-700">
            {c.title} ({c.start} – {c.end})
          </li>
        ))}
      </ul>
    </div>
  );
}
