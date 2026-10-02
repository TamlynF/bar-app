"use client";

import React, { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  updatePrivateHireStatus,
  updatePrivateHireFields,
  getPrivateEventOptions,
  getClashingEvents,
  privateHireEmailSlotsAction,
  addPrivateHireNote,
  updatePrivateHireNote,
  deletePrivateHireNote,
} from "../actions";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Hash,
  Info,
  Loader2,
  Mail,
  MoreVertical,
  NotebookPen,
  MessageSquareQuote,
  Phone,
  Save,
  Undo2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SheetDragHandle } from "@/components/admin/sheet-drag-handle";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { attempt } from "@/lib/attempt";
import { CorrespondencePanel } from "@/components/admin/correspondence-panel";
import { BookingNoteWidget, InternalNotesPanel, type InternalNote } from "@/components/admin/internal-notes-panel";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { toHHMM, type ClashEvent } from "@/lib/event-clash";
import { unwrapSubtype, type PrivateHireSubtype } from "@/lib/private-hire-subtype";
import { buildPrivateHireOutcomeEmail, type PrivateHireEmail } from "@/lib/private-hire-emails";

type PrivateEventOptions = { types: { id: number; name: string }[]; subtypes: { id: number; name: string; event_types_id: number }[] };


const DECLINE_PREVIEW_LEN = 28;

interface LinkedEvent {
  is_active: boolean;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
}

export interface PrivateHireRequest {
  id: string;
  unread_emails?: number;
  internal_notes?: InternalNote[];
  full_name: string;
  email: string;
  phone_no: string | null;
  guest_count: number;
  preferred_date: string | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  selected_date: string | null;
  selected_start_time: string | null;
  selected_end_time: string | null;
  reason_for_hire: string;
  reason: string | null;
  event_id: number | null;
  event_subtypes_id: number | null;
  event_subtypes: PrivateHireSubtypeJoin | PrivateHireSubtypeJoin[] | null;
  additional_requirements: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by: number | null;
  updated_by_employee?: { full_name: string | null } | null;
  linked_event?: LinkedEvent | LinkedEvent[] | null;
}

type PrivateHireSubtypeJoin = Pick<PrivateHireSubtype, "id" | "name" | "default_event_title"> & { event_types_id: number };

type PrivateStage = "pending" | "confirmed" | "cancelled";

type PrivateAction = PrivateStage;

const STATUS_THEME: Record<
  string,
  { bg: string; text: string; border: string; dot: string; icon: React.ReactNode; label: string }
> = {
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    icon: <Clock className="h-5 w-5" />,
    label: "Pending",
  },
  confirmed: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    icon: <CheckCircle className="h-5 w-5" />,
    label: "Confirmed",
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    icon: <XCircle className="h-5 w-5" />,
    label: "Rejected",
  },
};

const PIPELINE: PrivateStage[] = ["pending", "confirmed"];

const TRANSITIONS: Record<PrivateStage, PrivateStage[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: ["pending"],
};

const STATUS_TOAST: Record<PrivateAction, string> = {
  pending: "Enquiry reopened",
  confirmed: "Booking confirmed",
  cancelled: "Request rejected",
};

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

function formatTime12(t?: string | null): string {
  const hhmm = toHHMM(t);
  if (!hhmm) return "";
  const [hh, mm] = hhmm.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

const formatTimeRange = (start?: string | null, end?: string | null) =>
  [formatTime12(start), formatTime12(end)].filter(Boolean).join(" – ");

function SheetRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 pt-0.5 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">
        {label}
      </span>
      <span className="text-right text-[13px] font-semibold text-[#20231A]">{value || "-"}</span>
    </div>
  );
}

function toTitleCase(s?: string | null): string {
  if (!s) return "";
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function EditRow({
  label, value, onChange, editable, type = "text", placeholder, readOnlyValue, trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  type?: string;
  placeholder?: string;
  readOnlyValue?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">{label}</span>
      {!editable ? (
        <span className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold text-[#20231A]">{readOnlyValue ?? (value || "-")}</span>
      ) : (
        <input
          aria-label={label}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
        />
      )}
      {trailing}
    </div>
  );
}

function ContactRow({ label, value, href, icon: Icon }: { label: string; value: string | null; href: string | null; icon: React.ElementType<{ className?: string }> }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-right text-[13px] font-semibold text-[#20231A]">{value || "-"}</span>
        {href && (
          <a
            href={href}
            aria-label={`${label}: ${value}`}
            title={`Open ${label.toLowerCase()}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] text-[#34451F] transition-colors hover:bg-[#34451F] hover:text-white"
          >
            <Icon className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  defaultOpen = true,
  className,
  headerRight,
  hint,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  headerRight?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-admin-line bg-white shadow-sm", className)}>
      <div
        className={cn(
          "flex min-h-12 w-full items-center gap-3 bg-admin-primary-soft px-4 py-2 transition-colors has-[button:active]:bg-[#D9E2C8] sm:px-5",
          open && "border-b border-[#D8D5C8]"
        )}
      >
        <div className="flex flex-1 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center text-left transition-all hover:brightness-95"
          >
            <span className="font-bold text-[14px] text-admin-ink">{title}</span>
          </button>
          {hint && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`About ${title}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-white/70 hover:text-admin-primary max-sm:h-11 max-sm:w-11"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="leading-snug">
                  {hint}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen((o) => !o)}
            className="min-h-8 flex-1 self-stretch"
          />
        </div>
        {headerRight}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="shrink-0 transition-all hover:brightness-95 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center"
        >
          <ChevronDown className={cn("h-4 w-4 text-[#5E6654] transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      <div className={cn(!open && "hidden")}>{children}</div>
    </div>
  );
}

const STAGE_SOLID: Record<string, string> = {
  pending: "bg-amber-600",
  confirmed: "bg-green-600",
  cancelled: "bg-red-600",
};

function stageHint(status: string, blocker?: string): string {
  switch (status) {
    case "pending":
      return blocker
        ? `New enquiry. ${blocker}`
        : "New enquiry. Confirm it once the details are agreed, or reject it.";
    case "confirmed":
      return "Confirmed and on the schedule.";
    case "cancelled":
      return "Rejected. Reopen it to move it back to pending.";
    default:
      return "";
  }
}

function StepNode({
  stage,
  index,
  tone,
  title,
  onClick,
  pending,
  disabled,
}: {
  stage: PrivateStage;
  index: number;
  tone: "current" | "past" | "future";
  title: string;
  onClick?: () => void;
  pending: boolean;
  disabled: boolean;
}) {
  const label = STATUS_THEME[stage]?.label ?? stage;

  if (tone === "current") {
    return (
      <span
        aria-current="step"
        title={title}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white shadow-sm",
          STAGE_SOLID[stage]
        )}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-white" aria-hidden="true" />
        {label}
      </span>
    );
  }

  const content = (
    <>
      {pending ? (
        <Loader2 className="h-6 w-6 shrink-0 animate-spin p-0.5 text-[#34451F]" />
      ) : tone === "past" ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#34451F] text-white">
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#D8D5C8] bg-white text-[11px] font-bold text-admin-muted tabular-nums">
          {index + 1}
        </span>
      )}
      <span
        className={cn(
          "text-[13px] font-semibold whitespace-nowrap max-sm:sr-only",
          tone === "past" ? "text-admin-ink" : "text-admin-muted"
        )}
      >
        {label}
      </span>
    </>
  );

  if (!onClick) {
    return (
      <span title={title} className="inline-flex shrink-0 items-center gap-2 px-1.5 py-1">
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-[#34451F]/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60 sm:min-h-9 sm:pr-2.5"
    >
      {content}
    </button>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "w-3 shrink-0 sm:w-8",
        done ? "h-0.5 rounded-full bg-[#34451F]" : "h-0 border-t-2 border-dashed border-[#D8D5C8]"
      )}
    />
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
  onSelect: (next: PrivateStage) => void;
  pendingStage: PrivateStage | null;
  blockers: Partial<Record<PrivateStage, string | undefined>>;
  onRevealSlot: () => void;
  declineReason: string;
  onDeclineReasonChange: (v: string) => void;
}) {
  const transitions = TRANSITIONS[status as PrivateStage] ?? [];
  const currentLabel = STATUS_THEME[status]?.label ?? status;
  const reachable = (s: PrivateStage) => transitions.includes(s);
  const idx = PIPELINE.indexOf(status as PrivateStage);
  const isRejected = idx === -1;
  const busy = !!pendingStage;

  const primaryNext: PrivateStage | undefined = isRejected
    ? "pending"
    : status === "pending"
      ? "confirmed"
      : undefined;
  const primaryBlocker = primaryNext && !isRejected ? blockers[primaryNext] : undefined;
  const hint = stageHint(status, primaryBlocker);

  const stepAction = (s: PrivateStage) => {
    if (!reachable(s)) return { title: `Not available from ${currentLabel}`, onClick: undefined };
    const blocker = blockers[s];
    if (blocker) return { title: blocker, onClick: onRevealSlot };
    return { title: `Move to ${STATUS_THEME[s]?.label ?? s}`, onClick: () => onSelect(s) };
  };

  return (
    <div className="mt-3 rounded-2xl border border-admin-line bg-admin-surface/50 px-3 py-2.5 sm:px-4">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 leading-tight">
            <p className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
              {isRejected ? "Status" : "Stage"}
            </p>
            <p className="text-[13px] font-bold text-admin-ink tabular-nums">
              {isRejected ? "Closed" : `${idx + 1} of ${PIPELINE.length}`}
            </p>
          </div>

          <ol
            className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-1.5"
            aria-label={isRejected ? "Status: Rejected" : `Stage ${idx + 1} of ${PIPELINE.length}: ${currentLabel}`}
          >
            {isRejected ? (
              <li className="flex items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-current="step"
                      title="Rejection reason for the enquirer - click to view or edit"
                      className={cn(
                        "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:brightness-95",
                        STAGE_SOLID.cancelled
                      )}
                    >
                      <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Rejected
                      {declineReason.trim() && (
                        <BellRing
                          aria-label="A reason has been recorded"
                          className="absolute -top-1.5 -right-1.5 h-4 w-4 fill-yellow-300 text-yellow-500"
                        />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white p-0 sm:w-96">
                    <span className="flex items-center gap-1.5 border-b border-[#D8D5C8] bg-admin-surface px-4 py-2.5 text-[13px] font-bold text-admin-ink">
                      <MessageSquareQuote className="h-3.5 w-3.5" />
                      Rejection reason for the enquirer
                    </span>
                    <div className="p-3">
                      <textarea
                        aria-label="Rejection reason for the enquirer"
                        value={declineReason}
                        onChange={(e) => onDeclineReasonChange(e.target.value)}
                        rows={4}
                        placeholder="The reason given to the enquirer when this was rejected..."
                        className="w-full resize-none rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2 text-[13px] text-[#20231A] transition-all placeholder:text-[#5E6654]/50 focus:border-[#34451F]/30 focus:outline-none"
                      />
                      <p className="mt-1.5 text-[12px] leading-snug text-admin-muted">Saved when you hit Save.</p>
                    </div>
                  </PopoverContent>
                </Popover>
              </li>
            ) : (
              PIPELINE.map((s, i) => {
                const tone = i === idx ? "current" : i < idx ? "past" : "future";
                const action = tone === "current" ? { title: "Current stage", onClick: undefined } : stepAction(s);
                return (
                  <li key={s} className="flex items-center gap-1 sm:gap-1.5">
                    {i > 0 && <StepConnector done={i <= idx} />}
                    <StepNode
                      stage={s}
                      index={i}
                      tone={tone}
                      title={action.title}
                      onClick={action.onClick}
                      pending={pendingStage === s}
                      disabled={busy}
                    />
                  </li>
                );
              })
            )}
          </ol>
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          {reachable("cancelled") && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect("cancelled")}
                title="Reject this enquiry"
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-[#B33A32] transition-colors hover:bg-admin-error-bg disabled:pointer-events-none disabled:opacity-50 sm:h-9"
              >
                {pendingStage === "cancelled" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Reject
              </button>
              {primaryNext && <span className="h-6 w-px shrink-0 bg-admin-line" aria-hidden="true" />}
            </>
          )}

          {primaryNext &&
            (primaryBlocker ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRevealSlot}
                title={primaryBlocker}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-[13px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50 sm:h-9 lg:flex-initial"
              >
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                Pick a slot to confirm
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(primaryNext)}
                className={cn(
                  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 sm:h-9 lg:flex-initial",
                  isRejected
                    ? "border border-[#34451F] text-[#34451F] hover:bg-[#E5EBD8]"
                    : "bg-[#34451F] text-white shadow-sm hover:bg-[#283719]"
                )}
              >
                {pendingStage === primaryNext ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : isRejected ? (
                  <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : null}
                {isRejected ? "Reopen" : "Confirm booking"}
                {!isRejected && pendingStage !== primaryNext && (
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            ))}
        </div>
      </div>

      {hint && (
        <p
          className={cn(
            "mt-2 text-[12px] leading-snug",
            primaryBlocker ? "font-semibold text-amber-800" : "text-admin-muted"
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function EmailPreview({ email, to }: { email: PrivateHireEmail; to: string }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-[#D8D5C8] bg-white p-3 text-left">
      <p className="font-bold text-[12px] whitespace-nowrap text-[#5E6654]">To: {to}</p>
      <p className="font-black text-xs text-[#20231A]">{email.subject}</p>
      <p className="text-xs text-[#5E6654]">{email.greeting}</p>
      {email.body.map((p, i) => (
        <p key={i} className="text-xs leading-relaxed text-[#5E6654]">{p}</p>
      ))}
      {email.noteLabel && (
        <div className="mt-1 rounded-lg border-l-4 border-[#34451F] bg-[#F4F1E8] px-3 py-2">
          <p className="font-bold text-[12px] whitespace-nowrap text-[#5E6654]">Note from our team</p>
          <p className="text-xs leading-relaxed text-[#20231A]">{email.noteLabel}</p>
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
}: {
  initialNote: string;
  onNoteChange: (v: string) => void;
  build: (note: string) => PrivateHireEmail;
  to: string;
  label: string;
  placeholder: string;
}) {
  const [note, setNote] = useState(initialNote);
  return (
    <div className="space-y-2 text-left">
      <label className="block">
        <span className="mb-1.5 block font-bold text-[12px] whitespace-nowrap text-[#5E6654]">
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
          className="w-full resize-none rounded-xl border border-[#D8D5C8] bg-white px-3 py-2 text-xs text-[#20231A] transition-all placeholder:text-[#5E6654]/50 focus:border-[#34451F]/30 focus:outline-none"
        />
      </label>
      <EmailPreview email={build(note)} to={to} />
    </div>
  );
}

const LIST_HREF = "/event-bookings/private-bookings";

export function PrivateHireCard({
  request,
  onSheetOpenChange,
}: {
  request: PrivateHireRequest;
  onSheetOpenChange?: (request: PrivateHireRequest, open: boolean) => void;
}) {
  const { confirm: baseConfirm, ConfirmDialogUI } = useConfirm();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const confirmOpen = useRef(false);

  // Deep link from elsewhere in admin - a customer's record, say - opens straight
  // onto this request rather than dropping you in the list to hunt for it.
  const requestedId = searchParams.get("request");
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current || requestedId !== request.id) return;
    openedFromLink.current = true;
    setOpen(true);
  }, [requestedId, request.id]);
  async function confirm(opts: Parameters<typeof baseConfirm>[0]) {
    confirmOpen.current = true;
    let ok = false;
    await attempt(
      async () => {
        ok = await baseConfirm(opts);
      },
      () => {}
    );
    confirmOpen.current = false;
    return ok;
  }

  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingStage, setPendingStage] = useState<PrivateStage | null>(null);
  const [clashes, setClashes] = useState<ClashEvent[]>([]);
  const [slotFlash, setSlotFlash] = useState(false);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [sysInfoOpen, setSysInfoOpen] = useState(false);
  const [declineReasonOpen, setDeclineReasonOpen] = useState(false);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const slotRowRef = useRef<HTMLDivElement>(null);
  const sheetBodyRef = useRef<HTMLDivElement>(null);
  const askingToClose = useRef(false);
  const noteDraft = useRef("");

  const status = normStatus(request.status);
  const theme = STATUS_THEME[status] ?? STATUS_THEME.pending;
  const editable = status !== "cancelled";
  const isCancelled = status === "cancelled";

  const currentSub = unwrapSubtype(request.event_subtypes);
  const shortRef = request.id.slice(0, 8).toUpperCase();

  const [guestCount, setGuestCount] = useState(String(request.guest_count ?? ""));
  const [subtypeId, setSubtypeId] = useState(request.event_subtypes_id != null ? String(request.event_subtypes_id) : "");
  const [selectedDate, setSelectedDate] = useState(request.selected_date || "");
  const [selectedStartTime, setSelectedStartTime] = useState(toHHMM(request.selected_start_time));
  const [selectedEndTime, setSelectedEndTime] = useState(toHHMM(request.selected_end_time));
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const typeId = currentSub?.event_types_id != null ? String(currentSub.event_types_id) : "";

  const [options, setOptions] = useState<PrivateEventOptions | null>(null);
  useEffect(() => {
    if (!open || options) return;
    getPrivateEventOptions().then(setOptions).catch(() => {});
  }, [open, options]);
  const subtypeOptions = (options?.subtypes ?? []).filter((s) => !typeId || String(s.event_types_id) === typeId);

  const typeName = toTitleCase(options?.types.find((t) => String(t.id) === typeId)?.name);
  const subtypeName =
    toTitleCase(subtypeOptions.find((s) => String(s.id) === subtypeId)?.name ?? currentSub?.name);

  const bookingNote = (request.additional_requirements ?? "").trim();
  const internalNotes = request.internal_notes ?? [];

  const declineReason = adminNotes.trim();
  const declineIsLong = declineReason.length > DECLINE_PREVIEW_LEN;
  const declineHead = declineReason.slice(0, DECLINE_PREVIEW_LEN).trimEnd();

  const eventHref = request.event_id
    ? `/event-setups/events?open=${request.event_id}&back=${encodeURIComponent(`${LIST_HREF}?open=${request.id}`)}`
    : null;
  const linkedEvent = Array.isArray(request.linked_event) ? request.linked_event[0] : request.linked_event;
  const eventIsActive = linkedEvent?.is_active === true;

  const isWorkingStage = status === "pending";
  const showEventBadge = !!eventHref || !isWorkingStage;
  const needsDate = isWorkingStage && !selectedDate;
  const needsTime = isWorkingStage && (!selectedStartTime || !selectedEndTime);
  const slotWarning =
    needsDate && needsTime
      ? "Set a date and time to confirm this booking."
      : needsDate
        ? "Set a date to confirm this booking."
        : needsTime
          ? "Set a start and end time to confirm this booking."
          : undefined;
  const showSlotWarning = confirmAttempted && !!slotWarning;

  const clashCheckReady = !(isCancelled || !selectedDate || !selectedStartTime || !selectedEndTime);
  const visibleClashes = clashCheckReady ? clashes : [];
  const hasClashes = visibleClashes.length > 0;
  const clashWarning = hasClashes
    ? `Clashes with ${visibleClashes.map((c) => c.title).join(", ")} - pick another time.`
    : undefined;
  const slotIsSet = !!selectedDate && !!selectedStartTime && !!selectedEndTime && !hasClashes;

  const origStart = toHHMM(request.selected_start_time);
  const origEnd = toHHMM(request.selected_end_time);
  const dateTimeChanged =
    selectedDate !== (request.selected_date || "") ||
    selectedStartTime !== origStart ||
    selectedEndTime !== origEnd;
  const detailsChanged =
    guestCount !== String(request.guest_count ?? "") ||
    subtypeId !== (request.event_subtypes_id != null ? String(request.event_subtypes_id) : "") ||
    adminNotes !== (request.admin_notes ?? "");
  const hasChanges = detailsChanged || dateTimeChanged;

  const editFields = () => ({
    guest_count: guestCount.trim() === "" ? request.guest_count : Number(guestCount),
    event_subtypes_id: subtypeId ? Number(subtypeId) : null,
    selected_date: selectedDate || null,
    selected_start_time: selectedStartTime || null,
    selected_end_time: selectedEndTime || null,
    admin_notes: adminNotes || null,
  });

  const applyDate = (d: string) => {
    setSelectedDate(d);
    setClashes([]);
  };
  const applyTimes = (start: string, end: string) => {
    setSelectedStartTime(start);
    setSelectedEndTime(end);
    setClashes([]);
  };

  function setSheetOpen(next: boolean) {
    setOpen(next);
    window.history.replaceState(null, "", next ? `${LIST_HREF}?open=${request.id}` : LIST_HREF);
  }

  const openParam = searchParams.get("open");
  const [handledOpenParam, setHandledOpenParam] = useState<string | null>(null);
  if (openParam !== handledOpenParam) {
    setHandledOpenParam(openParam);
    if (openParam === request.id) setOpen(true);
  }

  useEffect(() => {
    if (openParam === request.id) window.history.replaceState(null, "", LIST_HREF);
  }, [openParam, request.id]);

  const reportedOpen = useRef(false);
  useEffect(() => {
    if (!open && !reportedOpen.current) return;
    reportedOpen.current = open;
    onSheetOpenChange?.(request, open);
  }, [open, request, onSheetOpenChange]);

  const bodyReady = useDeferredValue(open, false);

  useEffect(() => {
    if (isCancelled || !selectedDate || !selectedStartTime || !selectedEndTime) return;
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
  }, [isCancelled, selectedDate, selectedStartTime, selectedEndTime, request.event_id]);

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

  function revealSlot() {
    setConfirmAttempted(true);
    setSlotFlash(true);
    slotRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
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

  function discardChanges() {
    setGuestCount(String(request.guest_count ?? ""));
    setSubtypeId(request.event_subtypes_id != null ? String(request.event_subtypes_id) : "");
    setSelectedDate(request.selected_date || "");
    setSelectedStartTime(toHHMM(request.selected_start_time));
    setSelectedEndTime(toHHMM(request.selected_end_time));
    setAdminNotes(request.admin_notes || "");
    setClashes([]);
    setError(null);
  }

  function closeDiscarding() {
    discardChanges();
    setSheetOpen(false);
  }

  async function confirmEmail(newStatus: PrivateAction): Promise<{ ok: boolean; note: string }> {
    const to = request.email;
    const dialogs: Partial<
      Record<
        PrivateAction,
        {
          title: string;
          description: string;
          confirmLabel: string;
          label: string;
          placeholder: string;
          destructive?: boolean;
        }
      >
    > = {
      confirmed: {
        title: "Confirm & email enquirer?",
        description: "This confirms the hire and puts the event on the schedule.",
        confirmLabel: "Confirm & Email",
        label: "Message to the enquirer (optional)",
        placeholder: "Anything they should know before the day...",
      },
      cancelled: {
        title: "Reject & email enquirer?",
        description: "This turns the enquiry down and emails the enquirer.",
        confirmLabel: "Reject & Email",
        label: "Reason for rejecting (optional)",
        placeholder: "Shared with the enquirer in the email. Leave blank to say nothing.",
        destructive: true,
      },
    };

    const d = dialogs[newStatus];
    if (!d) return { ok: true, note: adminNotes };

    /* Fetched rather than composed here, so the preview is the copy that will
       actually be sent - including any wording changed on the settings page. */
    const slots = await privateHireEmailSlotsAction(
      newStatus === "confirmed" ? "confirmed" : "cancelled",
      request.full_name
    );
    if (!slots) {
      return {
        ok: await confirm({
          title: d.title,
          description: `${d.description} This email is currently switched off, so nothing will be sent.`,
          confirmLabel: d.confirmLabel,
          variant: d.destructive ? "destructive" : undefined,
        }),
        note: adminNotes,
      };
    }

    const initial = newStatus === "cancelled" ? adminNotes : "";
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
          build={(note) => buildPrivateHireOutcomeEmail({ slots, notes: note })}
          to={to}
          label={d.label}
          placeholder={d.placeholder}
        />
      ),
    });
    return { ok, note: noteDraft.current };
  }

  function handleAction(next: PrivateStage) {
    setError(null);
    setClashes([]);
    void attempt(async () => {
      if (next === "confirmed") {
        const c = await findClashes();
        if (c.length) return;
      }
      const { ok, note } = await confirmEmail(next);
      if (!ok) return;
      applyStatus(next, note);
    }, () => setError("Failed to update. Please try again."));
  }

  function applyStatus(newStatus: PrivateAction, note: string) {
    setPendingStage(newStatus);
    startTransition(async () => {
      await attempt(async () => {
        if (hasChanges) {
          await updatePrivateHireFields(request.id, { ...editFields(), admin_notes: note || null });
        }
        await updatePrivateHireStatus(request.id, newStatus, note || undefined);
        setAdminNotes(note);
        const label = STATUS_TOAST[newStatus];
        toast.success(newStatus === "pending" ? label : `${label} - enquirer emailed`);
      }, () => setError("Failed to update. Please try again."));
      setPendingStage(null);
    });
  }

  function handleSave() {
    if (!hasChanges) return;
    setError(null);
    setClashes([]);
    void attempt(async () => {
      if (status === "confirmed" && dateTimeChanged) {
        const c = await findClashes();
        if (c.length) return;
      }

      if (status === "confirmed") {
        const ok = await confirm({
          title: "Save changes?",
          description:
            "This hire is confirmed - saving updates its details and the linked event.",
          confirmLabel: "Save Changes",
        });
        if (!ok) return;
      }

      runSave(async () => {
        await updatePrivateHireFields(request.id, editFields());
        toast.success("Changes saved");
      });
    }, () => setError("Failed to update. Please try again."));
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

  async function requestClose() {
    if (!hasChanges) {
      setSheetOpen(false);
      return;
    }
    if (askingToClose.current || !!pendingStage) return;
    askingToClose.current = true;
    await attempt(askBeforeClose, () => {});
    askingToClose.current = false;
  }

  async function askBeforeClose() {
    if (hasClashes) {
      const discard = await confirm({
        title: "Discard changes?",
        description:
          "This slot clashes with another event, so these changes can't be saved. Close and discard them?",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        variant: "destructive",
      });
      if (discard) closeDiscarding();
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
    else closeDiscarding();
  }

  const preferredDate = request.preferred_date;
  const preferredStart = toHHMM(request.preferred_start_time);
  const preferredEnd = toHHMM(request.preferred_end_time);
  const hasPreferred = !!preferredDate || !!preferredStart || !!preferredEnd;
  const preferredDateIsSelected = !!preferredDate && selectedDate === preferredDate;
  const preferredTimeIsSelected =
    !!(preferredStart || preferredEnd) &&
    selectedStartTime === preferredStart &&
    selectedEndTime === preferredEnd;

  const subtypeBadge = toTitleCase(currentSub?.name) || toTitleCase(request.reason_for_hire);

  const selectedTimeLabel = [toHHMM(request.selected_start_time), toHHMM(request.selected_end_time)]
    .filter(Boolean)
    .join("–");
  const hasSelectedSlot = !!request.selected_date || !!selectedTimeLabel;
  const preferredSlotLabel = [
    preferredDate ? format(new Date(preferredDate + "T00:00:00"), "EEE, d MMM") : "",
    [preferredStart, preferredEnd].filter(Boolean).join("–"),
  ]
    .filter(Boolean)
    .join(" · ");

  const pillClass = (isSelected: boolean, interactive: boolean) =>
    cn(
      "shrink-0 rounded-lg border px-2 py-1 text-[11px] font-bold whitespace-nowrap transition-all",
      isSelected
        ? "border-[#34451F] bg-[#34451F] text-white"
        : "border-[#34451F]/25 bg-[#34451F]/10 text-[#34451F]",
      interactive ? "hover:brightness-95" : "cursor-not-allowed"
    );

  function revealInternalNotes() {
    const cards = sheetBodyRef.current?.querySelectorAll<HTMLElement>("[data-internal-notes]") ?? [];
    const visible = Array.from(cards).find((el) => el.offsetParent !== null);
    visible?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const notesCards = (
    <>
      {bookingNote && (
        <BookingNoteWidget
          note={bookingNote}
          title="Note from the enquirer"
          author={request.full_name}
          createdAt={request.created_at}
        />
      )}
      <div data-internal-notes className="scroll-mt-4">
        <InternalNotesPanel
          notes={internalNotes}
          editable={editable}
          placeholder="Add a note about this hire…"
          onAdd={(body) => addPrivateHireNote(request.id, body)}
          onUpdate={updatePrivateHireNote}
          onDelete={deletePrivateHireNote}
        />
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white",
          "text-left shadow-sm transition-all hover:bg-[#F4F1E8]/60 active:scale-[0.98]"
        )}
      >
        {subtypeBadge && (
          <span className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-stretch text-[9px] tracking-widest uppercase">
            <span className="flex max-w-[65%] min-w-0 items-stretch overflow-hidden rounded-tl-xl rounded-br-lg">
              <span className={cn("truncate px-2 py-0.5 font-black text-white", theme.dot)}>
                {subtypeBadge}
              </span>
            </span>
          </span>
        )}

        <div className={cn("flex items-center gap-3 px-3 pb-3", subtypeBadge ? "pt-5" : "pt-3")}>
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
              theme.bg,
              theme.text,
              theme.border
            )}
          >
            {request.selected_date ? (
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

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate font-black text-sm tracking-tight text-[#20231A] uppercase">
                {request.full_name}
              </p>
              {request.admin_notes && (
                <span className="shrink-0 rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 font-black text-[10px] text-purple-700 uppercase">
                  ADMIN
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5E6654]">
              <span className="min-w-0 truncate">
                {hasSelectedSlot
                  ? selectedTimeLabel && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {selectedTimeLabel}
                      </span>
                    )
                  : preferredSlotLabel && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        <span className="truncate">{preferredSlotLabel}</span>
                      </span>
                    )}
              </span>
              {(request.unread_emails ?? 0) > 0 && (
                <span
                  className="relative ml-auto flex shrink-0 items-center"
                  title={`${request.unread_emails} new email${request.unread_emails === 1 ? "" : "s"} from the enquirer`}
                >
                  <Mail className="h-4 w-4 text-[#9A5B00]" aria-hidden="true" />
                  <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#9A5B00] px-1 text-[9px] font-bold text-white tabular-nums ring-2 ring-white">
                    {request.unread_emails}
                  </span>
                  <span className="sr-only">{request.unread_emails} new emails from the enquirer</span>
                </span>
              )}
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold opacity-60">
                <Users className="h-3 w-3" />
                {request.guest_count}
              </span>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-[#5E6654]/50" />
        </div>
      </button>

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
          showCloseButton={false}
          className="flex h-[92vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#D8D5C8] bg-[#F4F1E8] p-0 shadow-2xl outline-none sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto sm:max-h-[92vh] sm:w-3xl sm:max-w-[96vw] sm:-translate-x-1/2 sm:rounded-4xl sm:border-2 md:w-4xl lg:max-h-[94vh] lg:w-5xl xl:w-6xl"
        >
          <SheetDragHandle onClose={requestClose} className="bg-white/80 backdrop-blur-md" />
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#D8D5C8] bg-white/80 px-4 pt-1 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <div className="flex items-start justify-between gap-1.5 sm:gap-3">
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                title="Close"
                className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
              >
                <X className="h-5 w-5 shrink-0" />
              </button>
              <div className="min-w-0 flex-1">
                <SheetTitle className="mt-2 truncate text-lg leading-tight font-bold tracking-tight text-admin-ink">
                  {request.full_name}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Review and manage this private hire enquiry.
                </SheetDescription>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {hasChanges && (
                  <>
                    <button
                      type="button"
                      onClick={discardChanges}
                      disabled={isPending}
                      aria-label="Discard changes"
                      title="Discard changes"
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#D8D5C8] bg-white px-3 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE] disabled:opacity-50 max-sm:w-11 max-sm:px-0 sm:h-9"
                    >
                      <Undo2 className="h-4 w-4 shrink-0" />
                      <span className="max-sm:hidden">Cancel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isPending || hasClashes}
                      title={hasClashes ? clashWarning : "Save changes"}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#34451F] px-3.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#283719] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:h-9"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                      Save
                    </button>
                  </>
                )}
                <Popover open={sysInfoOpen} onOpenChange={setSysInfoOpen}>
                  <DropdownMenu modal={false}>
                    <PopoverAnchor asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={internalNotes.length > 0 ? `More actions (${internalNotes.length} team notes)` : "More actions"}
                          title="More actions"
                          className={cn(
                            "relative -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-admin-ink transition-colors hover:bg-admin-surface focus-visible:ring-2 focus-visible:ring-[#34451F]/40 focus-visible:outline-none data-[state=open]:bg-admin-surface",
                            hasChanges && "max-sm:hidden"
                          )}
                        >
                          <MoreVertical className="h-5 w-5" />
                          {internalNotes.length > 0 && (
                            <span
                              aria-hidden="true"
                              className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#9A5B00] ring-2 ring-white"
                            />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                    </PopoverAnchor>
                    <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
                      <DropdownMenuItem onSelect={revealInternalNotes}>
                        <NotebookPen className="h-4 w-4" />
                        <span className="flex-1">Team notes</span>
                        {internalNotes.length > 0 && (
                          <span className="rounded-full bg-[#FCE9A6] px-1.5 text-[11px] font-semibold text-[#9A5B00] tabular-nums">
                            {internalNotes.length}
                          </span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTimeout(() => setSysInfoOpen(true), 0)}>
                        <Info className="h-4 w-4" />
                        System information
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <PopoverContent
                    align="end"
                    onFocusOutside={(e) => e.preventDefault()}
                    className="w-80 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white p-0"
                  >
                    <span className="block border-b border-[#D8D5C8] bg-[#D8D5C8] px-4 py-2.5 font-black text-[10px] tracking-wide text-[#34451F] uppercase">
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
                          className="group inline-flex items-center gap-1.5 font-bold text-[#34451F] tabular-nums transition-colors hover:text-[#20231A]"
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
                            className="group inline-flex items-center gap-1.5 font-bold text-[#34451F] hover:underline"
                          >
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">#{request.event_id}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                          </Link>
                        ) : null
                      }
                    />
                    {(isCancelled || !!declineReason) && (
                      <div className="flex items-start justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
                        <span className="shrink-0 pt-0.5 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">
                          Decline Reason
                        </span>
                        {declineReasonOpen ? (
                          <textarea
                            aria-label="Decline reason"
                            value={adminNotes}
                            rows={3}
                            autoFocus
                            placeholder="Why was this rejected?"
                            onChange={(e) => setAdminNotes(e.target.value)}
                            className="min-w-0 flex-1 resize-none rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] px-2.5 py-1.5 text-[13px] text-[#20231A] transition-all outline-none placeholder:text-[#5E6654]/50 focus:border-[#34451F]/30"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeclineReasonOpen(true)}
                            title={declineReason || "Add a reason"}
                            className="min-w-0 text-right text-[13px] font-semibold text-[#20231A] transition-colors hover:text-[#34451F]"
                          >
                            {declineReason ? (
                              <span className="italic">
                                &quot;{declineIsLong ? declineHead : declineReason}
                                {declineIsLong && <span className="font-black text-[#34451F] not-italic">…</span>}
                                &quot;
                              </span>
                            ) : (
                              <span className="text-[#5E6654]/50">Add a reason…</span>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                    <SheetRow label="Submitted" value={formatDateTime(request.created_at)} />
                    <SheetRow label="Last Modified" value={formatDateTime(request.updated_at)} />
                    <SheetRow label="Modified By" value={request.updated_by_employee?.full_name || "-"} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <StageStepper
              status={status}
              onSelect={handleAction}
              pendingStage={pendingStage}
              blockers={{ confirmed: slotWarning ?? clashWarning }}
              onRevealSlot={revealSlot}
              declineReason={adminNotes}
              onDeclineReasonChange={setAdminNotes}
            />
          </div>

          <div ref={sheetBodyRef} className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {error && (
              <p className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-snug font-bold text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            {bodyReady ? (
            <div className="animate-in grid-cols-[minmax(0,1fr)_380px] items-start gap-5 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid lg:space-y-0">
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
                              ? `View linked event #${request.event_id} - on the schedule`
                              : `View linked event #${request.event_id} - off the schedule`
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
                      ) : status === "confirmed" ? (
                        <span
                          title="This enquiry is confirmed but has no linked event"
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
                  <SheetRow label="Name" value={request.full_name} />

                  <div className="flex items-center justify-between gap-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
                    <span className="shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">Type / Subtype</span>
                    {!editable || !options ? (
                      <span className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold text-[#20231A]">
                        {typeName || "-"}
                        <span className="mx-1.5 font-normal text-[#5E6654]/50">/</span>
                        {subtypeName || "-"}
                      </span>
                    ) : (
                      <div className="flex min-w-0 items-center justify-end gap-1.5">
                        <span className="shrink-0 text-[13px] font-semibold text-[#20231A]">{typeName || "-"}</span>
                        <span className="shrink-0 text-[#5E6654]/50">/</span>
                        <select
                          aria-label="Subtype"
                          value={subtypeId}
                          onChange={(e) => setSubtypeId(e.target.value)}
                          className="min-w-0 cursor-pointer bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none [text-align-last:right]"
                        >
                          {!subtypeId && <option value="">-</option>}
                          {subtypeOptions.map((s) => (
                            <option key={s.id} value={String(s.id)}>{toTitleCase(s.name)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <SheetRow label="Reason" value={toTitleCase(request.reason_for_hire)} />

                  <EditRow
                    label="Guests"
                    value={guestCount}
                    onChange={setGuestCount}
                    editable={editable}
                    type="number"
                    placeholder="0"
                    readOnlyValue={request.guest_count}
                  />

                  {hasPreferred && (
                    <div className="flex items-center gap-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
                      <span className="shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">
                        Preferred Date &amp; Time
                      </span>
                      <div className="no-scrollbar ml-auto flex min-w-0 items-center gap-1.5 overflow-x-auto">
                        {preferredDate && (
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => applyDate(preferredDateIsSelected ? "" : preferredDate)}
                            title={editable ? "Use as the selected date" : undefined}
                            className={pillClass(preferredDateIsSelected, editable)}
                          >
                            {format(new Date(preferredDate + "T00:00:00"), "EEE, d MMM")}
                          </button>
                        )}
                        {(preferredStart || preferredEnd) && (
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() =>
                              preferredTimeIsSelected
                                ? applyTimes("", "")
                                : applyTimes(preferredStart, preferredEnd)
                            }
                            title={editable ? "Use as the selected time" : undefined}
                            className={pillClass(preferredTimeIsSelected, editable)}
                          >
                            {formatTimeRange(request.preferred_start_time, request.preferred_end_time)}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    ref={slotRowRef}
                    className={cn(
                      "scroll-mt-4 border-b border-[#D8D5C8] px-4 py-2 transition-colors last:border-0 sm:px-5",
                      hasClashes ? "bg-red-50" : showSlotWarning && "bg-amber-50",
                      slotFlash && "ring-2 ring-amber-400/70 ring-inset"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <span className="shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">
                        Selected Date &amp; Time
                      </span>
                      {editable ? (
                        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                disabled={!editable}
                                className={cn(
                                  "flex min-w-40 items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-[13px] font-semibold text-[#20231A] transition-colors hover:border-[#34451F]/30 disabled:cursor-not-allowed disabled:opacity-60",
                                  !selectedDate && showSlotWarning
                                    ? "border-amber-300"
                                    : slotIsSet
                                      ? "border-[#34451F]"
                                      : "border-[#D8D5C8]"
                                )}
                              >
                                {selectedDate
                                  ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy")
                                  : "Pick a date"}
                                <CalendarDays className="h-4 w-4 shrink-0 text-[#5E6654]/60" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto rounded-2xl border-2 border-[#D8D5C8] bg-white p-0">
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
                                  className="flex w-full items-center justify-center gap-1.5 border-t border-[#D8D5C8] px-4 py-2.5 font-bold text-[12px] whitespace-nowrap text-[#5E6654] transition-colors hover:bg-[#F4F1E8] hover:text-[#34451F]"
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
                              (!selectedStartTime || !selectedEndTime) && showSlotWarning
                                ? "border-amber-300"
                                : slotIsSet
                                  ? "border-[#34451F]"
                                  : "border-[#D8D5C8]"
                            )}
                          >
                            <input
                              ref={startTimeRef}
                              type="time"
                              aria-label="Selected start time"
                              disabled={!editable}
                              value={selectedStartTime}
                              onChange={(e) => {
                                setSelectedStartTime(e.target.value);
                                setClashes([]);
                              }}
                              className="bg-transparent text-[13px] font-semibold text-[#20231A] outline-none disabled:opacity-60"
                            />
                            <span className="text-xs text-[#5E6654]/50">-</span>
                            <input
                              type="time"
                              aria-label="Selected end time"
                              disabled={!editable}
                              value={selectedEndTime}
                              onChange={(e) => {
                                setSelectedEndTime(e.target.value);
                                setClashes([]);
                              }}
                              className="bg-transparent text-[13px] font-semibold text-[#20231A] outline-none disabled:opacity-60"
                            />
                            {editable && (selectedStartTime || selectedEndTime) && (
                              <button
                                type="button"
                                onClick={() => applyTimes("", "")}
                                aria-label="Clear selected times"
                                title="Clear times"
                                className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#5E6654]/50 transition-colors hover:bg-[#F4F1E8] hover:text-[#34451F]"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="min-w-0 truncate text-right text-[13px] font-semibold text-[#20231A]">
                          {selectedDate ? format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM yyyy") : "-"}
                          {selectedStartTime && ` · ${selectedStartTime}–${selectedEndTime || "?"}`}
                        </span>
                      )}
                    </div>
                    {editable && slotWarning && showSlotWarning && <FieldMessage warning={slotWarning} />}
                    {visibleClashes.length > 0 && (
                      <div className="mt-2">
                        <ClashList clashes={visibleClashes} />
                      </div>
                    )}
                  </div>
                </Section>

                <div className="space-y-4 sm:space-y-5 lg:hidden">{notesCards}</div>

                <Section title="Contact">
                  <ContactRow label="Email" value={request.email} href={request.email ? `mailto:${request.email}` : null} icon={Mail} />
                  <ContactRow label="Phone" value={request.phone_no} href={request.phone_no ? `tel:${request.phone_no.replace(/\s+/g, "")}` : null} icon={Phone} />
                </Section>

                {isCancelled && (
                  <Section title="Cancellation Reason for Applicant">
                    <div className="p-4 sm:p-5">
                      <textarea
                        aria-label="Cancellation reason for applicant"
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={4}
                        placeholder="The reason given to the enquirer when this was rejected..."
                        className="w-full resize-none rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2 text-[13px] text-[#20231A] transition-all placeholder:text-[#5E6654]/50 focus:border-[#34451F]/30 focus:outline-none"
                      />
                      <p className="mt-1.5 text-[10px] leading-snug text-[#5E6654]/70">
                        Saved when you hit Save.
                      </p>
                    </div>
                  </Section>
                )}
              </div>

              <div className="min-w-0 space-y-4 sm:space-y-5">
                <div className="space-y-4 sm:space-y-5 max-lg:hidden">{notesCards}</div>
                <Section
                  title="Correspondence"
                  headerRight={
                    (request.unread_emails ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#9A5B00] px-2 py-0.5 text-[11px] font-semibold text-white">
                        <Mail className="h-3 w-3" aria-hidden="true" />
                        {request.unread_emails} new
                      </span>
                    ) : undefined
                  }
                >
                  <CorrespondencePanel privateHireRequestId={request.id} editable={editable} />
                </Section>
              </div>
            </div>
            ) : (
              <div className="flex justify-center py-16" aria-busy="true">
                <Loader2 className="h-6 w-6 animate-spin text-[#5E6654]/50" aria-label="Loading booking" />
              </div>
            )}
            <div className="h-4" />
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
          Time slot full - conflicts with:
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
