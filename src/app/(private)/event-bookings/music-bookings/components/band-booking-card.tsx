"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { updateBandStatus, updateBandBookingFields, getClashingEvents, rescheduleConfirmedBooking, toggleBandFavorite } from "../actions";
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
  Heart,
  Hash,
  Copy,
  NotebookPen,
  Info,
  Pencil,
  X,
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
import { buildRescheduleEmail, buildOfferEmail, buildOutcomeEmail, type BandEmail } from "@/lib/band-emails";

const DEFAULT_START_TIME = "22:00"; // 10pm

/** Applicant's booking note collapses to this many characters behind a "…" toggle. */
const NOTE_PREVIEW_LEN = 50;

/** Preferred-date pills shown before the "Show all" toggle takes over. */
const PREFERRED_DATES_VISIBLE = 4;

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
  /** Parallel to `video_urls` — the applicant's short description per video. */
  video_descriptions: string[] | null;
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

/** Fixed pill order — every platform always shows, filled or not. */
const SOCIAL_ORDER: (keyof SocialLinks)[] = ["instagram", "facebook", "youtube", "tiktok"];

/**
 * Trimmed, blank-dropped links in a stable key order. Emptying a field clears the
 * key rather than persisting "", and the stable order makes two normalised objects
 * safe to compare with JSON.stringify for the dirty check.
 */
function normalizeSocials(links: SocialLinks | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SOCIAL_ORDER) {
    const value = (links?.[key] ?? "").trim();
    if (value) out[key] = value;
  }
  return out;
}

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

/** Pipeline order for the header stepper. `declined` is a terminal exit, not a stage. */
const PIPELINE: BandStatus[] = ["new", "reviewing", "offered", "booked"];

/**
 * The pipeline, as the control. Past stages get a check, the current stage gets
 * its statusTheme tint, future stages stay muted — and any stage reachable from
 * the current one is a button that moves the request there. Reachability comes
 * straight from BAND_TRANSITIONS, so this stays in step with the state machine
 * without restating it.
 *
 * A terminal exit (declined) isn't a pipeline stage, so it renders as its own
 * chip alongside whatever it can reach — which is what makes "Reopen" reachable.
 */
type StageTone = "current" | "past" | "future";

/**
 * One stage chip. Declared at module scope (not inside StageStepper) so React
 * keeps the same component type across renders instead of remounting it.
 * A reachable stage is a live button; everything else is inert but explains why.
 */
function StageChip({
  stage,
  tone,
  reason,
  isPending,
  anyPending,
  onSelect,
  onBlockedClick,
}: {
  stage: BandStatus;
  tone: StageTone;
  /** Why this stage can't be clicked; null when it can. */
  reason: string | null;
  isPending: boolean;
  /** Some stage is mid-flight — freeze the whole row. */
  anyPending: boolean;
  onSelect: (next: BandStatus) => void;
  /**
   * Given when the block is something the admin can fix right now — the chip
   * stays live and points at the fix instead of being a dead end.
   */
  onBlockedClick?: () => void;
}) {
  const t = statusTheme[stage];
  const interactive = tone !== "current" && !reason;
  const nudges = !interactive && tone !== "current" && !!onBlockedClick;

  return (
    <button
      type="button"
      disabled={anyPending || (!interactive && !nudges)}
      onClick={() => (interactive ? onSelect(stage) : onBlockedClick?.())}
      title={reason ?? `Move to ${t.label}`}
      aria-current={tone === "current" ? "step" : undefined}
      // Still announced as unavailable — it just explains itself when clicked.
      aria-disabled={!interactive || undefined}
      className={cn(
        "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-2.5 transition-all sm:h-8",
        tone === "current" && cn(t.bg, t.text, t.border),
        tone === "past" && "border-[#E6DFC8] bg-white text-[#5F624F]",
        tone === "future" && "border-transparent text-[#5F624F]/45",
        // A reachable stage advertises itself; an unreachable one stays flat.
        interactive
          ? cn(
              "cursor-pointer hover:brightness-95",
              tone === "future" && "border-dashed border-[#5C4033]/30 text-[#5C4033]"
            )
          : nudges
            ? "cursor-pointer border-dashed border-amber-300 text-amber-600/70 hover:bg-amber-50 hover:text-amber-700"
            : "cursor-default"
      )}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      ) : tone === "past" ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
      ) : (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone === "current" ? t.dot : "bg-[#E6DFC8]")} />
      )}
      <span className="font-black text-[9px] tracking-widest uppercase">{t.label}</span>
    </button>
  );
}

function StageStepper({
  status,
  onSelect,
  pendingStage,
  blockers,
  onRevealSlot,
}: {
  status: string;
  onSelect: (next: BandStatus) => void;
  /** Stage currently being applied — shows a spinner on that chip. */
  pendingStage: BandStatus | null;
  /**
   * Per-stage reasons a transition can't happen yet, beyond what the state
   * machine allows. Every one of these is fixable in the slot console, so a
   * blocked chip points there rather than sitting dead.
   */
  blockers: Partial<Record<BandStatus, string | undefined>>;
  /** Points the admin at the slot console when a stage is blocked only by it. */
  onRevealSlot: () => void;
}) {
  const transitions = BAND_TRANSITIONS[status as BandStatus] ?? [];
  const currentLabel = statusTheme[status]?.label ?? status;
  const reachable = (s: BandStatus) => transitions.some((t) => t.next === s);

  // Allowed by the state machine, then clear of any slot problem.
  const blockedReason = (s: BandStatus): string | null => {
    if (!reachable(s)) return `Not available from ${currentLabel}`;
    return blockers[s] ?? null;
  };

  /** A chip per stage — `reason` null means it's reachable, so it's a button. */
  const chip = (s: BandStatus, tone: StageTone) => {
    // Reachable but slot-blocked → keep it live and send them to the fix.
    const slotFixable = reachable(s) && !!blockers[s];
    return (
      <StageChip
        key={s}
        stage={s}
        tone={tone}
        reason={tone === "current" ? "Current stage" : blockedReason(s)}
        isPending={pendingStage === s}
        anyPending={!!pendingStage}
        onSelect={onSelect}
        onBlockedClick={slotFixable ? onRevealSlot : undefined}
      />
    );
  };

  const idx = PIPELINE.indexOf(status as BandStatus);

  // Off-pipeline (declined): its own chip, plus whatever it can reach.
  if (idx === -1) {
    const t = statusTheme[status];
    if (!t) return null;
    const exits = transitions.filter((tr) => PIPELINE.includes(tr.next));
    return (
      <div className="no-scrollbar mt-3 flex items-center gap-1 overflow-x-auto" aria-label={`Status: ${t.label}`}>
        {chip(status as BandStatus, "current")}
        {exits.map((tr) => (
          <React.Fragment key={tr.next}>
            <div className="h-px min-w-2 flex-1 bg-[#E6DFC8]" />
            {chip(tr.next, "future")}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      className="no-scrollbar mt-3 flex items-center gap-1 overflow-x-auto"
      aria-label={`Stage ${idx + 1} of ${PIPELINE.length}: ${currentLabel}`}
    >
      {PIPELINE.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && (
            <div className={cn("h-px min-w-2 flex-1", i <= idx ? "bg-[#5C4033]/25" : "bg-[#E6DFC8]")} />
          )}
          {chip(s, i === idx ? "current" : i < idx ? "past" : "future")}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Renders exactly what the band is about to receive, for the confirm dialogs.
 * Reads a built BandEmail, so the preview can't drift from the sent message.
 */
function EmailPreview({ email, to, slotLabel = "Slot" }: { email: BandEmail; to: string; slotLabel?: string }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-[#E6DFC8] bg-white p-3 text-left">
      <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">To: {to}</p>
      <p className="font-black text-xs text-[#1F1F1A]">{email.subject}</p>
      <p className="text-xs text-[#5F624F]">{email.greeting}</p>
      {email.body.map((p, i) => (
        <p key={i} className="text-xs leading-relaxed text-[#5F624F]">{p}</p>
      ))}
      {(email.dateLabel || email.slotLabel) && (
        <div className="mt-1 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2">
          <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">{slotLabel}</p>
          <p className="font-black text-sm text-[#1F1F1A]">{email.slotLabel || email.dateLabel}</p>
          {!email.slotLabel && email.timeLabel && (
            <p className="text-xs font-bold text-[#5F624F]">{email.timeLabel}</p>
          )}
          {email.feeLabel && <p className="mt-1 text-xs font-bold text-[#5F624F]">{email.feeLabel}</p>}
        </div>
      )}
      {email.noteLabel && (
        <div className="mt-1 rounded-lg border-l-4 border-[#5C4033] bg-[#F7F4EA] px-3 py-2">
          <p className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Note from our team</p>
          <p className="text-xs leading-relaxed text-[#1F1F1A]">{email.noteLabel}</p>
        </div>
      )}
    </div>
  );
}

function SheetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
        {label}
      </span>
      <span className="text-right text-[13px] font-semibold text-[#1F1F1A]">{value || "—"}</span>
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
    <div className="flex items-center justify-between gap-3 border-b border-[#E6DFC8] px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">{label}</span>
      {!editable ? (
        <span className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold text-[#1F1F1A]">{readOnlyValue ?? (value || "—")}</span>
      ) : options ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 cursor-pointer bg-transparent text-right text-[13px] font-semibold text-[#1F1F1A] outline-none [text-align-last:right]"
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
          className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
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
  headerRight,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          // Tinted band (the border tone) against the sheet's #F7F4EA and the card's
          // white rows, so the header reads as a header rather than as surface.
          // brightness-95 darkens on hover without inventing a shade below #E6DFC8.
          "flex w-full items-center justify-between gap-3 bg-[#E6DFC8] px-4 py-3 text-left transition-all hover:brightness-95 sm:px-5",
          // Same hairline as the field-row dividers below it. Only while open, so a
          // collapsed header doesn't draw a stray line against the card's own edge.
          open && "border-b border-[#E6DFC8]"
        )}
      >
        <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">{title}</span>
        <span className="flex items-center gap-2">
          {headerRight}
          <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
        </span>
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
  /** Stage being applied — drives the spinner on that stepper chip. */
  const [pendingStage, setPendingStage] = useState<BandStatus | null>(null);
  /** Brief highlight on the slot console after a blocked Booked chip points at it. */
  const [slotFlash, setSlotFlash] = useState(false);
  const startTimeRef = useRef<HTMLInputElement>(null);
  /** Re-entry guard for the unsaved-changes prompt. */
  const askingToClose = useRef(false);

  // Favourite persists on click (not via Save), so it gets its own transition —
  // sharing `isPending` would grey out the footer actions on every heart tap.
  const [isFavorite, setIsFavorite] = useState(request.is_favorite);
  const [, startFavTransition] = useTransition();
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);

  // Editable detail fields (act, contact & payment). Seeded from the request; a
  // cancelled request is read-only, everything else can be edited.
  const [actName, setActName] = useState(request.group_name ?? "");
  const [reqType, setReqType] = useState(request.type ?? "");
  const [genre, setGenre] = useState(request.genre ?? "");
  const [bookerName, setBookerName] = useState(request.booker_name ?? "");
  const [email, setEmail] = useState(request.email ?? "");
  const [phone, setPhone] = useState(request.phone_no ?? "");
  const [bandNotes, setBandNotes] = useState(request.band_notes ?? "");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(request.social_links ?? {});
  const [socialEditorOpen, setSocialEditorOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(request.payment_amount != null ? String(request.payment_amount) : "");
  const [paidAmount, setPaidAmount] = useState(request.paid_amount != null ? String(request.paid_amount) : "");
  const [bankAccountName, setBankAccountName] = useState(request.bank_account_name ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(request.bank_account_no ?? "");
  const [bankSortCode, setBankSortCode] = useState(request.bank_sort_code ?? "");
  const [bankPaymentRef, setBankPaymentRef] = useState(request.bank_payment_ref ?? "");
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);
  // Audit trail — reference only, so it lives behind a header icon rather than
  // taking a full card slot in the rail. Mirrors the Band Notes popover.
  const [sysInfoOpen, setSysInfoOpen] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);

  const status = normStatus(request.status);
  const theme = statusTheme[status] || statusTheme.new;
  const editable = status !== "declined";

  // Applicant's note. Long ones sit on one row as a preview + "…" toggle rather
  // than pushing every other field down the sheet.
  const bookingNote = (request.notes ?? "").trim();
  const noteIsLong = bookingNote.length > NOTE_PREVIEW_LEN;
  const noteHead = bookingNote.slice(0, NOTE_PREVIEW_LEN).trimEnd();

  // Where the linked event lives, if one has been placed. Null → System
  // Information shows "—".
  const eventHref = request.event_id ? `/event-setups/events?open=${request.event_id}` : null;
  // The id is a uuid — too long to show whole. First 8 chars is a workable human
  // reference; the full value is on hover and on the clipboard.
  const shortRef = request.id.slice(0, 8).toUpperCase();

  // A selected slot exists to show once one has been offered or booked.
  const hasSlot = status === "offered" || status === "booked";
  // Triage stages where the admin picks a slot and the note-to-applicant shows.
  const isWorkingStage = status === "new" || status === "reviewing" || status === "offered";
  // No event is expected until a request is booked, so during triage an "unlinked"
  // badge would just be noise — only show it once a link exists or its absence means
  // something (booked with no event = a fault; declined = merely informational).
  const showEventBadge = !!eventHref || !isWorkingStage;
  // One consolidated slot warning. Two stacked lines (one under Date, one under
  // Time) nag without adding information, so state the precondition to book once,
  // naming only what's actually missing. Rendered below the Date+Time pair.
  const needsDate = isWorkingStage && !selectedDate;
  const needsTime = isWorkingStage && (!selectedStartTime || !selectedEndTime);
  const slotWarning =
    needsDate && needsTime
      ? "A date and time must be set to book this act."
      : needsDate
        ? "A date must be set to book this act."
        : needsTime
          ? "A start and end time must be set to book this act."
          : undefined;

  // A slot that overlaps another active event can't be committed — it would double-
  // book the venue. Blocks Save and the Booked chip until the time moves.
  const hasClashes = clashes.length > 0;
  const clashWarning = hasClashes
    ? `Clashes with ${clashes.map((c) => c.title).join(", ")} — pick another time.`
    : undefined;

  // Every platform gets a pill; unfilled ones render deactivated and can be filled
  // in. Read-only requests only show what's actually there.
  const hasAnySocial = SOCIAL_ORDER.some((k) => (socialLinks[k] ?? "").trim());
  const showSocials = editable || hasAnySocial;

  // Pair each url with its description by index *before* dropping blanks, so a
  // missing url can't shift every description onto the wrong video.
  const videos = (request.video_urls ?? [])
    .map((url, i) => ({ url, description: (request.video_descriptions ?? [])[i]?.trim() || "" }))
    .filter((v) => Boolean(v.url));
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
    JSON.stringify(normalizeSocials(socialLinks)) !== JSON.stringify(normalizeSocials(request.social_links)) ||
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
    social_links: normalizeSocials(socialLinks),
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

  /**
   * Validate the slot against the schedule as it's edited, so a clash surfaces
   * while you're still choosing rather than on the way out. Debounced — the time
   * inputs fire per keystroke. The action-time findClashes() below still runs as
   * the authoritative check; this is the live one that drives the UI.
   */
  useEffect(() => {
    if (!selectedDate || !selectedStartTime || !selectedEndTime) {
      setClashes([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const list = await getClashingEvents(selectedDate, selectedStartTime, selectedEndTime, request.event_id);
        if (!cancelled) setClashes(list);
      } catch {
        // A failed lookup shouldn't wedge the sheet — booking re-checks anyway.
        if (!cancelled) setClashes([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedDate, selectedStartTime, selectedEndTime, request.event_id]);

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

  /**
   * Guard every dismissal of the sheet (✕ / Escape / click outside): unsaved edits
   * ask to be saved or discarded first, rather than vanishing silently. Mirrors
   * `guardedClose` in the general-bookings list.
   */
  async function requestClose() {
    if (!hasChanges) {
      setOpen(false);
      return;
    }
    // The sheet stays mounted while we ask, so a second Escape would fire
    // onOpenChange again and stack another dialog over the first.
    if (askingToClose.current) return;
    askingToClose.current = true;
    try {
      // A clashing slot can't be saved at all, so don't offer a Save that would
      // quietly do nothing — discarding is the only way out that isn't "fix it".
      if (hasClashes) {
        const discard = await confirm({
          title: "Discard changes?",
          description:
            "This slot clashes with another event, so these changes can't be saved. Close and discard them?",
          confirmLabel: "Discard",
          cancelLabel: "Keep editing",
          variant: "destructive",
        });
        if (discard) handleCancel();
        return;
      }
      const save = await confirm({
        title: "Save changes?",
        description: "You've made changes to this request. Save them before closing?",
        confirmLabel: "Save changes",
        cancelLabel: "Discard",
        // Cancel means Discard here, so a stray backdrop click must not answer.
        dismissOnBackdrop: false,
      });
      // handleSave closes on success and stays put if its own confirm is backed out of.
      if (save) handleSave();
      else handleCancel();
    } finally {
      askingToClose.current = false;
    }
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
    setSocialLinks(request.social_links ?? {});
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

  // Favourite is a bookmark, not an edit — it saves on click and is deliberately
  // left alone by handleCancel. Optimistic, reverting if the write fails.
  function handleToggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    startFavTransition(async () => {
      try {
        await toggleBandFavorite(request.id, next);
      } catch {
        setIsFavorite(!next);
        toast.error("Couldn't update favourite");
      }
    });
  }

  /**
   * A blocked Booked chip points at what's missing rather than doing nothing:
   * highlight the slot console (it's always on screen — the footer doesn't
   * scroll) and open whichever control still needs filling in.
   */
  function revealSlot() {
    setSlotFlash(true);
    window.setTimeout(() => setSlotFlash(false), 1200);
    if (!selectedDate) setDatePickerOpen(true);
    else startTimeRef.current?.focus();
  }

  // Copies the *full* uuid, not the shortened form on screen.
  async function handleCopyRef() {
    try {
      await navigator.clipboard.writeText(request.id);
      toast.success("Reference copied");
    } catch {
      toast.error("Couldn't copy the reference");
    }
  }

  /**
   * The band only hears about offered / booked / declined — those get a preview
   * of the exact email before anything is sent. new / reviewing are silent, so
   * they stay one-click.
   */
  async function confirmEmail(newStatus: BandStatus): Promise<boolean> {
    const slot = {
      name: bookerName || request.booker_name,
      groupName: actName || request.group_name,
      date: selectedDate || null,
      startTime: selectedStartTime || null,
      endTime: selectedEndTime || null,
      notes: adminNotes || null,
    };

    if (newStatus === "offered") {
      return confirm({
        title: "Send offer & email band?",
        description: "The band gets this straight away and replies to accept. Preview:",
        confirmLabel: "Send & Email",
        content: (
          <EmailPreview
            email={buildOfferEmail({
              ...slot,
              paymentAmount: paymentAmount === "" ? null : Number(paymentAmount),
            })}
            to={email || request.email}
            slotLabel="Proposed Slot"
          />
        ),
      });
    }

    if (newStatus === "booked") {
      return confirm({
        title: "Book & email band?",
        description: "This confirms the band and puts the event on the schedule. Preview:",
        confirmLabel: "Book & Email",
        content: (
          <EmailPreview
            email={buildOutcomeEmail({ ...slot, outcome: "confirmed" })}
            to={email || request.email}
            slotLabel="Performance Date"
          />
        ),
      });
    }

    if (newStatus === "declined") {
      return confirm({
        title: "Decline & email band?",
        description: "This turns the application down and emails the band. Preview:",
        confirmLabel: "Decline & Email",
        variant: "destructive",
        content: (
          <EmailPreview email={buildOutcomeEmail({ ...slot, outcome: "cancelled" })} to={email || request.email} />
        ),
      });
    }

    return true;
  }

  function handleAction(newStatus: BandStatus) {
    setError(null);
    setClashes([]);
    startTransition(async () => {
      try {
        // Booking places an event, and an offer promises one — neither may commit a
        // slot that collides with something already on. Re-checked here (not just via
        // the live effect) so a clash landing between render and click still stops it.
        // The clashes render inline under the slot fields, so no footer error here.
        // Checked before the preview so we never preview an unsendable email.
        if (newStatus === "booked" || newStatus === "offered") {
          const c = await findClashes();
          if (c.length) return;
        }
        // Last chance to back out before the band is emailed. Kept outside the
        // spinner — the chip shouldn't churn while a dialog waits on the admin.
        if (!(await confirmEmail(newStatus))) return;
        setPendingStage(newStatus);
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
        // The sheet stays open on every status change — the stepper is the control
        // now, so you land on the new stage and see the result (including Declined,
        // which can be reopened straight from the stepper). Close it yourself.
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
      } finally {
        setPendingStage(null);
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
            content: <EmailPreview email={preview} to={request.email} slotLabel="New Slot" />,
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
            {/* Indicator only — the row is itself a button, so this can't be one. */}
            {isFavorite && (
              <>
                <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-500 text-rose-500" aria-hidden="true" />
                <span className="sr-only">Favourite</span>
              </>
            )}
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
      {/* Dismissals route through requestClose so unsaved edits can't slip away;
          opening stays direct. */}
      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : requestClose())}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="left-1/2 flex h-auto max-h-[90vh] w-[92vw] w-full max-w-5xl max-w-6xl -translate-x-1/2 flex-col rounded-[2.5rem] rounded-t-[2.5rem] border-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl outline-none sm:bottom-6 lg:max-h-[94vh]"
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
                {/* Reference — shortened uuid; click copies the full value */}
                <button
                  type="button"
                  onClick={handleCopyRef}
                  title={request.id}
                  aria-label={`Copy reference ${request.id}`}
                  className="group mt-1 flex items-center gap-1.5 text-[#5F624F] transition-colors hover:text-[#5C4033]"
                >
                  <Hash className="h-3 w-3 shrink-0" />
                  <span className="font-black text-xs tracking-wide uppercase tabular-nums">Ref: {shortRef}</span>
                  <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                </button>
              </div>

              {/* Linked event, then quick actions. The badge speaks to the event,
                  not the status (the stepper below carries that): green = linked and
                  navigates; red = booked but no event was ever placed, which is a
                  data fault worth shouting about; blue = nothing linked. */}
              <div className="flex shrink-0 items-center gap-1.5">
                {showEventBadge &&
                  (eventHref ? (
                    <Link
                      href={eventHref}
                      title={`View linked event #${request.event_id}`}
                      className="group inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 font-black text-[10px] tracking-wider text-green-700 uppercase transition-colors hover:bg-green-100 sm:h-9"
                    >
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {/* The label is the widest thing in the header — drop it on a
                          phone and let the colour + "#id" carry it. */}
                      <span className="hidden sm:inline">View Linked Event:</span>
                      <span className="tabular-nums">#{request.event_id}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                    </Link>
                  ) : status === "booked" ? (
                    <span
                      title="This booking is booked but has no linked event"
                      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 font-black text-[10px] tracking-wider text-red-700 uppercase sm:h-9"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Missing Linked Event
                    </span>
                  ) : (
                    <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 font-black text-[10px] tracking-wider text-blue-700 uppercase sm:h-9">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      No Linked Event
                    </span>
                  ))}

                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? "Remove from favourites" : "Mark as favourite"}
                  title={isFavorite ? "Remove from favourites" : "Mark as favourite"}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors sm:h-9 sm:w-9",
                    isFavorite
                      ? "border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100"
                      : "border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA] hover:text-rose-500"
                  )}
                >
                  <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
                </button>

                <Popover open={notesOpen} onOpenChange={setNotesOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Band notes (internal)"
                      title="Band notes (internal)"
                      className={cn(
                        "relative flex h-11 w-11 items-center justify-center rounded-xl border transition-colors sm:h-9 sm:w-9",
                        bandNotes.trim()
                          ? "border-[#5C4033]/25 bg-[#5C4033]/10 text-[#5C4033] hover:bg-[#5C4033]/15"
                          : "border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA]"
                      )}
                    >
                      <NotebookPen className="h-4 w-4" />
                      {bandNotes.trim() && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#B45309] ring-2 ring-white" />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 rounded-2xl border-2 border-[#E6DFC8] bg-white p-4">
                    <span className="mb-1.5 block font-black text-[10px] tracking-wide text-[#5C4033] uppercase">
                      Band Notes
                    </span>
                    {editable ? (
                      <textarea
                        aria-label="Band notes"
                        value={bandNotes}
                        onChange={(e) => setBandNotes(e.target.value)}
                        rows={5}
                        placeholder="Add notes about the band..."
                        className="w-full resize-none rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2.5 text-sm text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-[#1F1F1A] italic">
                        {bandNotes ? `“${bandNotes}”` : "—"}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] leading-snug text-[#5F624F]/70">
                      Internal only — never shared with the band.
                    </p>
                  </PopoverContent>
                </Popover>

                {/* System information — audit trail. Reference-only, so it sits
                    behind an icon here rather than as a card in the rail. */}
                <Popover open={sysInfoOpen} onOpenChange={setSysInfoOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="System information"
                      title="System information"
                      className="flex h-11 w-9 w-11 items-center justify-center rounded-xl border border-[#E6DFC8] bg-white text-[#5F624F] transition-colors hover:bg-[#F7F4EA] hover:text-[#5C4033] sm:h-9"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 overflow-hidden rounded-2xl border-2 border-[#E6DFC8] bg-white p-0">
                    <span className="block border-b border-[#E6DFC8] bg-[#E6DFC8] px-4 py-2.5 font-black text-[10px] tracking-wide text-[#5C4033] uppercase">
                      System Information
                    </span>
                    <SheetRow
                      label="Linked Event"
                      value={
                        eventHref ? (
                          <Link
                            href={eventHref}
                            className="group inline-flex items-center gap-1.5 font-bold text-[#5C4033] hover:underline"
                          >
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">#{request.event_id}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                          </Link>
                        ) : null
                      }
                    />
                    <SheetRow label="Submitted" value={formatDateTime(request.created_at)} />
                    <SheetRow label="Last Modified" value={formatDateTime(request.updated_at)} />
                    <SheetRow label="Modified By" value={request.updated_by_employee?.full_name || "—"} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <StageStepper
              status={status}
              onSelect={handleAction}
              pendingStage={pendingStage}
              // Booking needs a complete, clash-free slot. Offering only needs a
              // clash-free one — an offer with no slot yet is legitimate ("to be
              // arranged"), but never one we couldn't honour.
              blockers={{ booked: slotWarning ?? clashWarning, offered: clashWarning }}
              onRevealSlot={revealSlot}
            />
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 pt-3 pb-6 sm:px-6">
            <div className="animate-in grid-cols-[minmax(0,1fr)_380px] items-start gap-8 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid">
              {/* Main column — the workflow: event, payment, notes */}
              <div className="min-w-0 space-y-4 sm:space-y-5">
              {/* Event details */}
              <Section title="Event Details">
                <EditRow label="Act Name" value={actName} onChange={setActName} editable={editable} placeholder="Act name" />
                {/* Type / Genre — combined on one row (e.g. "Band / Pop"). Both stay
                    independently editable, so this can't collapse to a single field. */}
                <div className="flex items-center justify-between gap-3 border-b border-[#E6DFC8] px-4 py-2 last:border-0 sm:px-5">
                  <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Type / Genre</span>
                  {!editable ? (
                    <span className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold text-[#1F1F1A]">
                      {toTitleCase(request.type) || "—"}
                      <span className="mx-1.5 font-normal text-[#5F624F]/50">/</span>
                      {toTitleCase(request.genre) || "—"}
                    </span>
                  ) : (
                    <div className="flex min-w-0 items-center justify-end gap-1.5">
                      <select
                        aria-label="Type"
                        value={reqType}
                        onChange={(e) => setReqType(e.target.value)}
                        className="shrink-0 cursor-pointer bg-transparent text-right text-[13px] font-semibold text-[#1F1F1A] outline-none [text-align-last:right]"
                      >
                        <option value="band">Band</option>
                        <option value="singer">Singer</option>
                        <option value="dj">DJ</option>
                      </select>
                      <span className="shrink-0 text-[#5F624F]/50">/</span>
                      <input
                        aria-label="Genre"
                        type="text"
                        value={genre}
                        placeholder="Genre"
                        onChange={(e) => setGenre(e.target.value)}
                        className="field-sizing-content max-w-full min-w-12 bg-transparent text-right text-[13px] font-semibold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
                      />
                    </div>
                  )}
                </div>

                {/* Preferred dates — inline with the label. Only the first few show;
                    a toggle expands the rest onto wrapped rows. The chosen slot always
                    leads, so it can never fall past the cut-off. */}
                {dates.length > 0 && (() => {
                  const orderedDates =
                    selectedDate && dates.includes(selectedDate)
                      ? [selectedDate, ...dates.filter((d) => d !== selectedDate)]
                      : dates;
                  const canExpand = orderedDates.length > PREFERRED_DATES_VISIBLE;
                  const shownDates = showAllDates
                    ? orderedDates
                    : orderedDates.slice(0, PREFERRED_DATES_VISIBLE);
                  const pills = shownDates.map((d) => {
                    // Matches the chosen slot date. Once booked, the pills lock
                    // (inactive), keeping the matched date visibly highlighted.
                    const isSelected = !!selectedDate && selectedDate === d;
                    const locked = status === "booked" && !!selectedDate;
                    const interactive = editable && !locked;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={!interactive}
                        onClick={() => applyDate(isSelected ? "" : d)}
                        className={cn(
                          "shrink-0 rounded-lg border px-2 py-1 text-[11px] font-bold whitespace-nowrap transition-all",
                          locked
                            ? isSelected
                              ? "border-[#1B4332]/30 bg-[#1B4332]/10 text-[#1B4332]/80"
                              : "border-[#E6DFC8] bg-[#E6DFC8]/40 text-[#5F624F]/60"
                            : isSelected
                              ? "border-[#1B4332] bg-[#1B4332] text-white"
                              : "border-[#5C4033]/25 bg-[#5C4033]/10 text-[#5C4033]",
                          interactive ? "hover:brightness-95" : "cursor-not-allowed"
                        )}
                      >
                        {format(new Date(d + "T00:00:00"), "EEE, d MMM")}
                      </button>
                    );
                  });
                  const toggleClass =
                    "flex shrink-0 items-center gap-1 font-black text-[10px] tracking-wide text-[#5C4033] uppercase transition-colors hover:text-[#1F1F1A]";
                  return (
                    <div className="border-b border-[#E6DFC8] px-4 py-2 last:border-0 sm:px-5">
                      {canExpand && showAllDates ? (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                              Preferred Dates
                            </span>
                            <button type="button" onClick={() => setShowAllDates(false)} className={toggleClass}>
                              Show less
                              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">{pills}</div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                            Preferred Dates
                          </span>
                          <div className="no-scrollbar ml-auto flex min-w-0 items-center gap-1.5 overflow-x-auto">
                            {pills}
                          </div>
                          {canExpand && (
                            <button type="button" onClick={() => setShowAllDates(true)} className={toggleClass}>
                              Show all
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Selected date & time live in the footer action console (below), next
                    to the note + booking actions — they're what you commit to, not
                    part of the applicant's submitted details. */}

                {/* Notes from the booking (applicant) — read-only; hidden when blank.
                    Collapsed to a preview so a rambling note can't dominate the sheet;
                    the trailing "…" opens it in place. */}
                {bookingNote && (
                  <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2 last:border-0 sm:px-5">
                    <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                      Notes from Booking
                    </span>
                    <p className="min-w-0 text-right text-[13px] leading-relaxed font-semibold text-[#1F1F1A] italic">
                      &quot;{noteExpanded ? bookingNote : noteHead}{noteIsLong && !noteExpanded && (
                        <button
                          type="button"
                          onClick={() => setNoteExpanded(true)}
                          title="Show the full note"
                          aria-label="Show the full note"
                          aria-expanded={false}
                          className="px-0.5 font-black text-[#5C4033] not-italic hover:underline"
                        >
                          …
                        </button>
                      )}&quot;
                      {noteIsLong && noteExpanded && (
                        <button
                          type="button"
                          onClick={() => setNoteExpanded(false)}
                          aria-expanded={true}
                          className="ml-1.5 font-black text-[10px] tracking-wide text-[#5C4033] uppercase not-italic hover:underline"
                        >
                          Less
                        </button>
                      )}
                    </p>
                  </div>
                )}
              </Section>

              {/* Act Media — socials + videos together: both answer the same question
                  ("are they any good, do they have a following?"), so they're one
                  scouting section rather than two cards of chrome. Socials lead
                  because they're the cheaper glance. */}
              {(showSocials || videos.length > 0) && (
                <Section title="Act Media">
                  {showSocials && (
                    <div className="flex items-center gap-1.5 px-4 py-2 sm:px-5">
                      {SOCIAL_ORDER.map((key) => {
                        const meta = SOCIAL_META[key];
                        const Icon = meta?.icon ?? Link2;
                        const url = (socialLinks[key] ?? "").trim();
                        const pillClass =
                          "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-all";
                        // Filled → straight to the profile (the whole point of the row).
                        // Empty → a deactivated pill that opens the editor instead.
                        return url ? (
                          <a
                            key={key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${meta.label}`}
                            className={cn(pillClass, "hover:opacity-90", meta.className)}
                          >
                            <Icon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{meta.label}</span>
                          </a>
                        ) : (
                          <button
                            key={key}
                            type="button"
                            disabled={!editable}
                            onClick={() => setSocialEditorOpen(true)}
                            title={editable ? `Add ${meta.label} link` : `No ${meta.label} link`}
                            className={cn(
                              pillClass,
                              "border-dashed border-[#E6DFC8] bg-[#F7F4EA] text-[#5F624F]/50",
                              editable ? "hover:border-[#5C4033]/40 hover:text-[#5C4033]" : "cursor-not-allowed"
                            )}
                          >
                            <Icon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{meta.label}</span>
                          </button>
                        );
                      })}

                      {/* One editor for all four — also reachable by clicking any
                          empty pill, and the only way to fix an existing url. */}
                      {editable && (
                        <Popover open={socialEditorOpen} onOpenChange={setSocialEditorOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label="Edit social links"
                              title="Edit social links"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E6DFC8] bg-white text-[#5F624F] transition-colors hover:bg-[#F7F4EA] hover:text-[#5C4033]"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 rounded-2xl border-2 border-[#E6DFC8] bg-white p-3">
                            <span className="mb-2 block font-black text-[10px] tracking-wide text-[#5C4033] uppercase">
                              Social Links
                            </span>
                            <div className="space-y-2">
                              {SOCIAL_ORDER.map((key) => {
                                const meta = SOCIAL_META[key];
                                const Icon = meta?.icon ?? Link2;
                                return (
                                  <label key={key} className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                                        meta.className
                                      )}
                                    >
                                      <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="sr-only">{meta.label} URL</span>
                                    <input
                                      type="url"
                                      value={socialLinks[key] ?? ""}
                                      onChange={(e) =>
                                        setSocialLinks((s) => ({ ...s, [key]: e.target.value }))
                                      }
                                      placeholder={`${meta.label} URL`}
                                      className="min-w-0 flex-1 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2.5 py-1.5 text-xs text-[#1F1F1A] transition-all outline-none placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                            <p className="mt-2 text-[10px] leading-snug text-[#5F624F]/70">
                              Applied when you hit Save Changes.
                            </p>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  )}

                  {/* Videos — play inline on the page (facade: loads on click) */}
                  {videos.length > 0 && (
                    <div
                      className={cn(
                        "grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 sm:px-5",
                        // Only rule off the videos when there are pills above them.
                        showSocials && "border-t border-[#E6DFC8]"
                      )}
                    >
                      {videos.map((v, i) => (
                        <div key={i} className="min-w-0">
                          <VideoFacade url={v.url} title={`Video ${i + 1}`} />
                          <p
                            title={v.description || undefined}
                            className="mt-1.5 line-clamp-2 text-[11px] font-medium text-[#5F624F]"
                          >
                            {v.description || `Video ${i + 1}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* Band Notes now live in the sheet-header popover (internal, quick
                  access at any scroll position) — see the NotebookPen button above. */}

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
                {/* Email + phone behind "View more" — the name identifies the request;
                    the contact channels are only needed when reaching out. */}
                {showContactDetails && (
                  <>
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
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowContactDetails((v) => !v)}
                  aria-expanded={showContactDetails}
                  className="flex w-full items-center justify-center gap-1 border-t border-[#E6DFC8] bg-[#F7F4EA] px-4 py-1.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase transition-colors last:border-0 hover:bg-[#EFEADD] hover:text-[#1F1F1A] sm:px-5"
                >
                  {showContactDetails ? "View less" : "View more"}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showContactDetails && "rotate-180")} />
                </button>
              </Section>

              {/* Payment Details section */}
              {(editable || (request.payment_amount ?? 0) > 0) && (
                <Section
                  title="Payment Details"
                  defaultOpen={initialPaymentOpen}
                  headerRight={
                    !isNoPayment ? (
                      <span className={cn("rounded-lg border px-2 py-0.5 font-black text-[10px] tracking-tight uppercase", PAYMENT_STATUS_META[derivedStatus].className)}>
                        {PAYMENT_STATUS_META[derivedStatus].label}
                      </span>
                    ) : undefined
                  }
                >
                  {/* Amount */}
                  <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2 last:border-0 sm:px-5">
                    <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Amount</span>
                    {editable ? (
                      <div className="flex flex-1 items-center justify-end gap-1">
                        <span className="text-[13px] font-semibold text-[#5F624F]">£</span>
                        <input
                          aria-label="Amount"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="w-24 bg-transparent text-right text-[13px] font-semibold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
                        />
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1F1F1A]">
                        <CreditCard className="h-3.5 w-3.5 text-[#5F624F] opacity-50" />
                        £{(request.payment_amount ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* Status is derived from amount vs paid and never edited, so it
                      lives as a badge in the section header rather than as a row —
                      which also keeps the payment state readable while Paid is collapsed. */}
                  {/* Paid + bank details — hidden when there is no payment, and tucked
                      behind "View more" so the section stays compact by default. */}
                  {!isNoPayment && (
                    <>
                      {showBankDetails && (
                        <>
                          <div className="flex items-center justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2 last:border-0 sm:px-5">
                            <span className="shrink-0 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Paid</span>
                            {editable ? (
                              <div className="flex flex-1 items-center justify-end gap-1">
                                <span className="text-[13px] font-semibold text-[#5F624F]">£</span>
                                <input
                                  aria-label="Paid"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={paidAmount}
                                  onChange={(e) => setPaidAmount(e.target.value)}
                                  className="w-24 bg-transparent text-right text-[13px] font-semibold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
                                />
                              </div>
                            ) : (
                              <span className="text-right text-[13px] font-semibold text-[#1F1F1A]">£{(request.paid_amount ?? 0).toFixed(2)}</span>
                            )}
                          </div>
                          <EditRow label="Account Name" value={bankAccountName} onChange={setBankAccountName} editable={editable} placeholder="—" />
                          <EditRow label="Account No." value={bankAccountNo} onChange={setBankAccountNo} editable={editable} placeholder="—" />
                          <EditRow label="Sort Code" value={bankSortCode} onChange={setBankSortCode} editable={editable} placeholder="—" />
                          <EditRow label="Payment Ref" value={bankPaymentRef} onChange={setBankPaymentRef} editable={editable} placeholder="—" />
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowBankDetails((v) => !v)}
                        aria-expanded={showBankDetails}
                        className="flex w-full items-center justify-center gap-1 border-t border-[#E6DFC8] bg-[#F7F4EA] px-4 py-1.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase transition-colors last:border-0 hover:bg-[#EFEADD] hover:text-[#1F1F1A] sm:px-5"
                      >
                        {showBankDetails ? "View less" : "View more"}
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showBankDetails && "rotate-180")} />
                      </button>
                    </>
                  )}
                </Section>
              )}

              {/* System information (audit trail) now lives in the sheet-header
                  popover — reference-only data, reachable at any scroll position
                  without taking a card slot in the rail. See the Info button above. */}
              </div>
            </div>
            <div className="h-4" />
          </div>

          {/* Footer — compact single row: Cancel (left), stage transitions with one
              primary action (right), Save only once something changed. The note to
              the applicant is tucked behind a toggle since it's optional. */}
          <div className="z-40 shrink-0 rounded-b-4xl border-t-2 border-[#E6DFC8] bg-white/80 px-4 py-3 pb-6 backdrop-blur-md sm:px-6">
            {/* Action area — editable stages (new / reviewing / offered / booked).
                A declined request is read-only, so no footer. */}
            {editable && (
              <div className="space-y-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Left: the slot being committed to — compact single row. While
                      it's still needed for booking it wears an amber rail, and the
                      blocked Booked chip flashes it via revealSlot(). */}
                  <div
                    className={cn(
                      "space-y-1.5 rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] p-2.5 transition-all",
                      slotWarning && "border-l-4 border-l-amber-400",
                      slotFlash && "ring-2 ring-amber-400/70"
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-1.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                      Selected Date &amp; Time
                      {slotWarning && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] tracking-tight text-amber-700">
                          Required to book
                        </span>
                      )}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "flex min-w-40 flex-1 items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-[13px] font-semibold text-[#1F1F1A] transition-colors hover:border-[#5C4033]/30",
                              !selectedDate && slotWarning ? "border-amber-300" : "border-[#E6DFC8]"
                            )}
                          >
                            {selectedDate
                              ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy")
                              : "Pick a date"}
                            <CalendarDays className="h-4 w-4 shrink-0 text-[#5F624F]/60" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto rounded-2xl border-2 border-[#E6DFC8] bg-white p-0">
                          <Calendar
                            mode="single"
                            selected={selectedDate ? new Date(selectedDate + "T00:00:00") : undefined}
                            onSelect={(d) => {
                              if (d) applyDate(format(d, "yyyy-MM-dd"));
                              setDatePickerOpen(false);
                            }}
                            autoFocus
                          />
                          {/* react-day-picker won't deselect the active day in single
                              mode, so clearing needs its own control. */}
                          {selectedDate && (
                            <button
                              type="button"
                              onClick={() => {
                                applyDate("");
                                setDatePickerOpen(false);
                              }}
                              className="flex w-full items-center justify-center gap-1.5 border-t border-[#E6DFC8] px-4 py-2.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA] hover:text-[#5C4033]"
                            >
                              <X className="h-3.5 w-3.5" />
                              Clear date
                            </button>
                          )}
                        </PopoverContent>
                      </Popover>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 transition-colors",
                          (!selectedStartTime || !selectedEndTime) && slotWarning
                            ? "border-amber-300"
                            : "border-[#E6DFC8]"
                        )}
                      >
                        <input
                          ref={startTimeRef}
                          type="time"
                          aria-label="Performance start time"
                          value={selectedStartTime}
                          onChange={(e) => applyStart(e.target.value)}
                          className="bg-transparent text-[13px] font-semibold text-[#1F1F1A] outline-none"
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
                          className="bg-transparent text-[13px] font-semibold text-[#1F1F1A] outline-none"
                        />
                        {/* Start drives end, so one control clears the pair. */}
                        {(selectedStartTime || selectedEndTime) && (
                          <button
                            type="button"
                            onClick={() => applyStart("")}
                            aria-label="Clear performance times"
                            title="Clear times"
                            className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#5F624F]/50 transition-colors hover:bg-[#F7F4EA] hover:text-[#5C4033]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Single message covering the date + time pair above. */}
                    <FieldMessage warning={slotWarning} />
                    {clashes.length > 0 && (
                      <div className="mt-1">
                        <ClashList clashes={clashes} />
                      </div>
                    )}
                  </div>

                  {/* Right: note to applicant — optional, so it stays behind a toggle */}
                  <div className="flex flex-col">
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
                        className="mt-1.5 w-full flex-1 resize-none rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-[13px] text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                {error && <p className="text-xs font-bold text-red-500">{error}</p>}

                {/* Stage moves live in the header stepper now. What's left here is
                    Cancel, the Decline exit (a terminal outcome, not a stage), and
                    Save once something's dirty. */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="mr-auto flex h-11 flex-1 items-center justify-center rounded-xl border-2 border-[#E6DFC8] bg-white px-5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA] disabled:opacity-50 sm:flex-initial"
                  >
                    Cancel
                  </button>
                  {(BAND_TRANSITIONS[status as BandStatus] ?? [])
                    .filter((t) => !PIPELINE.includes(t.next))
                    .map((t) => (
                      <button
                        key={t.next + t.label}
                        type="button"
                        onClick={() => handleAction(t.next)}
                        disabled={isPending}
                        className={cn(
                          "flex h-11 min-w-24 flex-1 items-center justify-center gap-2 rounded-xl px-4 font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:flex-initial sm:px-5",
                          t.className
                        )}
                      >
                        {pendingStage === t.next ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.label}
                      </button>
                    ))}
                  {hasChanges && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isPending || hasClashes}
                      title={hasClashes ? clashWarning : undefined}
                      className="flex h-11 min-w-24 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1B4332] px-5 font-black text-[10px] tracking-widest text-white uppercase shadow-lg transition-all hover:bg-[#1B4332]/85 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:flex-initial"
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
    <p className={cn("mt-1.5 flex items-center gap-1 text-[11px] leading-snug font-bold", isWarning ? "text-amber-600" : "text-red-600")}>
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
