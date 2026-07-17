"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { updateBandStatus, updateBandBookingFields, getClashingEvents, rescheduleConfirmedBooking, toggleBandFavorite } from "../actions";
import type { BandStatus } from "../actions";
import {
  ChevronDown,
  ArrowRight,
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
  CalendarClock,
  Upload,
  Mail,
  Phone,
  Heart,
  Hash,
  Copy,
  NotebookPen,
  Info,
  Pencil,
  PoundSterling,
  User,
  Video,
  X,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok } from "react-icons/si";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { VideoFacade } from "@/components/video-facade";
import { uploadVideoResumable, type ResumableHandle } from "@/lib/resumable-upload";
import BandNotesPopover from "./band-notes-popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { addHoursToTime, toHHMM, type ClashEvent } from "@/lib/event-clash";
import { type BandLifecycleStage } from "@/lib/band-lifecycle";
import { buildRescheduleEmail, buildOfferEmail, buildOutcomeEmail, type BandEmail } from "@/lib/band-emails";

const DEFAULT_START_TIME = "22:00"; // 10pm

/** Same ceiling as the public application form, so the admin can't outgrow it. */
const MAX_VIDEOS = 10;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250 MB

/** Applicant's booking note collapses to this many characters behind a "…" toggle. */
const NOTE_PREVIEW_LEN = 50;

/** Preferred-date pills shown before the "Show all" toggle takes over. */
const PREFERRED_DATES_VISIBLE = 4;

/** The Decline Reason row lives in a narrow popover, so it previews less than a sheet row. */
const DECLINE_PREVIEW_LEN = 28;

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
}

/** One internal note on a request — a row of `band_booking_notes`. */
export interface BandNote {
  id: string;
  body: string;
  created_at: string;
  /** Joined employee for `created_by` — who wrote it. */
  author?: { full_name: string | null } | { full_name: string | null }[] | null;
}

/** The slice of the linked `events` row the card reads. */
interface LinkedEvent {
  is_active: boolean;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
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
  /**
   * @deprecated Superseded by `band_notes_list` (`band_booking_notes`). Kept only
   * because the column still exists; nothing writes it any more.
   */
  band_notes: string | null;
  /** Internal notes, oldest first. */
  band_notes_list?: BandNote[] | null;
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
  /**
   * Joined `events` row for `event_id`. `is_active` tells a linked event that's
   * on the schedule from one that's been taken off it; the date and times place
   * the booking in time for the lifecycle badge. Supabase returns the join as an
   * object or a single-element array.
   */
  linked_event?: LinkedEvent | LinkedEvent[] | null;
}

/**
 * A video row in the sheet's Act Media manager. The applicant's saved videos load
 * with a `url` straight away; a freshly picked file has none until its resumable
 * upload finishes, and carries the local preview + progress in the meantime.
 */
interface SheetVideo {
  id: string;
  /** Public url once uploaded; null while a picked file is still uploading. */
  url: string | null;
  description: string;
  /** Object URL for the local file, so a not-yet-uploaded pick still previews. */
  previewUrl?: string;
  uploading?: boolean;
  progress?: number;
  error?: string | null;
}

/** The applicant's saved videos as editable rows — url + description, paired by index. */
function seedSheetVideos(request: BandRequest): SheetVideo[] {
  return (request.video_urls ?? [])
    .map((url, i) => ({
      id: `saved-${i}`,
      url,
      description: (request.video_descriptions ?? [])[i]?.trim() || "",
    }))
    .filter((v) => Boolean(v.url));
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

/**
 * Per-platform brand colours for the social links. `className` fills the sheet's
 * pill; `glyph` colours a bare icon, for the card row where there's no pill to
 * carry the brand — each platform's own colour is what makes it identifiable at
 * 16px, so Instagram's pink is picked out of the gradient rather than flattened
 * to the palette.
 */
const SOCIAL_META: Record<string, { icon: React.ElementType; className: string; glyph: string; label: string }> = {
  instagram: {
    icon: SiInstagram,
    className: "bg-linear-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white border-transparent",
    glyph: "text-[#DD2A7B]",
    label: "Instagram",
  },
  facebook: {
    icon: SiFacebook,
    className: "bg-[#1877F2] text-white border-transparent",
    glyph: "text-[#1877F2]",
    label: "Facebook",
  },
  youtube: {
    icon: SiYoutube,
    className: "bg-[#FF0000] text-white border-transparent",
    glyph: "text-[#FF0000]",
    label: "YouTube",
  },
  tiktok: {
    icon: SiTiktok,
    className: "bg-black text-white border-transparent",
    glyph: "text-black",
    label: "TikTok",
  },
};

/** A marker with nothing behind it — same "off" tone as the unfilled heart. */
const MARKER_OFF = "text-[#5F624F]/25";

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
        "flex h-12 shrink-0 items-center gap-2 rounded-full border-2 px-3.5 transition-all sm:h-10",
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
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : tone === "past" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
      ) : (
        <span className={cn("h-2 w-2 shrink-0 rounded-full", tone === "current" ? t.dot : "bg-[#E6DFC8]")} />
      )}
      <span className="font-black text-[10px] tracking-widest uppercase">{t.label}</span>
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
      <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto" aria-label={`Status: ${t.label}`}>
        {chip(status as BandStatus, "current")}
        {exits.map((tr) => (
          <React.Fragment key={tr.next}>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#5F624F]/30" aria-hidden="true" />
            {chip(tr.next, "future")}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto"
      aria-label={`Stage ${idx + 1} of ${PIPELINE.length}: ${currentLabel}`}
    >
      {PIPELINE.map((s, i) => (
        <React.Fragment key={s}>
          {/* An arrow, not a bar — it points at the next step. Espresso once the
              stage is reached, muted while it's still ahead. */}
          {i > 0 && (
            <ArrowRight
              className={cn("h-4 w-4 shrink-0", i <= idx ? "text-[#5C4033]" : "text-[#5F624F]/30")}
              aria-hidden="true"
            />
          )}
          {chip(s, i === idx ? "current" : i < idx ? "past" : "future")}
        </React.Fragment>
      ))}

      {/* Decline — a terminal exit, deliberately NOT part of the approval pipeline:
          pushed clear to the right with no arrow leading in, and outlined in dashed
          red so it reads as the bad, off-workflow action it is. */}
      {reachable("declined") && (
        <button
          type="button"
          disabled={!!pendingStage}
          onClick={() => onSelect("declined")}
          title="Decline application — a terminal exit, not a pipeline step"
          className="ml-auto flex h-12 shrink-0 items-center gap-2 rounded-full border-2 border-dashed border-red-300 bg-red-50 px-3.5 text-red-600 transition-colors hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50 sm:h-10"
        >
          {pendingStage === "declined" ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="font-black text-[10px] tracking-widest uppercase">Decline</span>
        </button>
      )}
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

/**
 * Dialog body for the outbound emails: an optional message, plus a preview that
 * rebuilds as you type it.
 *
 * The draft lives in here rather than in the card because `useConfirm` snapshots
 * `content` when the dialog opens — a textarea bound to the card's state would
 * render stale and swallow keystrokes. This component mounts once and owns its
 * own state; `onNoteChange` reports back so the caller can read the final value.
 */
function EmailWithNote({
  initialNote,
  onNoteChange,
  build,
  to,
  label,
  placeholder,
  slotLabel,
}: {
  initialNote: string;
  onNoteChange: (v: string) => void;
  /** Rebuilds the email for the given note — keeps the preview honest. */
  build: (note: string) => BandEmail;
  to: string;
  label: string;
  placeholder: string;
  slotLabel?: string;
}) {
  const [note, setNote] = useState(initialNote);
  return (
    <div className="space-y-2 text-left">
      <label className="block">
        <span className="mb-1.5 block font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
          {label}
        </span>
        <textarea
          value={note}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => {
            setNote(e.target.value);
            onNoteChange(e.target.value);
          }}
          className="w-full resize-none rounded-xl border border-[#E6DFC8] bg-white px-3 py-2 text-xs text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
        />
      </label>
      <EmailPreview email={build(note)} to={to} slotLabel={slotLabel} />
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

/**
 * "Tamlyn Fourie" → "T.Fourie" — the card row is narrow, and the surname is what
 * gets recognised. A middle name drops out (the last word is the surname); a
 * single-word name has nothing to abbreviate and is left whole.
 */
function abbreviateName(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const surname = parts[parts.length - 1];
  return `${parts[0][0].toUpperCase()}.${surname}`;
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

/**
 * Lifecycle tag fills, matching the type tag's solid treatment at the opposite
 * corner. Deliberately off the green "booked" status theme these sit beside —
 * they report where the night sits in time, not the status, so a neutral "done"
 * and a distinct blue "ahead" don't restate the status colour. The 600/500 tones
 * (rather than the lighter blue-500/gray-400) are what carry white text at 9px.
 */
const LIFECYCLE_META: Record<BandLifecycleStage, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-gray-500" },
  upcoming: { label: "Upcoming", className: "bg-blue-600" },
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

const LIST_HREF = "/event-bookings/music-bookings";

export function BandBookingCard({
  request,
  wide = false,
  lifecycle = null,
}: {
  request: BandRequest;
  /**
   * This card's column has the board to itself, so the row can spread into the
   * width instead of staying at board-column proportions. Drives the `lg:` row
   * layout below (there's only room for it on a real screen) and unlocks the
   * detail a 288px column can't carry: video count, socials, unabbreviated name.
   */
  wide?: boolean;
  /**
   * Where this night sits in time, for the corner tag. Handed down rather than
   * worked out here: "upcoming" belongs to only the next booked night, which is
   * a fact about the whole board that a single card can't see. Null until the
   * board has a client clock to compare against.
   */
  lifecycle?: BandLifecycleStage | null;
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  // Footer "note to applicant" is tucked away unless one already exists.
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
  /** Live value of the note being written inside an email dialog. */
  const noteDraft = useRef("");

  // Favourite persists on click (not via Save), so it gets its own transition —
  // sharing `isPending` would grey out the footer actions on every heart tap.
  const [isFavorite, setIsFavorite] = useState(request.is_favorite);
  const [, startFavTransition] = useTransition();
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [declineReasonOpen, setDeclineReasonOpen] = useState(false);

  // Editable detail fields (act, contact & payment). Seeded from the request; a
  // cancelled request is read-only, everything else can be edited.
  const [actName, setActName] = useState(request.group_name ?? "");
  const [reqType, setReqType] = useState(request.type ?? "");
  const [genre, setGenre] = useState(request.genre ?? "");
  const [bookerName, setBookerName] = useState(request.booker_name ?? "");
  const [email, setEmail] = useState(request.email ?? "");
  const [phone, setPhone] = useState(request.phone_no ?? "");
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
  // Act Media videos as an editable list — seeded from the request, with new picks
  // uploaded straight to the band-videos bucket and persisted on Save.
  const [sheetVideos, setSheetVideos] = useState<SheetVideo[]>(() => seedSheetVideos(request));
  const videoInputRef = useRef<HTMLInputElement>(null);
  /** In-flight resumable uploads, keyed by row id, so a removal can abort one. */
  const videoUploadHandles = useRef<Record<string, ResumableHandle>>({});

  const status = normStatus(request.status);
  const theme = statusTheme[status] || statusTheme.new;
  const editable = status !== "declined";

  // Applicant's note. Long ones sit on one row as a preview + "…" toggle rather
  // than pushing every other field down the sheet.
  const bookingNote = (request.notes ?? "").trim();
  const noteIsLong = bookingNote.length > NOTE_PREVIEW_LEN;
  const noteHead = bookingNote.slice(0, NOTE_PREVIEW_LEN).trimEnd();

  /**
   * Open/close the sheet, mirroring its state into the URL as `?open=<request id>`.
   *
   * The sheet is local state, so a round-trip to the linked event and back would
   * otherwise land on the bare list. The marker lets the effect below reopen this
   * request — both on browser Back (which restores this entry) and on the events
   * page sending us back explicitly. replaceState rather than router.push: the
   * marker annotates where we already are, it isn't a place worth a history entry.
   */
  function setSheetOpen(next: boolean) {
    setOpen(next);
    window.history.replaceState(null, "", next ? `${LIST_HREF}?open=${request.id}` : LIST_HREF);
  }

  // Reopen this request's sheet when we're the one named in `?open=`, then drop the
  // marker so a later refresh doesn't resurrect a sheet the admin has closed.
  useEffect(() => {
    const openId = searchParams.get("open") ?? new URLSearchParams(window.location.search).get("open");
    if (openId !== request.id) return;
    setOpen(true);
    window.history.replaceState(null, "", LIST_HREF);
  }, [searchParams, request.id]);

  // Where the linked event lives, if one has been placed. Null → System
  // Information shows "—".
  // `back` carries our own reopen marker, so closing the event's sheet returns to
  // this request rather than stranding the admin on the events list.
  const eventHref = request.event_id
    ? `/event-setups/events?open=${request.event_id}&back=${encodeURIComponent(`${LIST_HREF}?open=${request.id}`)}`
    : null;
  // Is that event actually on the schedule? Only `booked` keeps its event active;
  // every other status deactivates it, so the badge colour reports the event's
  // real state rather than just the fact a row exists.
  const linkedEvent = Array.isArray(request.linked_event) ? request.linked_event[0] : request.linked_event;
  const eventIsActive = linkedEvent?.is_active === true;
  /** Is there a corner ribbon at all? Drives the top padding and the heart's drop. */
  const hasRibbon = !!(request.type || request.genre || lifecycle);
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

  // The reason the band was given when declined. Lives in admin_notes (the same
  // field the offer/booked messages use) — it's whatever was last said to them.
  const isDeclined = status === "declined";
  const declineReason = adminNotes.trim();
  const declineIsLong = declineReason.length > DECLINE_PREVIEW_LEN;
  const declineHead = declineReason.slice(0, DECLINE_PREVIEW_LEN).trimEnd();

  // A slot that overlaps another active event can't be committed — it would double-
  // book the venue. Blocks Save and the Booked chip until the time moves.
  const hasClashes = clashes.length > 0;
  const clashWarning = hasClashes
    ? `Clashes with ${clashes.map((c) => c.title).join(", ")} — pick another time.`
    : undefined;
  // A complete, clash-free slot — the console then wears the Save/book green
  // (#1B4332) to read as "ready", rather than the neutral resting espresso.
  const slotIsSet = !!selectedDate && !!selectedStartTime && !!selectedEndTime && !hasClashes;

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
  // Internal notes, oldest first (the query orders them). Server-owned: they save
  // on their own, so they're read straight off the request rather than mirrored
  // into state like the editable fields below.
  const bandNoteList = request.band_notes_list ?? [];
  /** Drives the fee marker in the icon rail, and how much room the name must leave. */
  const hasFee = (request.payment_amount ?? 0) > 0;

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

  // Only successfully-uploaded videos are persistable; a row still uploading has no
  // url yet, so it stays out of the saved arrays until it lands.
  const uploadedSheetVideos = sheetVideos.filter((v) => v.url);
  const videosUploading = sheetVideos.some((v) => v.uploading);
  const savedVideoUrls = (request.video_urls ?? []).filter(Boolean);
  const savedVideoDescriptions = savedVideoUrls.map(
    (_, i) => (request.video_descriptions ?? [])[i]?.trim() || ""
  );
  const videosChanged =
    JSON.stringify(uploadedSheetVideos.map((v) => v.url)) !== JSON.stringify(savedVideoUrls) ||
    JSON.stringify(uploadedSheetVideos.map((v) => v.description.trim())) !==
      JSON.stringify(savedVideoDescriptions);

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
    bankAccountName !== (request.bank_account_name ?? "") ||
    bankAccountNo !== (request.bank_account_no ?? "") ||
    bankSortCode !== (request.bank_sort_code ?? "") ||
    bankPaymentRef !== (request.bank_payment_ref ?? "") ||
    JSON.stringify(normalizeSocials(socialLinks)) !== JSON.stringify(normalizeSocials(request.social_links)) ||
    videosChanged ||
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
    social_links: normalizeSocials(socialLinks),
    video_urls: uploadedSheetVideos.map((v) => v.url as string),
    video_descriptions: uploadedSheetVideos.map((v) => v.description.trim()),
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
    // A declined request places no event, so its slot can't collide with anything —
    // and its clash list would have nowhere to render (the footer's second column
    // carries the decline reason), leaving Save mysteriously disabled.
    if (status === "declined" || !selectedDate || !selectedStartTime || !selectedEndTime) {
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
  }, [status, selectedDate, selectedStartTime, selectedEndTime, request.event_id]);

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
      setSheetOpen(false);
      return;
    }
    // The sheet stays mounted while we ask, so a second Escape would fire
    // onOpenChange again and stack another dialog over the first. `pendingStage`
    // covers an Escape landing while a status change is mid-flight.
    if (askingToClose.current || !!pendingStage) return;
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
        // Cancel means Discard here, so a stray click or Escape must not answer.
        dismissible: false,
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
    // Abort any in-flight uploads, free their previews, and drop back to the saved
    // videos — a discarded pick shouldn't keep uploading in the background.
    Object.values(videoUploadHandles.current).forEach((h) => h.abort());
    videoUploadHandles.current = {};
    sheetVideos.forEach((v) => v.previewUrl && URL.revokeObjectURL(v.previewUrl));
    setSheetVideos(seedSheetVideos(request));
    setClashes([]);
    setError(null);
    setSheetOpen(false);
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

  const updateSheetVideo = (id: string, patch: Partial<SheetVideo>) =>
    setSheetVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  /**
   * Pick files → upload each to the band-videos bucket (resumable, same helper the
   * public form uses), adding a row that shows progress and lands a url on success.
   * The saved arrays only pick these up on Save.
   */
  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_VIDEOS - sheetVideos.length;

    for (const file of files.slice(0, remaining)) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);

      if (file.size > MAX_VIDEO_BYTES) {
        setSheetVideos((prev) => [
          ...prev,
          { id, url: null, description: "", previewUrl, uploading: false, progress: 0, error: "File too large (max 250 MB)." },
        ]);
        continue;
      }

      setSheetVideos((prev) => [
        ...prev,
        { id, url: null, description: "", previewUrl, uploading: true, progress: 0, error: null },
      ]);

      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      videoUploadHandles.current[id] = uploadVideoResumable(file, path, {
        onProgress: (pct) => updateSheetVideo(id, { progress: pct }),
        onSuccess: (publicUrl) => {
          updateSheetVideo(id, { uploading: false, url: publicUrl, progress: 100 });
          delete videoUploadHandles.current[id];
        },
        onError: (message) => {
          updateSheetVideo(id, { uploading: false, error: message });
          delete videoUploadHandles.current[id];
        },
      });
    }

    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  /** Drop a video row, aborting its upload and freeing the local preview first. */
  function removeSheetVideo(id: string) {
    videoUploadHandles.current[id]?.abort();
    delete videoUploadHandles.current[id];
    setSheetVideos((prev) => {
      const entry = prev.find((v) => v.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((v) => v.id !== id);
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
  /**
   * The band only hears about offered / booked / declined — each gets a dialog to
   * write an optional message and see the exact email before it goes. Returns the
   * note alongside the verdict, since it's written *in* the dialog and the caller
   * has to persist and send it. new / reviewing send nothing, so they stay
   * one-click and keep whatever note is already on the record.
   */
  async function confirmEmail(newStatus: BandStatus): Promise<{ ok: boolean; note: string }> {
    const slot = {
      name: bookerName || request.booker_name,
      groupName: actName || request.group_name,
      date: selectedDate || null,
      startTime: selectedStartTime || null,
      endTime: selectedEndTime || null,
    };
    const to = email || request.email;

    const dialogs: Partial<
      Record<
        BandStatus,
        {
          title: string;
          description: string;
          confirmLabel: string;
          label: string;
          placeholder: string;
          slotLabel?: string;
          destructive?: boolean;
          /** Prefill from the record. Only the decline reason is kept there. */
          seed?: boolean;
          build: (note: string) => BandEmail;
        }
      >
    > = {
      offered: {
        title: "Send offer & email band?",
        description: "The band gets this straight away and replies to accept.",
        confirmLabel: "Send & Email",
        label: "Message to the band (optional)",
        placeholder: "Anything they should know about the slot, load-in, kit...",
        slotLabel: "Proposed Slot",
        build: (note) =>
          buildOfferEmail({
            ...slot,
            paymentAmount: paymentAmount === "" ? null : Number(paymentAmount),
            notes: note,
          }),
      },
      booked: {
        title: "Book & email band?",
        description: "This confirms the band and puts the event on the schedule.",
        confirmLabel: "Book & Email",
        label: "Message to the band (optional)",
        placeholder: "Anything they should know before the night...",
        slotLabel: "Performance Date",
        build: (note) => buildOutcomeEmail({ ...slot, outcome: "confirmed", notes: note }),
      },
      declined: {
        title: "Decline & email band?",
        description: "This turns the application down and emails the band.",
        confirmLabel: "Decline & Email",
        label: "Reason for declining (optional)",
        placeholder: "Shared with the band in the email. Leave blank to say nothing.",
        destructive: true,
        // The reason is kept on the record, so an existing one is offered for reuse.
        seed: true,
        build: (note) => buildOutcomeEmail({ ...slot, outcome: "cancelled", notes: note }),
      },
    };

    const d = dialogs[newStatus];
    if (!d) return { ok: true, note: adminNotes };

    // Offer / booked messages are written fresh each send — they must not inherit
    // the decline reason (or anything else) sitting in admin_notes.
    const initial = d.seed ? adminNotes : "";
    noteDraft.current = initial;
    const ok = await confirm({
      title: d.title,
      description: `${d.description} Preview:`,
      confirmLabel: d.confirmLabel,
      variant: d.destructive ? "destructive" : undefined,
      content: (
        <EmailWithNote
          initialNote={initial}
          onNoteChange={(v) => {
            noteDraft.current = v;
          }}
          build={d.build}
          to={to}
          label={d.label}
          placeholder={d.placeholder}
          slotLabel={d.slotLabel}
        />
      ),
    });
    return { ok, note: noteDraft.current };
  }

  function handleAction(newStatus: BandStatus) {
    setError(null);
    setClashes([]);
    // Asking the admin something is NOT a transition. React 19 holds an async
    // transition's state updates until the action settles, so a confirm() called
    // inside one never paints its dialog — and the transition then waits forever on
    // a click that can't happen. Only the server work below goes in startTransition.
    void (async () => {
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
        // Last chance to back out before the band is emailed, and where the note
        // that goes with it gets written.
        const { ok, note } = await confirmEmail(newStatus);
        if (!ok) return;
        applyStatus(newStatus, note);
      } catch {
        setError("Failed to update. Please try again.");
      }
    })();
  }

  /** The server half of a status change — this part is a real pending update. */
  function applyStatus(newStatus: BandStatus, note: string) {
    // Set outside the transition: updates made *inside* an async transition don't
    // paint until it settles, so a spinner set in there would never be seen.
    setPendingStage(newStatus);
    startTransition(async () => {
      try {
        // admin_notes holds the decline reason and nothing else — an offer/booked
        // message is per-send, so it must leave whatever's on the record alone.
        const isDecline = newStatus === "declined";
        const persistedNote = isDecline ? note : adminNotes;
        if (hasChanges) {
          await updateBandBookingFields(request.id, {
            ...detailFields(),
            admin_notes: persistedNote || null,
            selected_date: selectedDate || null,
            selected_start_time: selectedStartTime || null,
            selected_end_time: selectedEndTime || null,
          });
        }
        // `note` is what the band reads; the action decides what (if anything) sticks.
        const result = await updateBandStatus(request.id, newStatus, note || undefined);
        // The server re-checks the slot as the last word before an event is placed.
        // A clash landing between our own check and this one leaves the request where
        // it was — surface it inline under the slot fields, like every other clash.
        if (result?.clashes?.length) {
          setClashes(result.clashes);
          toast.error("This slot now clashes with another event — pick another time.");
          return;
        }
        if (isDecline) setAdminNotes(note);
        // The sheet stays open on every status change — the stepper is the control
        // now, so you land on the new stage and see the result (including Declined,
        // which can be reopened straight from the stepper). Close it yourself.
        // offered / booked / declined email the band; new / reviewing are silent.
        const emails = newStatus === "offered" || newStatus === "booked" || newStatus === "declined";
        const label = STATUS_TOAST[newStatus];
        if (emails) {
          if (result?.emailError) {
            toast.error(`${label}, but the email didn't send: ${result.emailError}`);
          } else {
            toast.success(`${label} — band emailed`);
          }
        } else {
          toast.success(label);
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
    // Same rule as handleAction: a dialog that waits on the admin can't live inside
    // startTransition or it never paints. Ask everything first, then hand the writes
    // to runSave().
    void (async () => {
      try {
        // Confirmed + date/time change → clash check + reschedule email flow.
        if (status === "booked" && dateTimeChanged) {
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

          runSave(async () => {
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
            setSheetOpen(false);
          });
          return;
        }

        // Confirmed, detail-only change → its edits flow through to the linked
        // event, so it's worth a nod first.
        if (status === "booked") {
          const ok = await confirm({
            title: "Save changes?",
            description:
              "This booking is booked — saving updates its details and the linked event.",
            confirmLabel: "Save Changes",
          });
          if (!ok) return;
          runSave(async () => {
            await updateBandBookingFields(request.id, detailFields());
            toast.success("Changes saved");
            setSheetOpen(false);
          });
          return;
        }

        // Anything else saves straight away.
        runSave(async () => {
          await updateBandBookingFields(request.id, {
            ...detailFields(),
            selected_date: selectedDate || null,
            selected_start_time: selectedStartTime || null,
            selected_end_time: selectedEndTime || null,
          });
          toast.success("Changes saved");
          setSheetOpen(false);
        });
      } catch {
        setError("Failed to update. Please try again.");
      }
    })();
  }

  /** Runs the write half of a save inside a transition, so Save shows as pending. */
  function runSave(work: () => Promise<void>) {
    startTransition(async () => {
      try {
        await work();
      } catch {
        setError("Failed to update. Please try again.");
      }
    });
  }

  return (
    <>
      {/* Card row.
          A container rather than one big button: the favourite toggle has to be a
          real button, and a button can't nest inside another. Opening the sheet is
          instead a transparent button stretched across the card, sitting under the
          content and over nothing else — so the whole row still opens it. */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border-2 border-[#E6DFC8] bg-white",
          "shadow-sm transition-all hover:bg-[#F7F4EA]/60 active:scale-[0.98]",
          // The row below lays itself out against *this* card's width, not the
          // viewport's — two columns halve the board, so the same screen can hold
          // a card with room to spread and one without. Only the eligible card
          // becomes a container; the board's cards never consult it.
          wide && "@container"
        )}
      >
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="absolute inset-0 z-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#5C4033]/40 focus-visible:ring-inset"
        >
          <span className="sr-only">Open {request.group_name || request.booker_name}</span>
        </button>

        {/* A full-width top ribbon: type + genre tucked into the left corner in the
            request's own status hue (new = blue, booked = green, ...), and the
            lifecycle tag mirrored into the right corner. Eyebrow treatment per the
            style guide: tiny, black, wide-tracked caps — the wide tracking is what
            keeps 9px legible. Type takes the solid fill, genre the light tint at a
            lighter weight, so type leads. The left group is width-capped so a long
            genre can't crowd out the lifecycle tag. */}
        {hasRibbon && (
          // Decorative, so it doesn't intercept clicks meant for the card.
          <span className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-stretch text-[9px] tracking-widest uppercase">
            <span className="flex max-w-[65%] min-w-0 items-stretch overflow-hidden rounded-tl-xl rounded-br-lg">
              {request.type && (
                <span className={cn("shrink-0 px-2 py-0.5 font-black text-white", theme.dot)}>
                  {toTitleCase(request.type)}
                </span>
              )}
              {request.genre && (
                <span className={cn("truncate px-2 py-0.5 font-bold", theme.bg, theme.text)}>
                  {toTitleCase(request.genre)}
                </span>
              )}
            </span>
            {/* The type tag's mirror image in the opposite corner: same eyebrow
                treatment and solid fill, rounded into the card's own edge. Its
                own hue, not the status theme's — where the night sits in time is
                a separate fact from where the request sits in the pipeline. */}
            {lifecycle && (
              <span
                className={cn(
                  "ml-auto shrink-0 rounded-tr-xl rounded-bl-lg px-2 py-0.5 font-black text-white",
                  LIFECYCLE_META[lifecycle].className
                )}
              >
                {LIFECYCLE_META[lifecycle].label}
              </span>
            )}
          </span>
        )}

        {/* Content sits above the stretched button but passes clicks through to it,
            so only the rail's icons are separately clickable. The extra top padding
            when a type tag is present keeps the badge clear of the corner. */}
        <div
          className={cn(
            "pointer-events-none relative z-10 flex items-center gap-3 px-3 pb-3 text-left",
            hasRibbon ? "pt-5" : "pt-3"
          )}
        >
          {/* Status badge circle (left) */}
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border",
              theme.bg,
              theme.text,
              theme.border
            )}
          >
            {hasSlot && request.selected_date ? (
              // The badge carries the whole slot date (weekday / day / month), so the
              // row below doesn't repeat it.
              <div className="flex flex-col items-center justify-center leading-none">
                <span className="font-black text-[8px] tracking-tighter uppercase opacity-70">
                  {format(new Date(request.selected_date + "T00:00:00"), "EEE")}
                </span>
                <span className="my-px font-black text-sm tracking-tighter">
                  {format(new Date(request.selected_date + "T00:00:00"), "dd")}
                </span>
                <span className="font-black text-[8px] tracking-tighter uppercase opacity-70">
                  {format(new Date(request.selected_date + "T00:00:00"), "MMM")}
                </span>
              </div>
            ) : (
              theme.icon
            )}
          </div>

          {/* Three stacked blocks in a board column. Given room, this wrapper
              dissolves (`contents`) so the blocks become columns of the row above
              — one set of nodes, laid on whichever axis fits. */}
          <div className={cn("min-w-0 flex-1", wide && "@2xl:contents")}>
            {/* Only the name has to clear the favourite in the corner — the rows
                below it are short and left-aligned, so they run the full width.
                On one line the favourite is a column, so it clears itself. */}
            <p
              className={cn(
                "truncate pr-11 font-black text-sm tracking-tight text-[#1F1F1A] uppercase",
                wide && "@2xl:min-w-0 @2xl:flex-1 @2xl:pr-0"
              )}
            >
              {request.group_name || request.booker_name}
            </p>

            <div
              className={cn(
                "mt-1 flex min-w-0 items-center gap-1.5 text-[#5F624F]",
                wide && "@2xl:mt-0 @2xl:w-32 @2xl:shrink-0"
              )}
            >
              <User className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
              <p className="truncate text-xs font-semibold" title={request.booker_name}>
                {/* The abbreviation buys width a board column doesn't have. Given
                    the room, the whole name is more use than "T.Fourie". */}
                {wide ? request.booker_name : abbreviateName(request.booker_name)}
              </p>
              {/* A fee is a yes/no signal on the row — the amount itself is in the
                  sheet (and on hover). No fee shows nothing. */}
              {hasFee && (
                <span
                  className="inline-flex shrink-0 items-center rounded-sm border border-amber-200 bg-amber-50 px-px py-px text-amber-700"
                  title={`Fee: £${(request.payment_amount ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                >
                  <PoundSterling className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Has a fee</span>
                </span>
              )}
            </div>

            {/* Booking facts — the slot (offered/booked) or the applicant's preferred
                dates, with the fee marker closing the row. */}
            {/* Dissolves too, so the slot and the notes button become columns in
                their own right rather than a row nested inside one. */}
            <div
              className={cn(
                "mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5F624F]",
                wide && "@2xl:contents"
              )}
            >
              {/* The wrapper's type still reaches here once it dissolves —
                  `contents` drops the box, not the inheritance. */}
              <span className={cn("min-w-0 truncate", wide && "@2xl:w-28 @2xl:shrink-0")}>
                {hasSlot
                  ? (request.selected_start_time || request.selected_end_time) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3 shrink-0" />
                        {[toHHMM(request.selected_start_time), toHHMM(request.selected_end_time)]
                          .filter(Boolean)
                          .join("–")}
                      </span>
                    )
                  : dates.length > 0 && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {dates.slice(0, 2).map((d) => format(new Date(d + "T00:00:00"), "d MMM")).join(", ")}
                          {dates.length > 2 ? ` +${dates.length - 2}` : ""}
                        </span>
                      </span>
                    )}
              </span>

              {/* Internal notes — same log as the sheet, read and written from here
                  too. pointer-events-auto: the content around it deliberately lets
                  clicks fall through to the card, this must not. The negative margin
                  keeps a 44px tap target from padding the row out to 44px tall. */}
              <BandNotesPopover requestId={request.id} notes={bandNoteList} editable={editable}>
                <button
                  type="button"
                  title={`Band notes (internal) — ${bandNoteList.length}`}
                  className={cn(
                    "pointer-events-auto relative z-20 -my-3 -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-90",
                    // Reclaiming the gutter is free while this sits on its own line
                    // below the favourite. As a column it's a column like any other:
                    // no negative gutter, and ordered past the markers that are
                    // declared after it (the wrapper it sits in has dissolved, so
                    // DOM order alone would put it in the wrong place).
                    wide && "@2xl:order-1 @2xl:mr-0"
                  )}
                >
                  <span className="relative">
                    {/* Filled when there are notes, outline when there aren't — the
                        same on/off read as the favourite heart. Blue is its own
                        identity (like the heart's rose), independent of status. */}
                    <NotebookPen
                      className={cn(
                        "h-4 w-4 transition-colors",
                        bandNoteList.length > 0
                          ? "fill-blue-600 text-blue-600"
                          : "text-[#5F624F]/30"
                      )}
                      aria-hidden="true"
                    />
                    {bandNoteList.length > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#B45309] px-1 font-black text-[8px] text-white tabular-nums ring-2 ring-white">
                        {bandNoteList.length}
                      </span>
                    )}
                  </span>
                  <span className="sr-only">Band notes (internal): {bandNoteList.length}</span>
                </button>
              </BandNotesPopover>
            </div>
          </div>

          {/* Markers — what the act sent in, as presence rather than content; the
              material itself is a click away in the sheet. Both stay off until the
              row has actually spread, since a stacked card has nowhere to put them.
              Sized to the act name, so they read as row data, not decoration. */}
          {wide && (
            <span
              className={cn(
                "hidden shrink-0 items-center justify-center gap-1 @2xl:flex @2xl:w-12",
                videos.length > 0 ? "text-[#5F624F]" : MARKER_OFF
              )}
              title={`${videos.length} video${videos.length === 1 ? "" : "s"} attached`}
            >
              <Video className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-black text-sm tabular-nums">{videos.length}</span>
              <span className="sr-only">video{videos.length === 1 ? "" : "s"} attached</span>
            </span>
          )}

          {/* Every platform always shows — an absent link is a fact worth seeing,
              so it greys out rather than disappearing and shifting the others.
              Four across once there's room for them; 2x2 when the card is tighter
              (two columns splitting the board), which keeps the marker square
              instead of squeezing the row. */}
          {wide && (
            <span className="hidden shrink-0 place-items-center gap-1 @2xl:grid @2xl:w-11 @2xl:grid-cols-2 @4xl:flex @4xl:w-28 @4xl:items-center @4xl:justify-between">
              {SOCIAL_ORDER.map((key) => {
                const meta = SOCIAL_META[key];
                const Icon = meta.icon;
                const has = Boolean((request.social_links?.[key] ?? "").trim());
                const label = has ? `Has a ${meta.label} link` : `No ${meta.label} link`;
                return (
                  <span key={key} className="inline-flex" title={label}>
                    <Icon className={cn("h-4 w-4 shrink-0", has ? meta.glyph : MARKER_OFF)} aria-hidden="true" />
                    <span className="sr-only">{label}</span>
                  </span>
                );
              })}
            </span>
          )}

          {/* Favourite — persists on click, no Save needed. Pinned to the right
              edge while the card is stacked, dropping clear of the lifecycle tag
              that now owns the corner; the row's last column once it spreads.
              `relative` (not static) so it keeps its z-index either way — which
              is also why the drop has to be undone there, or it would shift the
              heart down out of the row. */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-pressed={isFavorite}
            title={isFavorite ? "Remove from favourites" : "Mark as favourite"}
            className={cn(
              "pointer-events-auto absolute right-0 z-20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-90",
              hasRibbon ? "top-4" : "top-0",
              wide && "@2xl:relative @2xl:top-0 @2xl:order-2"
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                isFavorite ? "fill-rose-500 text-rose-500" : "text-[#5F624F]/30"
              )}
              aria-hidden="true"
            />
            <span className="sr-only">{isFavorite ? "Favourited" : "Mark as favourite"}</span>
          </button>
        </div>
      </div>

      {/* Bottom sheet */}
      {/* Dismissals route through requestClose so unsaved edits can't slip away;
          opening stays direct. */}
      <Sheet open={open} onOpenChange={(next) => (next ? setSheetOpen(true) : requestClose())}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="left-1/2 flex h-auto max-h-[90vh] w-full max-w-6xl -translate-x-1/2 flex-col rounded-[2.5rem] rounded-t-[2.5rem] border-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl outline-none sm:bottom-6 lg:max-h-[94vh]"
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
                  live on the schedule; red = either linked but deactivated, or booked
                  with no event ever placed (a data fault worth shouting about);
                  blue = nothing linked. */}
              <div className="flex shrink-0 items-center gap-1.5">
                {showEventBadge &&
                  (eventHref ? (
                    <Link
                      href={eventHref}
                      title={
                        eventIsActive
                          ? `View linked event #${request.event_id}`
                          : `View linked event #${request.event_id} — currently off the schedule`
                      }
                      className={cn(
                        "group inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 font-black text-[10px] tracking-wider uppercase transition-colors sm:h-9",
                        eventIsActive
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      )}
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

                {/* The same notes log the card row shows — notes save themselves,
                    so this sits outside the sheet's Save/discard cycle. */}
                <BandNotesPopover requestId={request.id} notes={bandNoteList} editable={editable}>
                  <button
                    type="button"
                    aria-label={`Band notes (internal): ${bandNoteList.length}`}
                    title="Band notes (internal)"
                    className={cn(
                      "relative flex h-11 w-11 items-center justify-center rounded-xl border transition-colors sm:h-9 sm:w-9",
                      // Blue when notes exist — the same on/off identity the card row's
                      // NotebookPen carries, independent of the request's status hue.
                      bandNoteList.length > 0
                        ? "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                        : "border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA]"
                    )}
                  >
                    <NotebookPen className={cn("h-4 w-4", bandNoteList.length > 0 && "fill-blue-600")} />
                    {bandNoteList.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B45309] px-1 font-black text-[9px] text-white tabular-nums ring-2 ring-white">
                        {bandNoteList.length}
                      </span>
                    )}
                  </button>
                </BandNotesPopover>

                {/* System information — audit trail. Reference-only, so it sits
                    behind an icon here rather than as a card in the rail. */}
                <Popover open={sysInfoOpen} onOpenChange={setSysInfoOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="System information"
                      title="System information"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E6DFC8] bg-white text-[#5F624F] transition-colors hover:bg-[#F7F4EA] hover:text-[#5C4033] sm:h-9 sm:w-9"
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
                    {/* Decline reason — previewed short, opens into an editable box
                        so a badly-worded reason can be corrected after the fact. */}
                    {(isDeclined || !!declineReason) && (
                      <div className="flex items-start justify-between gap-4 border-b border-[#E6DFC8] px-4 py-2 last:border-0 sm:px-5">
                        <span className="shrink-0 pt-0.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                          Decline Reason
                        </span>
                        {declineReasonOpen ? (
                          <textarea
                            aria-label="Decline reason"
                            value={adminNotes}
                            rows={3}
                            autoFocus
                            placeholder="Why was this declined?"
                            onChange={(e) => setAdminNotes(e.target.value)}
                            className="min-w-0 flex-1 resize-none rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2.5 py-1.5 text-[13px] text-[#1F1F1A] transition-all outline-none placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeclineReasonOpen(true)}
                            title={declineReason || "Add a reason"}
                            className="min-w-0 text-right text-[13px] font-semibold text-[#1F1F1A] transition-colors hover:text-[#5C4033]"
                          >
                            {declineReason ? (
                              <span className="italic">
                                &quot;{declineIsLong ? declineHead : declineReason}
                                {declineIsLong && <span className="font-black text-[#5C4033] not-italic">…</span>}
                                &quot;
                              </span>
                            ) : (
                              <span className="text-[#5F624F]/50">Add a reason…</span>
                            )}
                          </button>
                        )}
                      </div>
                    )}
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
                  // A tinted espresso pill so the toggle reads as a control, set off
                  // from the sheet's #F7F4EA and the #E6DFC8 section headers alike.
                  const toggleClass =
                    "flex shrink-0 items-center gap-1 rounded-lg border border-[#5C4033]/15 bg-[#5C4033]/8 px-2 py-1 font-black text-[10px] tracking-wide text-[#5C4033] uppercase transition-colors hover:bg-[#5C4033]/15 hover:text-[#1F1F1A]";
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
              {(showSocials || sheetVideos.length > 0) && (
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

                  {/* Videos — the applicant's, plus any the admin adds here. Saved
                      ones play inline (facade: loads on click); a fresh pick shows
                      its upload progress until it lands a url. Only rule off from the
                      socials above when there's a row of pills to divide from. */}
                  {(sheetVideos.length > 0 || editable) && (
                    <div className={cn(showSocials && "border-t border-[#E6DFC8]")}>
                      {(sheetVideos.length > 0 || (editable && sheetVideos.length < MAX_VIDEOS)) && (
                        <div
                          className={cn(
                            "grid grid-cols-2 gap-3 px-4 pt-3 sm:grid-cols-3 sm:px-5",
                            // Helper line below carries the bottom padding when it shows;
                            // otherwise the grid owns it.
                            !(editable && sheetVideos.length < MAX_VIDEOS) && "pb-3"
                          )}
                        >
                          {sheetVideos.map((v, i) => (
                            <div key={v.id} className="min-w-0">
                              {v.url ? (
                                <VideoFacade url={v.url} title={`Video ${i + 1}`} />
                              ) : (
                                <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border border-black/10 bg-[#1F1F1A]">
                                  {v.previewUrl && (
                                    <video
                                      src={`${v.previewUrl}#t=0.1`}
                                      muted
                                      playsInline
                                      preload="metadata"
                                      aria-hidden="true"
                                      tabIndex={-1}
                                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                                    />
                                  )}
                                  <span className="absolute inset-0 bg-black/50" />
                                  {v.error ? (
                                    <span className="relative flex flex-col items-center gap-1 px-2 text-center">
                                      <AlertCircle className="h-5 w-5 text-red-300" />
                                      <span className="text-[10px] font-bold text-red-200">{v.error}</span>
                                    </span>
                                  ) : (
                                    <span className="relative flex flex-col items-center gap-1.5">
                                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                                      <span className="font-black text-[10px] tracking-wide text-white uppercase tabular-nums">
                                        {v.progress ?? 0}%
                                      </span>
                                    </span>
                                  )}
                                </div>
                              )}
                              {editable ? (
                                <div className="mt-1.5 flex items-center gap-1">
                                  <input
                                    type="text"
                                    aria-label={`Description for video ${i + 1}`}
                                    maxLength={120}
                                    value={v.description}
                                    onChange={(e) => updateSheetVideo(v.id, { description: e.target.value })}
                                    placeholder="Add a description…"
                                    className="min-w-0 flex-1 rounded-lg border border-[#E6DFC8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1F1F1A] transition-all outline-none placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeSheetVideo(v.id)}
                                    aria-label={`Remove video ${i + 1}`}
                                    title="Remove video"
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E6DFC8] bg-white text-[#5F624F]/60 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <p
                                  title={v.description || undefined}
                                  className="mt-1.5 line-clamp-2 text-[11px] font-medium text-[#5F624F]"
                                >
                                  {v.description || `Video ${i + 1}`}
                                </p>
                              )}
                            </div>
                          ))}

                          {/* Add more — a small icon button sitting in the grid to the
                              right of the last video. Same white/#E6DFC8 treatment as the
                              social row's edit button. Reuses the public form's resumable
                              upload, so a big performance video survives a flaky
                              connection; centred in an aspect-video cell so it lines up
                              with the thumbnails beside it. */}
                          {editable && sheetVideos.length < MAX_VIDEOS && (
                            <div className="flex aspect-video min-w-0 items-center justify-center">
                              <input
                                ref={videoInputRef}
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg"
                                multiple
                                title="Upload videos"
                                className="hidden"
                                onChange={handleVideoSelect}
                              />
                              <button
                                type="button"
                                onClick={() => videoInputRef.current?.click()}
                                title={sheetVideos.length === 0 ? "Upload videos" : "Add another video"}
                                aria-label={sheetVideos.length === 0 ? "Upload videos" : "Add another video"}
                                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E6DFC8] bg-white text-[#5F624F] transition-colors hover:bg-[#F7F4EA] hover:text-[#5C4033]"
                              >
                                <Upload className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {editable && sheetVideos.length < MAX_VIDEOS && (
                        <p className="px-4 pt-2 pb-3 text-[10px] leading-snug text-[#5F624F]/70 sm:px-5">
                          MP4, WebM or MOV — max 250 MB each. Applied when you hit Save Changes.{" "}
                          {sheetVideos.length}/{MAX_VIDEOS}
                        </p>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {/* Band Notes now live in the sheet-header popover (internal, quick
                  access at any scroll position) — see the NotebookPen button above. */}

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
          <div className="z-40 shrink-0 rounded-b-4xl border-t-2 border-[#5C4033]/15 bg-[#E6DFC8] px-4 py-3 pb-6 sm:px-6">
            <div className="space-y-2">
                {/* Splits only for the decline reason; the slot console now carries
                    its own warnings inline, so it keeps the full width otherwise. */}
                <div className={cn("grid gap-3", isDeclined && "sm:grid-cols-2")}>
                  {/* Left: the slot being committed to, with its warnings under the
                      fields. The blocked Booked chip flashes it via revealSlot(). */}
                  <div
                    className={cn(
                      // This is what you commit to, so it's dressed to outrank
                      // everything around it: a raised card that lifts off the tan
                      // footer with a strong shadow and heavy border, and whose
                      // background itself carries the state — amber while a slot is
                      // still required, red when the chosen slot clashes, calm cream
                      // once it's set. The flash still pulses when the Booked chip
                      // points here.
                      "space-y-2 rounded-2xl border-2 p-3 shadow-lg transition-all",
                      hasClashes
                        ? "border-red-300 bg-red-50"
                        : slotWarning
                          ? "border-l-4 border-amber-300 border-l-amber-400 bg-amber-50"
                          : slotIsSet
                            ? "border-[#1B4332]/30 bg-[#F7F4EA] shadow-[#1B4332]/25"
                            : "border-[#5C4033]/25 bg-[#F7F4EA]",
                      slotFlash && "ring-2 ring-amber-400/70"
                    )}
                  >
                    <span
                      className={cn(
                        "flex flex-wrap items-center gap-2 font-black text-[11px] tracking-wide uppercase",
                        slotIsSet ? "text-[#1B4332]" : "text-[#5C4033]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white",
                          slotIsSet ? "bg-[#1B4332]" : "bg-[#5C4033]"
                        )}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                      </span>
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
                              !selectedDate && slotWarning
                                ? "border-amber-300"
                                : slotIsSet
                                  ? "border-[#1B4332]"
                                  : "border-[#E6DFC8]"
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
                            : slotIsSet
                              ? "border-[#1B4332]"
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
                    {/* Warning (slot required) and error (clash) sit under the fields
                        they're about, inside the console rather than off to the side. */}
                    {slotWarning && <FieldMessage warning={slotWarning} />}
                    {clashes.length > 0 && <ClashList clashes={clashes} />}
                  </div>

                  {/* Right: once declined, the reason the band was given — editable,
                      in case it needs rewording. */}
                  {isDeclined && (
                    <div className="flex flex-col">
                      <span className="mb-1.5 flex items-center gap-1.5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                        <MessageSquareQuote className="h-3.5 w-3.5" />
                        Decline Reason for Applicant
                      </span>
                      <textarea
                        aria-label="Decline reason for applicant"
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="The reason given to the band when this was declined..."
                        className="w-full flex-1 resize-none rounded-2xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-[13px] text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {error && <p className="text-xs font-bold text-red-500">{error}</p>}

                {/* All stage moves — including the Decline exit — live in the header
                    stepper now. The footer keeps only Cancel and Save. */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="mr-auto flex h-11 flex-1 items-center justify-center rounded-xl border-2 border-[#E6DFC8] bg-white px-5 font-black text-[10px] tracking-wide text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA] disabled:opacity-50 sm:flex-initial"
                  >
                    Cancel
                  </button>
                  {hasChanges && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isPending || hasClashes || videosUploading}
                      title={
                        hasClashes
                          ? clashWarning
                          : videosUploading
                            ? "Wait for videos to finish uploading."
                            : undefined
                      }
                      className="flex h-11 min-w-24 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1B4332] px-5 font-black text-[10px] tracking-widest text-white uppercase shadow-lg transition-all hover:bg-[#1B4332]/85 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:flex-initial"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Changes
                    </button>
                  )}
                </div>
            </div>
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
