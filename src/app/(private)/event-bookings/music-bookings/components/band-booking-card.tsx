"use client";

import React, { useState, useTransition } from "react";
import { updateBandStatus, updateBandBookingFields, getClashingEvents, rescheduleConfirmedBooking } from "../actions";
import type { BandStatus } from "../actions";
import {
  ChevronRight,
  ChevronDown,
  Music2,
  Link2,
  CheckCircle2,
  XCircle,
  Clock3,
  Inbox,
  Send,
  Loader2,
  Save,
  CreditCard,
  ExternalLink,
  MessageSquareQuote,
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Video,
  Mail,
  Phone,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok } from "react-icons/si";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
  band_notes: string | null;
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
    icon: <Music2 className="h-5 w-5" />,
    label: "All",
  },
  new: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
    ring: "ring-sky-500/40",
    cardBorder: "border-sky-500/50",
    icon: <Inbox className="h-5 w-5" />,
    label: "New",
  },
  reviewing: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
    cardBorder: "border-amber-500/50",
    icon: <Clock3 className="h-5 w-5" />,
    label: "Reviewing",
  },
  offered: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
    ring: "ring-purple-500/40",
    cardBorder: "border-purple-500/50",
    icon: <Send className="h-5 w-5" />,
    label: "Offered",
  },
  booked: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    ring: "ring-green-500/40",
    cardBorder: "border-green-500/50",
    icon: <CheckCircle2 className="h-5 w-5" />,
    label: "Booked",
  },
  declined: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    ring: "ring-red-500/40",
    cardBorder: "border-red-500/50",
    icon: <XCircle className="h-5 w-5" />,
    label: "Declined",
  },
};

/**
 * Which status buttons each stage shows, and where they lead. Booked is terminal
 * here (aside from Decline) because slot changes go through the reschedule flow,
 * which lands on "offered". Colours are semantic per stage, matching the app's
 * existing status-button convention (not the Edit/Save identity colours).
 * Exactly one transition per stage is `primary` (the natural next step) and gets
 * the solid fill; the rest use soft tints so a single saturated action leads.
 */
export const BAND_TRANSITIONS: Record<
  BandStatus,
  { label: string; next: BandStatus; className: string; primary?: boolean }[]
> = {
  new: [
    { label: "Start Review", next: "reviewing", primary: true, className: "bg-amber-500 hover:bg-amber-600 text-white" },
    { label: "Send Offer", next: "offered", className: "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200" },
    { label: "Decline", next: "declined", className: "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200" },
  ],
  reviewing: [
    { label: "Send Offer", next: "offered", primary: true, className: "bg-purple-600 hover:bg-purple-700 text-white" },
    { label: "Decline", next: "declined", className: "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200" },
  ],
  offered: [
    { label: "Mark Booked", next: "booked", primary: true, className: "bg-green-600 hover:bg-green-700 text-white" },
    { label: "Back to Review", next: "reviewing", className: "bg-white hover:bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]" },
    { label: "Decline", next: "declined", className: "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200" },
  ],
  booked: [
    { label: "Decline", next: "declined", className: "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200" },
  ],
  declined: [
    { label: "Reopen", next: "reviewing", className: "bg-white hover:bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]" },
  ],
};

/** Success-toast copy per destination status. */
const STATUS_TOAST: Record<BandStatus, string> = {
  new: "Moved to New",
  reviewing: "Moved to Reviewing",
  offered: "Offer sent",
  booked: "Booking confirmed",
  declined: "Application declined",
};

/** Per-platform brand colours (icon + button) for the social links. */
const SOCIAL_META: Record<string, { icon: React.ElementType; className: string; label: string }> = {
  instagram: {
    icon: SiInstagram,
    className: "bg-linear-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white border-transparent",
    label: "Instagram",
  },
  facebook: { icon: SiFacebook, className: "bg-[#1877F2] text-white border-transparent", label: "Facebook" },
  youtube: { icon: SiYoutube, className: "bg-[#FF0000] text-white border-transparent", label: "YouTube" },
  tiktok: { icon: SiTiktok, className: "bg-black text-white border-transparent", label: "TikTok" },
};

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

/** Pipeline order for the header stepper. `declined` is a terminal exit, not a stage. */
const PIPELINE: BandStatus[] = ["new", "reviewing", "offered", "booked"];

/**
 * Compact horizontal stepper showing where a request sits in the pipeline.
 * Past stages get a check, the current stage gets its statusTheme tint, and
 * future stages stay muted. Hidden for declined requests (the header badge
 * already tells that story). Labels collapse to dots on mobile except the
 * current stage.
 */
function StageStepper({ status }: { status: string }) {
  const idx = PIPELINE.indexOf(status as BandStatus);
  if (idx === -1) return null;
  return (
    <div
      className="mt-3 flex items-center gap-1"
      aria-label={`Stage ${idx + 1} of ${PIPELINE.length}: ${statusTheme[status]?.label ?? status}`}
    >
      {PIPELINE.map((s, i) => {
        const t = statusTheme[s];
        const isCurrent = i === idx;
        const isPast = i < idx;
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <div className={cn("h-px min-w-2 flex-1", isPast || isCurrent ? "bg-[#5C4033]/25" : "bg-[#E6DFC8]")} />
            )}
            <div
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1",
                isCurrent && cn(t.bg, t.text, t.border),
                isPast && "border-[#E6DFC8] bg-white text-[#5F624F]",
                !isCurrent && !isPast && "border-transparent text-[#5F624F]/45"
              )}
            >
              {isPast ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
              ) : (
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isCurrent ? t.dot : "bg-[#E6DFC8]")} />
              )}
              <span className={cn("font-black text-[9px] tracking-widest uppercase", !isCurrent && "hidden sm:inline")}>
                {t.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SheetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
      <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
        {label}
      </span>
      <span className="text-right text-sm font-bold text-[#1F1F1A]">{value || "—"}</span>
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
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  type?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  readOnlyValue?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
      <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">{label}</span>
      {!editable ? (
        <span className="min-w-0 flex-1 truncate text-right text-sm font-bold text-[#1F1F1A]">{readOnlyValue ?? (value || "—")}</span>
      ) : options ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 cursor-pointer bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none [text-align-last:right]"
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
          className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
        />
      )}
      {trailing}
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
    <div className={cn("overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-[#F7F4EA] px-4 py-3 text-left transition-colors hover:bg-[#F0EDE0] sm:px-5"
      >
        <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div className={cn(!open && "hidden")}>{children}</div>
    </div>
  );
}

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/** Payment status is derived from amount vs paid — never set by hand. */
function derivePaymentStatus(amount: number, paid: number): string {
  if (!(amount > 0)) return "no_payment";
  if (paid > amount) return "over_paid";
  if (paid >= amount) return "paid";
  if (paid > 0) return "partially_paid";
  return "unpaid";
}

const PAYMENT_STATUS_META: Record<string, { label: string; className: string }> = {
  no_payment: { label: "No payment", className: "bg-gray-100 border-gray-200 text-gray-600" },
  unpaid: { label: "Unpaid", className: "bg-amber-50 border-amber-200 text-amber-700" },
  partially_paid: { label: "Partially paid", className: "bg-blue-50 border-blue-200 text-blue-700" },
  paid: { label: "Paid", className: "bg-green-50 border-green-200 text-green-700" },
  over_paid: { label: "Over paid", className: "bg-purple-50 border-purple-200 text-purple-700" },
};

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
  // Footer "note to applicant" is tucked away unless one already exists.
  const [noteOpen, setNoteOpen] = useState(() => !!(request.admin_notes || "").trim());
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
  const [bandNotes, setBandNotes] = useState(request.band_notes ?? "");
  const [paymentAmount, setPaymentAmount] = useState(request.payment_amount != null ? String(request.payment_amount) : "");
  const [paidAmount, setPaidAmount] = useState(request.paid_amount != null ? String(request.paid_amount) : "");
  const [bankAccountName, setBankAccountName] = useState(request.bank_account_name ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(request.bank_account_no ?? "");
  const [bankSortCode, setBankSortCode] = useState(request.bank_sort_code ?? "");
  const [bankPaymentRef, setBankPaymentRef] = useState(request.bank_payment_ref ?? "");

  const status = normStatus(request.status);
  const theme = statusTheme[status] || statusTheme.new;
  const editable = status !== "declined";

  // A selected slot exists to show once one has been offered or booked.
  const hasSlot = status === "offered" || status === "booked";
  // Triage stages where the admin picks a slot and the note-to-applicant shows.
  const isWorkingStage = status === "new" || status === "reviewing" || status === "offered";

  const socials = request.social_links
    ? Object.entries(request.social_links).filter(([, v]) => v)
    : [];
  const videos = (request.video_urls ?? []).filter(Boolean);
  const dates = (request.preferred_dates ?? []).filter(Boolean);

  // Payment status is derived live from the amount + paid inputs, never edited.
  const amountNum = paymentAmount === "" ? 0 : Number(paymentAmount) || 0;
  const paidNum = paidAmount === "" ? 0 : Number(paidAmount) || 0;
  const derivedStatus = derivePaymentStatus(amountNum, paidNum);
  const isNoPayment = derivedStatus === "no_payment";
  // Collapse Payment Details by default when the saved record has no fee yet.
  const initialPaymentOpen =
    derivePaymentStatus(request.payment_amount ?? 0, request.paid_amount ?? 0) !== "no_payment";

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
    bandNotes !== (request.band_notes ?? "") ||
    paymentAmount !== (request.payment_amount != null ? String(request.payment_amount) : "") ||
    paidAmount !== (request.paid_amount != null ? String(request.paid_amount) : "") ||
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
    band_notes: bandNotes || null,
    payment_amount: paymentAmount === "" ? null : Number(paymentAmount),
    paid_amount: paidAmount === "" ? null : Number(paidAmount),
    payment_status: derivedStatus,
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
    setBandNotes(request.band_notes ?? "");
    setPaymentAmount(request.payment_amount != null ? String(request.payment_amount) : "");
    setPaidAmount(request.paid_amount != null ? String(request.paid_amount) : "");
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
        // Booking places an event — block it if the slot clashes. The clashes
        // render inline under the Performance Time field, so no footer error here.
        if (newStatus === "booked") {
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
        const result = await updateBandStatus(request.id, newStatus, adminNotes || undefined);
        setOpen(false);
        // offered / booked / declined email the band; new / reviewing are silent.
        const emails = newStatus === "offered" || newStatus === "booked" || newStatus === "declined";
        const done = STATUS_TOAST[newStatus];
        if (emails) {
          if (result?.emailError) {
            toast.error(`${done}, but the email didn't send: ${result.emailError}`);
          } else {
            toast.success(`${done} — band emailed`);
          }
        } else {
          toast.success(done);
        }
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
        if (status !== "booked") {
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
              "This moves the booking back to Offered, takes the linked event off the schedule, and emails the band to re-confirm. Preview:",
            confirmLabel: "Update & Email",
            content: (
              <div className="space-y-1.5 rounded-xl border border-[#E6DFC8] bg-white p-3 text-left">
                <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  To: {request.email}
                </p>
                <p className="font-black text-xs text-[#1F1F1A]">{preview.subject}</p>
                <p className="text-xs text-[#5F624F]">{preview.greeting}</p>
                {preview.body.map((p, i) => (
                  <p key={i} className="text-xs leading-relaxed text-[#5F624F]">{p}</p>
                ))}
                {preview.dateLabel && (
                  <div className="mt-1 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2">
                    <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">New Slot</p>
                    <p className="font-black text-sm text-[#1F1F1A]">{preview.dateLabel}</p>
                    {preview.timeLabel && (
                      <p className="text-xs font-bold text-[#5F624F]">{preview.timeLabel}</p>
                    )}
                  </div>
                )}
              </div>
            ),
          });
          if (!ok) return;

          await updateBandBookingFields(request.id, detailFields());
          const result = await rescheduleConfirmedBooking(request.id, {
            selected_date: selectedDate || null,
            selected_start_time: selectedStartTime || null,
            selected_end_time: selectedEndTime || null,
            admin_notes: adminNotes || null,
          });
          if (result?.emailError) {
            toast.error(`Booking updated, but the email didn't send: ${result.emailError}`);
          } else {
            toast.success("Booking updated — band notified");
          }
          setOpen(false);
          return;
        }

        // Confirmed, detail-only change → confirm, then save.
        const ok = await confirm({
          title: "Save changes?",
          description:
            "This booking is booked — saving updates its details and the linked event.",
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
          "w-full overflow-hidden rounded-2xl border-2 border-[#E6DFC8] bg-white",
          "flex items-center gap-3 px-3 py-3.5 text-left",
          "shadow-sm transition-all hover:bg-[#F7F4EA]/60 active:scale-[0.98]"
        )}
      >
        {/* Status badge circle (left) */}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border",
            theme.bg,
            theme.text,
            theme.border
          )}
        >
          {hasSlot && request.selected_date ? (
            <div className="flex flex-col items-center justify-center leading-none">
              <span className="mb-0.5 font-black text-[10px] tracking-tighter uppercase opacity-80">
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
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-black text-sm tracking-tight text-[#1F1F1A] uppercase">
              {request.group_name || request.booker_name}
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[#5F624F]">
            <p className="truncate text-xs font-semibold">{request.booker_name}</p>
            {(request.type || request.genre) && (
              <span className="truncate text-[10px] font-bold opacity-60">
                {[toTitleCase(request.type), toTitleCase(request.genre)].filter(Boolean).join(" / ")}
              </span>
            )}
          </div>

          {/* Schedule — offered/booked → selected slot; otherwise → applicant's preferred dates */}
          {(hasSlot ? !!request.selected_date : dates.length > 0) ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-semibold text-[#5F624F]">
              {hasSlot ? (
                request.selected_date && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {format(new Date(request.selected_date + "T00:00:00"), "EEE, d MMM")}
                    {(request.selected_start_time || request.selected_end_time) && (
                      <span className="text-[#5F624F]/80">
                        · {[toHHMM(request.selected_start_time), toHHMM(request.selected_end_time)].filter(Boolean).join("–")}
                      </span>
                    )}
                  </span>
                )
              ) : (
                dates.length > 0 && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {dates.slice(0, 2).map((d) => format(new Date(d + "T00:00:00"), "d MMM")).join(", ")}
                      {dates.length > 2 ? ` +${dates.length - 2}` : ""}
                    </span>
                  </span>
                )
              )}
            </div>
          ) : null}
        </div>

        {/* Right column: media count (top, above the arrow) + payment pill (end) */}
        <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
          {videos.length > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5F624F]"
              title={`${videos.length} video${videos.length === 1 ? "" : "s"} attached`}
            >
              <Video className="h-3.5 w-3.5 shrink-0" />
              {videos.length}
            </span>
          )}
          {(() => {
            const amount = request.payment_amount ?? 0;
            const isFree = !(amount > 0);
            return (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-black text-[10px] tracking-tight uppercase",
                  isFree ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"
                )}
              >
                {isFree ? "Free" : `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
              </span>
            );
          })()}
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-[#5F624F]/50" />
      </button>

      {/* Bottom sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bottom-6 left-1/2 flex h-[85vh] h-auto max-h-[80vh] w-4xl w-140 -translate-x-1/2 flex-col rounded-4xl rounded-t-[2.5rem] border-2 border-t-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl outline-none sm:inset-x-auto lg:max-h-[90vh]"
        >
          {/* Sheet header */}
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-lg leading-tight tracking-tight text-[#1F1F1A] uppercase">
                  {request.group_name || request.booker_name}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Review and manage this band request.
                </SheetDescription>
                {request.group_name && (
                  <p className="mt-0.5 text-xs text-[#5F624F]">{request.booker_name}</p>
                )}
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-black text-[10px] tracking-wider uppercase",
                  theme.bg,
                  theme.text,
                  theme.border
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
                {theme.label}
              </span>
            </div>
            <StageStepper status={status} />
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 py-4 py-6 sm:px-6">
            <div className="animate-in grid-cols-[minmax(0,1fr)_340px] items-start gap-5 space-y-0 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid">
              {/* Main column — the workflow: event, payment, notes */}
              <div className="min-w-0 space-y-4 sm:space-y-5">
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
                  <div className="border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
                    <span className="mb-2 block font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
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
                              "rounded-xl border px-3 py-1.5 text-xs font-bold transition-all",
                              isSelected
                                ? "border-[#5C4033] bg-[#5C4033] text-white"
                                : "border-[#E6DFC8] bg-white text-[#1F1F1A] hover:border-[#5C4033]/30",
                              !editable && "cursor-not-allowed opacity-60"
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
                <div className="border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                      Selected Date
                    </span>
                    {editable ? (
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 text-sm font-bold text-[#1F1F1A] transition-colors hover:text-[#5C4033]"
                          >
                            {selectedDate
                              ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy")
                              : "Pick a date"}
                            <CalendarDays className="h-4 w-4 shrink-0 text-[#5F624F]/60" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-auto rounded-2xl border-2 border-[#E6DFC8] bg-white p-0">
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
                      <span className="text-right text-sm font-bold text-[#1F1F1A]">
                        {selectedDate ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy") : "—"}
                      </span>
                    )}
                  </div>
                  {isWorkingStage && !selectedDate && (
                    <FieldMessage warning="Pick a date before you can book." />
                  )}
                </div>

                {/* Selected time — label + start/end on one row (24h, matching the event view) */}
                <div className="border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                      Selected Time
                    </span>
                    {editable ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          aria-label="Performance start time"
                          value={selectedStartTime}
                          onChange={(e) => applyStart(e.target.value)}
                          className="bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none"
                        />
                        <span className="text-xs text-[#5F624F]/50">-</span>
                        <input
                          type="time"
                          aria-label="Performance end time"
                          value={selectedEndTime}
                          onChange={(e) => {
                            setSelectedEndTime(e.target.value);
                            setClashes([]);
                          }}
                          className="bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none"
                        />
                      </div>
                    ) : (
                      <span className="text-right text-sm font-bold text-[#1F1F1A]">
                        {selectedStartTime || selectedEndTime ? `${selectedStartTime} - ${selectedEndTime}` : "—"}
                      </span>
                    )}
                  </div>
                  {isWorkingStage && (!selectedStartTime || !selectedEndTime) && (
                    <FieldMessage warning="Set a start and end time before you can book." />
                  )}
                  {clashes.length > 0 && (
                    <div className="mt-2">
                      <ClashList clashes={clashes} />
                    </div>
                  )}
                </div>

                {/* Notes from the booking (applicant) — read-only; hidden when blank */}
                {request.notes && request.notes.trim() && (
                  <div className="border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
                    <span className="mb-1.5 block font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                      Notes from Booking
                    </span>
                    <p className="text-sm leading-relaxed text-[#1F1F1A] italic">
                      &quot;{request.notes}&quot;
                    </p>
                  </div>
                )}
              </Section>

              {/* Payment Details section */}
              {(editable || (request.payment_amount ?? 0) > 0) && (
                <Section title="Payment Details" defaultOpen={initialPaymentOpen}>
                  {/* Amount */}
                  <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
                    <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Amount</span>
                    {editable ? (
                      <div className="flex flex-1 items-center justify-end gap-1">
                        <span className="text-sm font-bold text-[#5F624F]">£</span>
                        <input
                          aria-label="Amount"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="w-24 bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
                        />
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-bold text-[#1F1F1A]">
                        <CreditCard className="h-3.5 w-3.5 text-[#5F624F] opacity-50" />
                        £{(request.payment_amount ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* Paid — hidden when there is no payment */}
                  {!isNoPayment && (
                    <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
                      <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Paid</span>
                      {editable ? (
                        <div className="flex flex-1 items-center justify-end gap-1">
                          <span className="text-sm font-bold text-[#5F624F]">£</span>
                          <input
                            aria-label="Paid"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            className="w-24 bg-transparent text-right text-sm font-bold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
                          />
                        </div>
                      ) : (
                        <span className="text-right text-sm font-bold text-[#1F1F1A]">£{(request.paid_amount ?? 0).toFixed(2)}</span>
                      )}
                    </div>
                  )}
                  {/* Status — derived from amount vs paid, never edited */}
                  <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2.5 py-3 last:border-0 sm:px-5">
                    <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Status</span>
                    <span className={cn("rounded-lg border px-2 py-1 font-black text-[10px] tracking-tight uppercase", PAYMENT_STATUS_META[derivedStatus].className)}>
                      {PAYMENT_STATUS_META[derivedStatus].label}
                    </span>
                  </div>
                  {/* Bank details — hidden when there is no payment */}
                  {!isNoPayment && (
                    <>
                      <EditRow label="Account Name" value={bankAccountName} onChange={setBankAccountName} editable={editable} placeholder="—" />
                      <EditRow label="Account No." value={bankAccountNo} onChange={setBankAccountNo} editable={editable} placeholder="—" />
                      <EditRow label="Sort Code" value={bankSortCode} onChange={setBankSortCode} editable={editable} placeholder="—" />
                      <EditRow label="Payment Ref" value={bankPaymentRef} onChange={setBankPaymentRef} editable={editable} placeholder="—" />
                    </>
                  )}
                </Section>
              )}

              {/* Band Notes — admin factbox for notes about the band */}
              <Section title="Band Notes">
                {editable ? (
                  <div className="px-4 py-3 sm:px-5">
                    <textarea
                      aria-label="Band notes"
                      value={bandNotes}
                      onChange={(e) => setBandNotes(e.target.value)}
                      rows={3}
                      placeholder="Add notes about the band..."
                      className="w-full resize-none rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] px-4 py-3 text-sm text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
                    />
                  </div>
                ) : (
                  <p className="px-4 py-3 text-sm leading-relaxed text-[#1F1F1A] italic sm:px-5">
                    {bandNotes ? `“${bandNotes}”` : "—"}
                  </p>
                )}
              </Section>

              {/* Admin notes (read-only once booked/declined; editable in the working-stage footer) */}
              {!isWorkingStage && request.admin_notes && (
                <Section title="Admin Notes">
                  <div className="px-4 py-3 sm:px-5">
                    <div className="rounded-2xl border border-[#5C4033]/15 bg-[#5C4033]/5 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <MessageSquareQuote className="h-4 w-4 text-[#5C4033] opacity-40" />
                        <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">Staff Note</span>
                      </div>
                      <p className="text-sm leading-relaxed text-[#1F1F1A] italic">
                        &quot;{request.admin_notes}&quot;
                      </p>
                    </div>
                  </div>
                </Section>
              )}
              </div>

              {/* Side rail — reference info: contact, socials, media, audit */}
              <div className="min-w-0 space-y-4 sm:space-y-5">
              {/* Contact info */}
              <Section title="Contact Information">
                <EditRow label="Name" value={bookerName} onChange={setBookerName} editable={editable} placeholder="Contact name" />
                <EditRow
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  editable={editable}
                  type="email"
                  placeholder="email@example.com"
                  trailing={
                    email.trim() ? (
                      <a
                        href={`mailto:${email.trim()}`}
                        title={`Email ${email.trim()}`}
                        aria-label={`Email ${email.trim()}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] text-[#5C4033] transition-colors hover:bg-[#5C4033] hover:text-white"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    ) : undefined
                  }
                />
                <EditRow
                  label="Phone"
                  value={phone}
                  onChange={setPhone}
                  editable={editable}
                  type="tel"
                  placeholder="Phone number"
                  trailing={
                    phone.trim() ? (
                      <a
                        href={`tel:${phone.replace(/\s+/g, "")}`}
                        title={`Call ${phone.trim()}`}
                        aria-label={`Call ${phone.trim()}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] text-[#5C4033] transition-colors hover:bg-[#5C4033] hover:text-white"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    ) : undefined
                  }
                />
              </Section>

              {/* Social links */}
              {socials.length > 0 && (
                <Section title="Social Media">
                  <div className="flex flex-wrap gap-2 px-4 py-3 sm:px-5">
                    {socials.map(([key, url]) => {
                      const meta = SOCIAL_META[key];
                      const Icon = meta?.icon ?? Link2;
                      return (
                        <a
                          key={key}
                          href={url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-opacity hover:opacity-90",
                            meta?.className ?? "border-[#E6DFC8] bg-white text-[#5C4033]"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {meta?.label ?? key.charAt(0).toUpperCase() + key.slice(1)}
                        </a>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Linked Event navigation */}
              {request.event_id && (
                <Link
                  href={`/event-setups/events?open=${request.event_id}`}
                  className="group flex h-fit items-center justify-between gap-3 rounded-3xl border-2 border-[#E6DFC8] bg-white px-4 py-3.5 transition-colors hover:bg-[#F7F4EA] sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 shrink-0 text-[#5C4033]" />
                    <span className="font-black text-xs tracking-wide text-[#5C4033] uppercase">
                      View Linked Event
                    </span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#5F624F] transition-colors group-hover:text-[#5C4033]" />
                </Link>
              )}

              {/* Videos — play inline on the page (facade: loads on click) */}
              {videos.length > 0 && (
                <Section title="Performance Videos">
                  <div className="grid grid-cols-1 gap-3 px-4 px-5 py-3 sm:grid-cols-2 lg:grid-cols-1">
                    {videos.map((url, i) => (
                      <VideoFacade key={i} url={url} title={`Video ${i + 1}`} />
                    ))}
                  </div>
                </Section>
              )}

              {/* System information — audit trail; collapsed by default */}
              <Section title="System Information" defaultOpen={false}>
                <SheetRow label="Submitted" value={formatDateTime(request.created_at)} />
                <SheetRow label="Last Modified" value={formatDateTime(request.updated_at)} />
                <SheetRow label="Modified By" value={request.updated_by_employee?.full_name || "—"} />
              </Section>
              </div>
            </div>
            <div className="h-4" />
          </div>

          {/* Footer — compact single row: Cancel (left), stage transitions with one
              primary action (right), Save only once something changed. The note to
              the applicant is tucked behind a toggle since it's optional. */}
          <div className="z-40 shrink-0 rounded-b-4xl border-t-2 border-[#E6DFC8] bg-white/80 px-4 py-4 pb-4 pb-9 backdrop-blur-md sm:px-6">
            {/* Action area — editable stages (new / reviewing / offered / booked).
                A declined request is read-only, so no footer. */}
            {editable && (
              <div className="space-y-3">
                <div>
                  <button
                    type="button"
                    onClick={() => setNoteOpen((o) => !o)}
                    aria-expanded={noteOpen}
                    className="flex items-center gap-1.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase transition-colors hover:text-[#5C4033]"
                  >
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    Note to Applicant {adminNotes.trim() && !noteOpen ? "(added)" : "(optional)"}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", noteOpen && "rotate-180")} />
                  </button>
                  {noteOpen && (
                    <textarea
                      aria-label="Note to applicant"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add a message to include in the offer / outcome email..."
                      rows={2}
                      className="mt-2 w-full resize-none rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] px-4 py-3 text-sm text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
                    />
                  )}
                </div>

                {error && <p className="text-xs font-bold text-red-500">{error}</p>}

                {/* Cancel left, stage transitions right (primary last), Save when dirty.
                    Booking needs a full slot, mirroring the old Confirm guard, so an
                    event is always placed when booked. */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="mr-auto flex h-11 flex-1 items-center justify-center rounded-xl border-2 border-[#E6DFC8] bg-white px-4 px-5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA] disabled:opacity-50 sm:flex-initial"
                  >
                    Cancel
                  </button>
                  {[...(BAND_TRANSITIONS[status as BandStatus] ?? [])]
                    .sort((a, b) => (a.primary ? 1 : 0) - (b.primary ? 1 : 0))
                    .map((t) => {
                      const needsSlot =
                        t.next === "booked" && (!selectedDate || !selectedStartTime || !selectedEndTime);
                      return (
                        <button
                          key={t.next + t.label}
                          type="button"
                          onClick={() => handleAction(t.next)}
                          disabled={isPending || needsSlot}
                          title={needsSlot ? "Set a date, start and end time before booking" : undefined}
                          className={cn(
                            "flex h-11 min-w-24 flex-1 items-center justify-center gap-2 rounded-xl px-4 font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:flex-initial sm:px-5",
                            t.className
                          )}
                        >
                          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.label}
                        </button>
                      );
                    })}
                  {hasChanges && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isPending}
                      className="flex h-11 min-w-24 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1B4332] px-4 px-5 font-black text-[10px] tracking-widest text-white uppercase shadow-lg transition-all hover:bg-[#1B4332]/85 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:flex-initial"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Changes
                    </button>
                  )}
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
    <p className={cn("mt-2 flex items-center gap-1 text-[11px] leading-snug font-bold", isWarning ? "text-amber-600" : "text-red-600")}>
      {isWarning ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
      {message}
    </p>
  );
}

function ClashList({ clashes }: { clashes: ClashEvent[] }) {
  if (clashes.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-red-200 bg-red-50 p-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
        <p className="font-black text-[10px] tracking-tight text-red-700 uppercase">
          Time slot full — conflicts with:
        </p>
      </div>
      <ul className="list-disc space-y-0.5 pl-6">
        {clashes.map((c) => (
          <li key={c.id} className="text-[11px] font-bold text-red-700">
            {c.title} ({c.start} - {c.end})
          </li>
        ))}
      </ul>
    </div>
  );
}
