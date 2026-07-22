"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
  BellRing,
  CalendarDays,
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
  Undo2,
  User,
  Video,
  X,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok, SiSpotify } from "react-icons/si";
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

const MAX_VIDEOS = 10;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250 MB

const NOTE_PREVIEW_LEN = 50;

const PREFERRED_DATES_VISIBLE = 4;

const DECLINE_PREVIEW_LEN = 28;

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
}

export interface BandNote {
  id: string;
  body: string;
  created_at: string;
  author?: { full_name: string | null } | { full_name: string | null }[] | null;
}

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
  spotify_url: string | null;
  music_acts_id: string | null;
  video_urls: string[] | null;
  video_descriptions: string[] | null;
  preferred_dates: string[] | null;
  notes: string | null;
  band_notes: string | null;
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
  updated_by_employee?: { full_name: string | null } | null;
  linked_event?: LinkedEvent | LinkedEvent[] | null;
}

interface SheetVideo {
  id: string;
  url: string | null;
  description: string;
  previewUrl?: string;
  uploading?: boolean;
  progress?: number;
  error?: string | null;
}

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

const STATUS_TOAST: Record<BandStatus, string> = {
  new: "Moved to New",
  reviewing: "Moved to Reviewing",
  offered: "Offer sent",
  booked: "Booking confirmed",
  declined: "Application declined",
};

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

const MARKER_OFF = "text-[#5F624F]/25";

const SOCIAL_ORDER: (keyof SocialLinks)[] = ["instagram", "facebook", "youtube", "tiktok"];

function normalizeSocials(links: SocialLinks | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SOCIAL_ORDER) {
    const value = (links?.[key] ?? "").trim();
    if (value) out[key] = value;
  }
  return out;
}

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

const PIPELINE: BandStatus[] = ["new", "reviewing", "offered", "booked"];

type StageTone = "current" | "past" | "future";

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
  reason: string | null;
  isPending: boolean;
  anyPending: boolean;
  onSelect: (next: BandStatus) => void;
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
      aria-disabled={!interactive || undefined}
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 rounded-full border-2 px-3.5 transition-all sm:h-10",
        tone === "current" && cn(t.bg, t.text, t.border),
        tone === "past" && "border-[#E6DFC8] bg-white text-[#5F624F]",
        tone === "future" && "border-transparent text-[#5F624F]/45",
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
  declineReason,
  onDeclineReasonChange,
}: {
  status: string;
  onSelect: (next: BandStatus) => void;
  pendingStage: BandStatus | null;
  blockers: Partial<Record<BandStatus, string | undefined>>;
  onRevealSlot: () => void;
  declineReason: string;
  onDeclineReasonChange: (v: string) => void;
}) {
  const transitions = BAND_TRANSITIONS[status as BandStatus] ?? [];
  const currentLabel = statusTheme[status]?.label ?? status;
  const reachable = (s: BandStatus) => transitions.some((t) => t.next === s);

  const blockedReason = (s: BandStatus): string | null => {
    if (!reachable(s)) return `Not available from ${currentLabel}`;
    return blockers[s] ?? null;
  };

  const chip = (s: BandStatus, tone: StageTone) => {
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

  if (idx === -1) {
    const t = statusTheme[status];
    if (!t) return null;
    const exits = transitions.filter((tr) => PIPELINE.includes(tr.next));
    return (
      <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto" aria-label={`Status: ${t.label}`}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-current="step"
              title="Decline reason for applicant — click to view or edit"
              className={cn(
                "relative flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 transition-all hover:brightness-95 sm:h-10",
                t.bg,
                t.text,
                t.border
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", t.dot)} />
              <span className="font-black text-[10px] tracking-widest uppercase">{t.label}</span>
              {declineReason.trim() && (
                <BellRing
                  aria-label="A reason has been recorded"
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 fill-yellow-300 text-yellow-500"
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 overflow-hidden rounded-2xl border-2 border-[#E6DFC8] bg-white p-0 sm:w-96">
            <span className="flex items-center gap-1.5 border-b border-[#E6DFC8] bg-[#E6DFC8] px-4 py-2.5 font-black text-[10px] tracking-wide text-[#5C4033] uppercase">
              <MessageSquareQuote className="h-3.5 w-3.5" />
              Decline Reason for Applicant
            </span>
            <div className="p-3">
              <textarea
                aria-label="Decline reason for applicant"
                value={declineReason}
                onChange={(e) => onDeclineReasonChange(e.target.value)}
                rows={4}
                placeholder="The reason given to the band when this was declined..."
                className="w-full resize-none rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-[13px] text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
              />
              <p className="mt-1.5 text-[10px] leading-snug text-[#5F624F]/70">
                Saved when you hit Save Changes.
              </p>
            </div>
          </PopoverContent>
        </Popover>
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
          {i > 0 && (
            <ArrowRight
              className={cn("h-4 w-4 shrink-0", i <= idx ? "text-[#5C4033]" : "text-[#5F624F]/30")}
              aria-hidden="true"
            />
          )}
          {chip(s, i === idx ? "current" : i < idx ? "past" : "future")}
        </React.Fragment>
      ))}

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
      <div
        className={cn(
          "flex w-full items-center gap-3 bg-[#E6DFC8] px-4 py-3 sm:px-5",
          open && "border-b border-[#E6DFC8]"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center text-left transition-all hover:brightness-95"
        >
          <span className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase">{title}</span>
        </button>
        {headerRight}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="shrink-0 transition-all hover:brightness-95"
        >
          <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      <div className={cn(!open && "hidden")}>{children}</div>
    </div>
  );
}

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

const LIFECYCLE_META: Record<BandLifecycleStage, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-gray-500" },
  upcoming: { label: "Upcoming", className: "bg-blue-600" },
};

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
  wide?: boolean;
  lifecycle?: BandLifecycleStage | null;
}) {
  const { confirm: baseConfirm, ConfirmDialogUI } = useConfirm();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const confirmOpen = useRef(false);
  const confirm = useCallback(
    async (opts: Parameters<typeof baseConfirm>[0]) => {
      confirmOpen.current = true;
      try {
        return await baseConfirm(opts);
      } finally {
        confirmOpen.current = false;
      }
    },
    [baseConfirm]
  );
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [selectedDate, setSelectedDate] = useState(request.selected_date || "");
  const [selectedStartTime, setSelectedStartTime] = useState(toHHMM(request.selected_start_time));
  const [selectedEndTime, setSelectedEndTime] = useState(toHHMM(request.selected_end_time));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [clashes, setClashes] = useState<ClashEvent[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingStage, setPendingStage] = useState<BandStatus | null>(null);
  const [slotFlash, setSlotFlash] = useState(false);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const askingToClose = useRef(false);
  const noteDraft = useRef("");

  const [isFavorite, setIsFavorite] = useState(request.is_favorite);
  const [, startFavTransition] = useTransition();
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [declineReasonOpen, setDeclineReasonOpen] = useState(false);

  const [actName, setActName] = useState(request.group_name ?? "");
  const [reqType, setReqType] = useState(request.type ?? "");
  const [genre, setGenre] = useState(request.genre ?? "");
  const [bookerName, setBookerName] = useState(request.booker_name ?? "");
  const [email, setEmail] = useState(request.email ?? "");
  const [phone, setPhone] = useState(request.phone_no ?? "");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(request.social_links ?? {});
  const [socialEditorOpen, setSocialEditorOpen] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState(request.spotify_url ?? "");
  const [paymentAmount, setPaymentAmount] = useState(request.payment_amount != null ? String(request.payment_amount) : "");
  const [paidAmount, setPaidAmount] = useState(request.paid_amount != null ? String(request.paid_amount) : "");
  const [bankAccountName, setBankAccountName] = useState(request.bank_account_name ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(request.bank_account_no ?? "");
  const [bankSortCode, setBankSortCode] = useState(request.bank_sort_code ?? "");
  const [bankPaymentRef, setBankPaymentRef] = useState(request.bank_payment_ref ?? "");
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [sysInfoOpen, setSysInfoOpen] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const [sheetVideos, setSheetVideos] = useState<SheetVideo[]>(() => seedSheetVideos(request));
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoUploadHandles = useRef<Record<string, ResumableHandle>>({});

  const status = normStatus(request.status);
  const theme = statusTheme[status] || statusTheme.new;
  const editable = status !== "declined";

  const bookingNote = (request.notes ?? "").trim();
  const noteIsLong = bookingNote.length > NOTE_PREVIEW_LEN;
  const noteHead = bookingNote.slice(0, NOTE_PREVIEW_LEN).trimEnd();

  function setSheetOpen(next: boolean) {
    setOpen(next);
    window.history.replaceState(null, "", next ? `${LIST_HREF}?open=${request.id}` : LIST_HREF);
  }

  useEffect(() => {
    const openId = searchParams.get("open") ?? new URLSearchParams(window.location.search).get("open");
    if (openId !== request.id) return;
    setOpen(true);
    window.history.replaceState(null, "", LIST_HREF);
  }, [searchParams, request.id]);

  const eventHref = request.event_id
    ? `/event-setups/events?open=${request.event_id}&back=${encodeURIComponent(`${LIST_HREF}?open=${request.id}`)}`
    : null;
  const linkedEvent = Array.isArray(request.linked_event) ? request.linked_event[0] : request.linked_event;
  const eventIsActive = linkedEvent?.is_active === true;
  const hasRibbon = !!(request.type || request.genre || lifecycle);
  const shortRef = request.id.slice(0, 8).toUpperCase();

  const hasSlot = status === "offered" || status === "booked";
  const isWorkingStage = status === "new" || status === "reviewing" || status === "offered";
  const showEventBadge = !!eventHref || !isWorkingStage;
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

  const isDeclined = status === "declined";
  const declineReason = adminNotes.trim();
  const declineIsLong = declineReason.length > DECLINE_PREVIEW_LEN;
  const declineHead = declineReason.slice(0, DECLINE_PREVIEW_LEN).trimEnd();

  const hasClashes = clashes.length > 0;
  const clashWarning = hasClashes
    ? `Clashes with ${clashes.map((c) => c.title).join(", ")} — pick another time.`
    : undefined;
  const slotIsSet = !!selectedDate && !!selectedStartTime && !!selectedEndTime && !hasClashes;

  const hasAnySocial = SOCIAL_ORDER.some((k) => (socialLinks[k] ?? "").trim());
  const hasSpotify = !!spotifyUrl.trim();
  const showSocials = editable || hasAnySocial || hasSpotify;

  const videos = (request.video_urls ?? [])
    .map((url, i) => ({ url, description: (request.video_descriptions ?? [])[i]?.trim() || "" }))
    .filter((v) => Boolean(v.url));
  const dates = (request.preferred_dates ?? []).filter(Boolean);
  const bandNoteList = request.band_notes_list ?? [];
  const hasFee = (request.payment_amount ?? 0) > 0;

  const amountNum = paymentAmount === "" ? 0 : Number(paymentAmount) || 0;
  const paidNum = paidAmount === "" ? 0 : Number(paidAmount) || 0;
  const derivedStatus = derivePaymentStatus(amountNum, paidNum);
  const isNoPayment = derivedStatus === "no_payment";
  const initialPaymentOpen =
    derivePaymentStatus(request.payment_amount ?? 0, request.paid_amount ?? 0) !== "no_payment";

  const origDate = request.selected_date || "";
  const origStart = toHHMM(request.selected_start_time);
  const origEnd = toHHMM(request.selected_end_time);
  const dateTimeChanged =
    selectedDate !== origDate || selectedStartTime !== origStart || selectedEndTime !== origEnd;

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
    spotifyUrl !== (request.spotify_url ?? "") ||
    videosChanged ||
    adminNotes !== (request.admin_notes ?? "");
  const hasChanges = detailsChanged || dateTimeChanged;

  const detailFields = () => ({
    group_name: actName || null,
    type: reqType || null,
    genre: genre || null,
    booker_name: bookerName,
    email,
    phone_no: phone || null,
    social_links: normalizeSocials(socialLinks),
    spotify_url: spotifyUrl.trim() || null,
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

  useEffect(() => {
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
        if (!cancelled) setClashes([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, selectedDate, selectedStartTime, selectedEndTime, request.event_id]);

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

  async function requestClose() {
    if (!hasChanges) {
      setSheetOpen(false);
      return;
    }
    if (askingToClose.current || !!pendingStage) return;
    askingToClose.current = true;
    try {
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
        dismissible: false,
      });
      if (save) handleSave();
      else handleCancel();
    } finally {
      askingToClose.current = false;
    }
  }

  function handleCancel() {
    setActName(request.group_name ?? "");
    setReqType(request.type ?? "");
    setGenre(request.genre ?? "");
    setBookerName(request.booker_name ?? "");
    setEmail(request.email ?? "");
    setPhone(request.phone_no ?? "");
    setSocialLinks(request.social_links ?? {});
    setSpotifyUrl(request.spotify_url ?? "");
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
    Object.values(videoUploadHandles.current).forEach((h) => h.abort());
    videoUploadHandles.current = {};
    sheetVideos.forEach((v) => v.previewUrl && URL.revokeObjectURL(v.previewUrl));
    setSheetVideos(seedSheetVideos(request));
    setClashes([]);
    setError(null);
    setSheetOpen(false);
  }

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

  function removeSheetVideo(id: string) {
    videoUploadHandles.current[id]?.abort();
    delete videoUploadHandles.current[id];
    setSheetVideos((prev) => {
      const entry = prev.find((v) => v.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((v) => v.id !== id);
    });
  }

  function revealSlot() {
    setSlotFlash(true);
    window.setTimeout(() => setSlotFlash(false), 1200);
    if (!selectedDate) setDatePickerOpen(true);
    else startTimeRef.current?.focus();
  }

  async function handleCopyRef() {
    try {
      await navigator.clipboard.writeText(request.id);
      toast.success("Reference copied");
    } catch {
      toast.error("Couldn't copy the reference");
    }
  }

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
        build: (note) => buildOutcomeEmail({ ...slot, outcome: "cancelled", notes: note }),
      },
    };

    const d = dialogs[newStatus];
    if (!d) return { ok: true, note: adminNotes };

    const initial = "";
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
    void (async () => {
      try {
        if (newStatus === "booked" || newStatus === "offered") {
          const c = await findClashes();
          if (c.length) return;
        }
        const { ok, note } = await confirmEmail(newStatus);
        if (!ok) return;
        applyStatus(newStatus, note);
      } catch {
        setError("Failed to update. Please try again.");
      }
    })();
  }

  function applyStatus(newStatus: BandStatus, note: string) {
    setPendingStage(newStatus);
    startTransition(async () => {
      try {
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
        const result = await updateBandStatus(request.id, newStatus, note || undefined);
        if (result?.clashes?.length) {
          setClashes(result.clashes);
          toast.error("This slot now clashes with another event — pick another time.");
          return;
        }
        if (isDecline) setAdminNotes(note);
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

  function handleSave() {
    if (!hasChanges) return;
    setError(null);
    setClashes([]);
    void (async () => {
      try {
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
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border-2 border-[#E6DFC8] bg-white",
          "shadow-sm transition-all hover:bg-[#F7F4EA]/60 active:scale-[0.98]",
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

        {hasRibbon && (
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

        <div
          className={cn(
            "pointer-events-none relative z-10 flex items-center gap-3 px-3 pb-3 text-left",
            hasRibbon ? "pt-5" : "pt-3"
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border",
              theme.bg,
              theme.text,
              theme.border
            )}
          >
            {hasSlot && request.selected_date ? (
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

          <div className={cn("min-w-0 flex-1", wide && "@2xl:contents")}>
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
                {wide ? request.booker_name : abbreviateName(request.booker_name)}
              </p>
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

            <div
              className={cn(
                "mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5F624F]",
                wide && "@2xl:contents"
              )}
            >
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

              <BandNotesPopover requestId={request.id} notes={bandNoteList} editable={editable}>
                <button
                  type="button"
                  title={`Band notes (internal) — ${bandNoteList.length}`}
                  className={cn(
                    "pointer-events-auto relative z-20 -my-3 -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-90",
                    wide && "@2xl:order-1 @2xl:mr-0"
                  )}
                >
                  <span className="relative">
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

      <Sheet open={open} onOpenChange={(next) => (next ? setSheetOpen(true) : requestClose())}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (confirmOpen.current) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (confirmOpen.current) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (confirmOpen.current) e.preventDefault();
          }}
          className="left-1/2 flex h-auto max-h-[90vh] w-full max-w-6xl -translate-x-1/2 flex-col rounded-[2.5rem] rounded-t-[2.5rem] border-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl outline-none sm:bottom-6 lg:max-h-[94vh]"
        >
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#E6DFC8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate font-black text-lg leading-tight tracking-tight text-[#1F1F1A] uppercase">
                  {request.group_name || request.booker_name}
                  <span className="ml-1.5 text-sm font-semibold tracking-wide text-[#5F624F] normal-case italic">
                    (#Ref: {shortRef})
                  </span>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Review and manage this band request.
                </SheetDescription>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? "Remove from favourites" : "Mark as favourite"}
                  title={isFavorite ? "Remove from favourites" : "Mark as favourite"}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E6DFC8] bg-white transition-colors hover:bg-[#F7F4EA] sm:h-9 sm:w-9"
                >
                  <Heart
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isFavorite ? "fill-rose-500 text-rose-500" : "text-[#5F624F]"
                    )}
                  />
                </button>

                <BandNotesPopover requestId={request.id} notes={bandNoteList} editable={editable}>
                  <button
                    type="button"
                    aria-label={`Band notes (internal): ${bandNoteList.length}`}
                    title="Band notes (internal)"
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[#E6DFC8] bg-white transition-colors hover:bg-[#F7F4EA] sm:h-9 sm:w-9"
                  >
                    <NotebookPen
                      className={cn(
                        "h-4 w-4 transition-colors",
                        bandNoteList.length > 0 ? "fill-blue-600 text-blue-600" : "text-[#5F624F]"
                      )}
                    />
                    {bandNoteList.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B45309] px-1 font-black text-[9px] text-white tabular-nums ring-2 ring-white">
                        {bandNoteList.length}
                      </span>
                    )}
                  </button>
                </BandNotesPopover>

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
                      label="Reference"
                      value={
                        <button
                          type="button"
                          onClick={handleCopyRef}
                          title={request.id}
                          aria-label={`Copy reference ${request.id}`}
                          className="group inline-flex items-center gap-1.5 font-bold text-[#5C4033] tabular-nums transition-colors hover:text-[#1F1F1A]"
                        >
                          <Hash className="h-3 w-3 shrink-0" />
                          <span>{shortRef}</span>
                          <Copy className="h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                        </button>
                      }
                    />
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
            <div className="mt-3 border-t border-[#E6DFC8]" />
            <StageStepper
              status={status}
              onSelect={handleAction}
              pendingStage={pendingStage}
              blockers={{ booked: slotWarning ?? clashWarning, offered: clashWarning }}
              onRevealSlot={revealSlot}
              declineReason={adminNotes}
              onDeclineReasonChange={setAdminNotes}
            />
          </div>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 pt-3 pb-6 sm:px-6">
            <div className="animate-in grid-cols-[minmax(0,1fr)_380px] items-start gap-8 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid">
              <div className="min-w-0 space-y-4 sm:space-y-5">
              <Section
                title="Event Details"
                headerRight={
                  showEventBadge ? (
                    eventHref ? (
                      <Link
                        href={eventHref}
                        onClick={(e) => e.stopPropagation()}
                        title={
                          eventIsActive
                            ? `View linked event #${request.event_id} — on the schedule`
                            : `View linked event #${request.event_id} — off the schedule`
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] tracking-wider uppercase transition-colors",
                          eventIsActive
                            ? "border-green-200 bg-green-50 hover:bg-green-100"
                            : "border-red-200 bg-red-50 hover:bg-red-100"
                        )}
                      >
                        <span>
                          Linked Event:{" "}
                          <span className="underline underline-offset-2">#{request.event_id}</span>
                        </span>
                        {eventIsActive ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                        )}
                      </Link>
                    ) : status === "booked" ? (
                      <span
                        title="This booking is booked but has no linked event"
                        className="inline-flex items-center gap-1.5 font-black text-[10px] tracking-wider text-red-700 uppercase"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Missing Linked Event
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-black text-[10px] tracking-wider text-blue-700 uppercase">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        No Linked Event
                      </span>
                    )
                  ) : undefined
                }
              >
                <EditRow label="Act Name" value={actName} onChange={setActName} editable={editable} placeholder="Act name" />
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

                      {(() => {
                        const url = spotifyUrl.trim();
                        const pillClass =
                          "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-all";
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Spotify"
                            className={cn(pillClass, "border-transparent bg-[#1DB954] text-white hover:opacity-90")}
                          >
                            <SiSpotify className="h-3 w-3 shrink-0" />
                            <span className="truncate">Spotify</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => setSocialEditorOpen(true)}
                            title={editable ? "Add Spotify link" : "No Spotify link"}
                            className={cn(
                              pillClass,
                              "border-dashed border-[#E6DFC8] bg-[#F7F4EA] text-[#5F624F]/50",
                              editable ? "hover:border-[#5C4033]/40 hover:text-[#5C4033]" : "cursor-not-allowed"
                            )}
                          >
                            <SiSpotify className="h-3 w-3 shrink-0" />
                            <span className="truncate">Spotify</span>
                          </button>
                        );
                      })()}

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
                              <label className="flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent bg-[#1DB954] text-white">
                                  <SiSpotify className="h-3.5 w-3.5" />
                                </span>
                                <span className="sr-only">Spotify URL</span>
                                <input
                                  type="url"
                                  value={spotifyUrl}
                                  onChange={(e) => setSpotifyUrl(e.target.value)}
                                  placeholder="Spotify URL"
                                  className="min-w-0 flex-1 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] px-2.5 py-1.5 text-xs text-[#1F1F1A] transition-all outline-none placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30"
                                />
                              </label>
                            </div>
                            <p className="mt-2 text-[10px] leading-snug text-[#5F624F]/70">
                              Applied when you hit Save Changes.
                            </p>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  )}

                  {(sheetVideos.length > 0 || editable) && (
                    <div className={cn(showSocials && "border-t border-[#E6DFC8]")}>
                      {(sheetVideos.length > 0 || (editable && sheetVideos.length < MAX_VIDEOS)) && (
                        <div
                          className={cn(
                            "grid grid-cols-2 gap-3 px-4 pt-3 sm:grid-cols-3 sm:px-5",
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


              </div>

              <div className="min-w-0 space-y-4 sm:space-y-5">
              <Section title="Contact Information">
                <EditRow label="Name" value={bookerName} onChange={setBookerName} editable={editable} placeholder="Contact name" />
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

              {isDeclined && (
                <Section title="Decline Reason for Applicant">
                  <div className="p-4 sm:p-5">
                    <textarea
                      aria-label="Decline reason for applicant"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={4}
                      placeholder="The reason given to the band when this was declined..."
                      className="w-full resize-none rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2 text-[13px] text-[#1F1F1A] transition-all placeholder:text-[#5F624F]/50 focus:border-[#5C4033]/30 focus:outline-none"
                    />
                    <p className="mt-1.5 text-[10px] leading-snug text-[#5F624F]/70">
                      Saved when you hit Save Changes.
                    </p>
                  </div>
                </Section>
              )}

              </div>
            </div>
            <div className="h-4" />
          </div>

          <div className="z-40 shrink-0 rounded-b-4xl border-t-2 border-[#5C4033]/15 bg-[#E6DFC8] px-4 py-3 pb-6 sm:px-6">
            <div className="space-y-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <div
                    className={cn(
                      "space-y-2 rounded-2xl border-2 p-3 shadow-lg transition-all",
                      "sm:w-3/5",
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
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span
                      className={cn(
                        "flex shrink-0 flex-wrap items-center gap-2 font-black text-[11px] tracking-wide uppercase",
                        slotIsSet ? "text-[#1B4332]" : "text-[#5C4033]"
                      )}
                    >
                      Selected Date &amp; Time
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                    </div>
                    {slotWarning && <FieldMessage warning={slotWarning} />}
                    {clashes.length > 0 && <ClashList clashes={clashes} />}
                  </div>

                  <div className="flex items-center justify-end gap-2 sm:flex-1">
                    {!hasChanges ? (
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isPending}
                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#E6DFC8] bg-white px-5 font-black text-[10px] tracking-widest text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA] disabled:opacity-50 sm:flex-initial sm:px-6"
                      >
                        <X className="h-3.5 w-3.5 shrink-0" />
                        Close
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={isPending}
                          title="Discard changes"
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#E6DFC8] bg-white px-5 font-black text-[10px] tracking-widest text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA] disabled:opacity-50 sm:flex-initial sm:px-6"
                        >
                          <Undo2 className="h-3.5 w-3.5 shrink-0" />
                          Cancel
                        </button>
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
                          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1B4332] px-5 font-black text-[10px] tracking-widest text-white uppercase shadow-lg transition-all hover:bg-[#1B4332]/85 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:flex-initial sm:px-6"
                        >
                          {isPending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Save className="h-3.5 w-3.5 shrink-0" />}
                          Save
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {error && <p className="text-xs font-bold text-red-500">{error}</p>}
            </div>
          </div>
          {ConfirmDialogUI}
        </SheetContent>
      </Sheet>
    </>
  );
}

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
