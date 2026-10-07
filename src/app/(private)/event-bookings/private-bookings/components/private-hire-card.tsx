"use client";

import React, { useDeferredValue, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  approvePrivateHireAction,
  refundPrivateHireDepositAction,
  proposePrivateHireAction,
  markPrivateHireDepositPaidAction,
  closePrivateHireAction,
  reopenPrivateHireAction,
  resendPrivateHireEmailAction,
  changeAgreedHireAction,
  privateHireDepositDefaultAction,
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
  PoundSterling,
  Send,
  ArrowRight,
  BellRing,
  CalendarClock,
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
import { CorrespondencePanel, MessageCountPill } from "@/components/admin/correspondence-panel";
import { BookingNoteWidget, InternalNotesPanel, type InternalNote } from "@/components/admin/internal-notes-panel";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { toHHMM, type ClashEvent } from "@/lib/event-clash";
import { squareOrderUrl, squareTransactionUrl } from "@/lib/market/simulate";
import { unwrapSubtype, type PrivateHireSubtype } from "@/lib/private-hire-subtype";
import {
  buildPrivateHireOutcomeEmail,
  type PrivateHireEmail,
  type PrivateHireEmailKey,
} from "@/lib/private-hire-emails";
import {
  DEPOSIT_PAID_VIA_LABEL,
  PRIVATE_HIRE_PIPELINE,
  PRIVATE_HIRE_STATUS_LABEL,
  REFUND_VIA_LABEL,
  canRefundToCard,
  isClosedPrivateHire,
  normalizePrivateHireStatus,
  refundableAmount,
  type DepositPaidVia,
  type PrivateHireStatus,
  type RefundVia,
} from "@/lib/private-hire-status";
import { formatDeposit } from "@/lib/private-hire-details";
import type { RenderedSlots } from "@/lib/email/design";

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
  event_id: number | null;
  event_subtypes_id: number;
  event_subtypes: PrivateHireSubtypeJoin | PrivateHireSubtypeJoin[] | null;
  additional_requirements: string | null;
  status: string;
  decline_reason: string | null;
  deposit_amount: number | null;
  paid_amount: number | null;
  deposit_due_date: string | null;
  deposit_paid_at: string | null;
  deposit_paid_via: string | null;
  deposit_reminded_at: string | null;
  payment_status: string | null;
  square_payment_id: string | null;
  square_order_id: string | null;
  payment_link_url: string | null;
  refunded_amount: number | null;
  refunded_at: string | null;
  refunded_via: string | null;
  square_refund_id: string | null;
  refund_status: string | null;
  proposed_at: string | null;
  approved_at: string | null;
  confirmed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by: number | null;
  updated_by_employee?: { full_name: string | null } | null;
  linked_event?: LinkedEvent | LinkedEvent[] | null;
}

export type SquareDashboard = { environment: "sandbox" | "production"; locationId: string | null };

type PrivateHireSubtypeJoin =Pick<PrivateHireSubtype, "id" | "name" | "default_event_title"> & {
  event_types_id: number;
  event_types?: { name: string } | { name: string }[] | null;
};

const STATUS_THEME: Record<
  PrivateHireStatus,
  { bg: string; text: string; border: string; dot: string; icon: React.ReactNode; label: string }
> = {
  new: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    icon: <Clock className="h-5 w-5" />,
    label: PRIVATE_HIRE_STATUS_LABEL.new,
  },
  awaiting_customer: {
    bg: "bg-admin-info-bg",
    text: "text-admin-info",
    border: "border-[#28608F]/25",
    dot: "bg-admin-info",
    icon: <Mail className="h-5 w-5" />,
    label: PRIVATE_HIRE_STATUS_LABEL.awaiting_customer,
  },
  awaiting_deposit: {
    bg: "bg-admin-warning-bg",
    text: "text-admin-warning",
    border: "border-[#9A5B00]/25",
    dot: "bg-admin-warning",
    icon: <PoundSterling className="h-5 w-5" />,
    label: PRIVATE_HIRE_STATUS_LABEL.awaiting_deposit,
  },
  confirmed: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
    icon: <CheckCircle className="h-5 w-5" />,
    label: PRIVATE_HIRE_STATUS_LABEL.confirmed,
  },
  declined: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    icon: <XCircle className="h-5 w-5" />,
    label: PRIVATE_HIRE_STATUS_LABEL.declined,
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
    icon: <XCircle className="h-5 w-5" />,
    label: PRIVATE_HIRE_STATUS_LABEL.cancelled,
  },
  expired: {
    bg: "bg-admin-surface",
    text: "text-admin-muted",
    border: "border-admin-line",
    dot: "bg-[#5E6654]",
    icon: <Clock className="h-5 w-5" />,
    label: PRIVATE_HIRE_STATUS_LABEL.expired,
  },
};

/* Every step a staff member can take from the card. */
type HireAction =
  | "approve"
  | "propose"
  | "accept"
  | "markPaid"
  | "resend"
  | "decline"
  | "cancel"
  | "reopen"
  | "reopenDeposit"
  | "changeDeposit"
  | "reschedule"
  | "refund";

const ACTION_TOAST: Record<HireAction, string> = {
  refund: "Deposit refunded - customer emailed",
  approve: "Approved - deposit request emailed",
  propose: "New time proposed - customer emailed",
  accept: "Marked accepted - deposit request emailed",
  markPaid: "Deposit recorded - hire confirmed",
  resend: "Email sent again",
  decline: "Request declined - customer emailed",
  cancel: "Hire cancelled - customer emailed",
  reopen: "Request reopened",
  reopenDeposit: "Reopened - new deposit request emailed",
  changeDeposit: "Deposit updated - customer emailed a new payment link",
  reschedule: "Hire moved - customer emailed",
};

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
  label, value, onChange, editable, type = "text", placeholder, readOnlyValue, trailing, inputClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  type?: string;
  placeholder?: string;
  readOnlyValue?: React.ReactNode;
  trailing?: React.ReactNode;
  inputClassName?: string;
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
          className={cn(
            "min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40",
            inputClassName
          )}
        />
      )}
      {trailing}
    </div>
  );
}

function PaymentStatusPill({ status, refund }: { status: string | null; refund?: { amount: number; status: string | null } }) {
  if (!status) return <>-</>;
  const refundPending = refund?.status === "pending";
  const partRefund = status !== "refunded" && (refund?.amount ?? 0) > 0;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        refundPending
          ? "bg-admin-info-bg text-admin-info"
          : status === "paid"
            ? "bg-admin-success-bg text-admin-success"
            : status === "refunded"
              ? "bg-admin-surface text-admin-muted"
              : "bg-admin-warning-bg text-admin-warning"
      )}
    >
      {refundPending
        ? "refund pending"
        : status === "partially_paid"
          ? "part paid"
          : status.replace(/_/g, " ")}
      {partRefund && !refundPending ? ` · ${formatDeposit(refund!.amount)} refunded` : ""}
    </span>
  );
}

function LinkRow({ label, value, href, title }: { label: string; value: string | null; href: string | null; title: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">{label}</span>
      {value && href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-admin-primary underline-offset-2 hover:underline"
        >
          <span className="truncate font-mono text-[12px]">{value}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
      ) : (
        <span className="text-[13px] font-semibold text-[#20231A]">-</span>
      )}
    </div>
  );
}

const CONTACT_ICON_BUTTON =
  "relative -my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] text-[#34451F] transition-colors after:absolute after:-inset-2 hover:bg-[#34451F] hover:text-white";

function ContactRow({
  label,
  value,
  href,
  icon: Icon,
  external,
  onActivate,
  actionTitle,
}: {
  label: string;
  value: string | null;
  href: string | null;
  icon: React.ElementType<{ className?: string }>;
  external?: boolean;
  onActivate?: () => void;
  actionTitle?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-right text-[13px] font-semibold text-[#20231A]">{value || "-"}</span>
        {href && onActivate ? (
          <button
            type="button"
            aria-label={actionTitle ?? `${label}: ${value}`}
            title={actionTitle}
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
            className={CONTACT_ICON_BUTTON}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ) : href ? (
          <a
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            aria-label={`${label}: ${value}`}
            title={actionTitle ?? `Open ${label.toLowerCase()}`}
            onClick={(e) => e.stopPropagation()}
            className={CONTACT_ICON_BUTTON}
          >
            <Icon className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ViewMoreButton({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="flex w-full items-center justify-center gap-1 bg-admin-surface/60 px-4 py-2 text-[12px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-primary focus-visible:bg-admin-surface focus-visible:outline-none max-sm:min-h-11"
    >
      {open ? "View less" : "View more"}
      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
    </button>
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

const STAGE_SOLID: Record<PrivateHireStatus, string> = {
  new: "bg-amber-600",
  awaiting_customer: "bg-[#28608F]",
  awaiting_deposit: "bg-[#9A5B00]",
  confirmed: "bg-green-600",
  declined: "bg-red-600",
  cancelled: "bg-red-600",
  expired: "bg-[#5E6654]",
};

function formatDay(date: string | null | undefined): string {
  return date ? format(new Date(date + "T00:00:00"), "EEE d MMM") : "";
}

function stageHint(
  request: PrivateHireRequest,
  status: PrivateHireStatus,
  blocker?: string,
  slotMatchesPreferred?: boolean
): string {
  switch (status) {
    case "new":
      return blocker
        ? `New request. ${blocker}`
        : slotMatchesPreferred
          ? "New request. The selected slot is what they asked for - approve it to ask for the deposit."
          : "New request. The selected slot differs from what they asked for, so it goes to them as a proposal.";
    case "awaiting_customer":
      return `Waiting for ${request.full_name} to accept the proposed time${
        request.proposed_at ? ` (sent ${formatDay(request.proposed_at.slice(0, 10))})` : ""
      }. Their Accept link does this for them; mark it accepted if they say yes by email or phone instead.`;
    case "awaiting_deposit":
      return `Deposit of ${formatDeposit(request.deposit_amount)} due by ${formatDay(request.deposit_due_date) || "-"}. The date is held until then.`;
    case "confirmed": {
      const via = request.deposit_paid_via as DepositPaidVia | null;
      if (!via || via === "none") return "Confirmed and on the schedule.";
      return `Confirmed and on the schedule. Deposit of ${formatDeposit(request.paid_amount)} paid by ${DEPOSIT_PAID_VIA_LABEL[via].toLowerCase()}${
        request.deposit_paid_at ? ` on ${formatDay(request.deposit_paid_at.slice(0, 10))}` : ""
      }.`;
    }
    case "expired":
      return `The deposit wasn't paid by ${formatDay(request.deposit_due_date) || "the due date"}, so the date was released. Reopen it to send a new deposit request.`;
    case "declined":
      return "Declined. Reopen it to review it again.";
    case "cancelled":
      return "Cancelled. Reopen it to review it again.";
  }
}

function StepNode({
  stage,
  index,
  tone,
}: {
  stage: PrivateHireStatus;
  index: number;
  tone: "current" | "past" | "future";
}) {
  const label = STATUS_THEME[stage].label;

  if (tone === "current") {
    return (
      <span
        aria-current="step"
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-sm",
          STAGE_SOLID[stage]
        )}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-white" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-2 px-1.5 py-1">
      {tone === "past" ? (
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
    </span>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "w-3 shrink-0 sm:w-6",
        done ? "h-0.5 rounded-full bg-[#34451F]" : "h-0 border-t-2 border-dashed border-[#D8D5C8]"
      )}
    />
  );
}

function initialSlot(request: PrivateHireRequest, status: PrivateHireStatus) {
  const saved = {
    date: request.selected_date || "",
    start: toHHMM(request.selected_start_time),
    end: toHHMM(request.selected_end_time),
    prefilled: false,
  };
  const nothingSaved = !saved.date && !saved.start && !saved.end;
  const preferredUpcoming = !!request.preferred_date && request.preferred_date >= format(new Date(), "yyyy-MM-dd");
  if (status !== "new" || !nothingSaved || !preferredUpcoming) return saved;
  return {
    date: request.preferred_date ?? "",
    start: toHHMM(request.preferred_start_time),
    end: toHHMM(request.preferred_end_time),
    prefilled: true,
  };
}

/* The approve and propose explanations each show in full until staff
   dismiss them once in this browser, then live behind an info button. */
type SlotRole = "approve" | "propose";
const SLOT_HINT_KEY: Record<SlotRole, string> = {
  approve: "private-hire-approve-hint-seen",
  propose: "private-hire-slot-hint-seen",
};
const slotHintListeners = new Set<() => void>();

function subscribeSlotHint(listener: () => void) {
  slotHintListeners.add(listener);
  return () => {
    slotHintListeners.delete(listener);
  };
}

function readSlotHintsSeen(): string {
  try {
    const seen = (role: SlotRole) => (window.localStorage.getItem(SLOT_HINT_KEY[role]) === "1" ? "1" : "0");
    return seen("approve") + seen("propose");
  } catch {
    return "11";
  }
}

function markSlotHintSeen(role: SlotRole) {
  try {
    window.localStorage.setItem(SLOT_HINT_KEY[role], "1");
  } catch {}
  slotHintListeners.forEach((l) => l());
}

type ButtonSpec = { action: HireAction; label: string; needsSlot?: boolean };

/* The buttons each stage offers: a quiet destructive one on the left, an
   outline secondary and one solid primary (at most one per view). */
const STAGE_BUTTONS: Record<
  PrivateHireStatus,
  { danger?: ButtonSpec; secondary?: ButtonSpec; primary?: ButtonSpec }
> = {
  new: {
    danger: { action: "decline", label: "Decline" },
    primary: { action: "approve", label: "Approve times", needsSlot: true },
  },
  awaiting_customer: {
    danger: { action: "decline", label: "Decline" },
    secondary: { action: "resend", label: "Resend proposal" },
    primary: { action: "accept", label: "Mark accepted", needsSlot: true },
  },
  awaiting_deposit: {
    danger: { action: "cancel", label: "Cancel hire" },
    secondary: { action: "resend", label: "Resend email" },
    primary: { action: "markPaid", label: "Mark deposit paid" },
  },
  confirmed: {
    danger: { action: "cancel", label: "Cancel hire" },
  },
  expired: {
    danger: { action: "decline", label: "Decline" },
    primary: { action: "reopenDeposit", label: "Reopen with new deadline", needsSlot: true },
  },
  declined: {
    secondary: { action: "reopen", label: "Reopen" },
  },
  cancelled: {
    secondary: { action: "reopen", label: "Reopen" },
  },
};

const NEW_STAGE_PROPOSE_BUTTONS: (typeof STAGE_BUTTONS)[PrivateHireStatus] = {
  danger: { action: "decline", label: "Decline" },
  primary: { action: "propose", label: "Propose new time", needsSlot: true },
};

function StageStepper({
  request,
  status,
  onAction,
  pendingAction,
  slotBlocker,
  slotMatchesPreferred,
  onRevealSlot,
  closedReason,
  onClosedReasonChange,
}: {
  request: PrivateHireRequest;
  status: PrivateHireStatus;
  onAction: (action: HireAction) => void;
  pendingAction: HireAction | null;
  slotBlocker?: string;
  slotMatchesPreferred: boolean;
  onRevealSlot: () => void;
  closedReason: string;
  onClosedReasonChange: (v: string) => void;
}) {
  const idx = PRIVATE_HIRE_PIPELINE.indexOf(status);
  const isClosed = isClosedPrivateHire(status);
  const busy = !!pendingAction;
  const buttons = status === "new" && !slotMatchesPreferred ? NEW_STAGE_PROPOSE_BUTTONS : STAGE_BUTTONS[status];
  const primaryBlocked = !!buttons.primary?.needsSlot && !!slotBlocker;
  const hint = stageHint(request, status, primaryBlocked ? slotBlocker : undefined, slotMatchesPreferred);

  const spinner = (a?: ButtonSpec) =>
    a && pendingAction === a.action ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null;

  return (
    <div className="mt-3 rounded-2xl border border-admin-line bg-admin-surface/50 px-3 py-2.5 sm:px-4">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 leading-tight">
            <p className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
              {isClosed ? "Status" : "Stage"}
            </p>
            <p className="text-[13px] font-bold text-admin-ink tabular-nums">
              {isClosed ? "Closed" : `${idx + 1} of ${PRIVATE_HIRE_PIPELINE.length}`}
            </p>
          </div>

          <ol
            className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-1.5"
            aria-label={isClosed ? `Status: ${STATUS_THEME[status].label}` : `Stage ${idx + 1} of ${PRIVATE_HIRE_PIPELINE.length}: ${STATUS_THEME[status].label}`}
          >
            {isClosed ? (
              <li className="flex items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-current="step"
                      title="Reason given to the customer - click to view or edit"
                      className={cn(
                        "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:brightness-95",
                        STAGE_SOLID[status]
                      )}
                    >
                      <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {STATUS_THEME[status].label}
                      {closedReason.trim() && (
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
                      Reason given to the customer
                    </span>
                    <div className="p-3">
                      <textarea
                        aria-label="Reason given to the customer"
                        value={closedReason}
                        onChange={(e) => onClosedReasonChange(e.target.value)}
                        rows={4}
                        placeholder="The reason given to the customer when this was closed..."
                        className="w-full resize-none rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2 text-[13px] text-[#20231A] transition-all placeholder:text-[#5E6654]/50 focus:border-[#34451F]/30 focus:outline-none"
                      />
                      <p className="mt-1.5 text-[12px] leading-snug text-admin-muted">Saved when you hit Save.</p>
                    </div>
                  </PopoverContent>
                </Popover>
              </li>
            ) : (
              PRIVATE_HIRE_PIPELINE.map((s, i) => (
                <li key={s} className="flex items-center gap-1 sm:gap-1.5">
                  {i > 0 && <StepConnector done={i <= idx} />}
                  <StepNode stage={s} index={i} tone={i === idx ? "current" : i < idx ? "past" : "future"} />
                </li>
              ))
            )}
          </ol>
        </div>

        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap lg:ml-auto lg:flex-nowrap">
          {buttons.danger && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction(buttons.danger!.action)}
                className={cn(
                  "order-last inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold whitespace-nowrap text-[#B33A32] transition-colors hover:bg-admin-error-bg disabled:pointer-events-none disabled:opacity-50 sm:order-none sm:h-9",
                  (buttons.secondary || buttons.primary) && "col-span-2"
                )}
              >
                {spinner(buttons.danger)}
                {buttons.danger.label}
              </button>
              {(buttons.secondary || buttons.primary) && (
                <span className="hidden h-6 w-px shrink-0 bg-admin-line sm:block" aria-hidden="true" />
              )}
            </>
          )}

          {buttons.secondary && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                buttons.secondary!.needsSlot && slotBlocker ? onRevealSlot() : onAction(buttons.secondary!.action)
              }
              title={buttons.secondary.needsSlot && slotBlocker ? slotBlocker : undefined}
              className={cn(
                "inline-flex h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#34451F] px-3 text-[13px] font-semibold whitespace-nowrap text-[#34451F] transition-colors hover:bg-[#E5EBD8] disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:px-3.5 lg:flex-initial",
                !buttons.primary && "col-span-2"
              )}
            >
              {spinner(buttons.secondary) ??
                (buttons.secondary.action === "reopen" ? (
                  <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : buttons.secondary.action === "resend" ? (
                  <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                ))}
              {buttons.secondary.label}
            </button>
          )}

          {buttons.primary &&
            (primaryBlocked ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRevealSlot}
                title={slotBlocker}
                className={cn(
                  "inline-flex h-11 min-w-0 flex-1 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-center text-[13px] leading-tight font-semibold text-amber-800 sm:whitespace-nowrap transition-colors hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:px-4 lg:flex-initial",
                  !buttons.secondary && "col-span-2"
                )}
              >
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                {buttons.primary.label}: pick a slot
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction(buttons.primary!.action)}
                className={cn(
                  "inline-flex h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#34451F] px-3 text-[13px] font-semibold whitespace-nowrap text-white shadow-sm transition-colors hover:bg-[#283719] disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:px-4 lg:flex-initial",
                  !buttons.secondary && "col-span-2"
                )}
              >
                {spinner(buttons.primary)}
                {buttons.primary.label}
                {pendingAction !== buttons.primary.action && (
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
            primaryBlocked ? "font-semibold text-amber-800" : "text-admin-muted"
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/* The preview is plain text, so the bold markup the email copy carries is dropped. */
const stripTags = (html: string) => html.replace(/<[^>]+>/g, "");

function EmailPreview({ email, to }: { email: PrivateHireEmail; to: string }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-[#D8D5C8] bg-white p-3 text-left">
      <p className="font-bold text-[12px] whitespace-nowrap text-[#5E6654]">To: {to}</p>
      <p className="font-black text-xs text-[#20231A]">{stripTags(email.subject)}</p>
      <p className="text-xs text-[#5E6654]">{stripTags(email.greeting)}</p>
      {email.body.map((p, i) => (
        <p key={i} className="text-xs leading-relaxed text-[#5E6654]">{stripTags(p)}</p>
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

export type ActionDraft = {
  note: string;
  deposit: string;
  via: Exclude<DepositPaidVia, "square" | "none">;
  reason: string;
  refundVia: RefundVia;
  refundNow: boolean;
};

const MANUAL_PAYMENT_METHODS: ActionDraft["via"][] = ["bank_transfer", "cash", "other"];
const REFUND_METHODS: RefundVia[] = ["square", "bank_transfer", "cash", "other"];

const dialogInputClass =
  "w-full rounded-xl border border-[#D8D5C8] bg-white px-3 py-2 text-[13px] text-[#20231A] transition-all focus:border-[#34451F]/30 focus:outline-none";

/* The body of an action's confirm dialog: optional deposit and payment-method
   fields, the note for the customer, and a live preview of the email. The
   approve dialog previews the confirmation instead when the deposit is £0,
   since that is what will actually be sent. */
function ActionDialogBody({
  initial,
  onChange,
  emails,
  depositLabel,
  showVia,
  refund,
  refundOffer,
  to,
  noteLabel,
  notePlaceholder,
  notice,
}: {
  initial: ActionDraft;
  onChange: (draft: ActionDraft) => void;
  emails: {
    withDeposit: RenderedSlots | null;
    noDeposit?: RenderedSlots | null;
    whenRefunding?: RenderedSlots | null;
    previewAmount?: string;
  };
  depositLabel?: string;
  showVia?: boolean;
  refund?: { cardAllowed: boolean; max: number };
  refundOffer?: { amount: number };
  to: string;
  noteLabel: string;
  notePlaceholder: string;
  notice?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(initial);
  const update = (patch: Partial<ActionDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
  };

  const amount = Number(draft.deposit);
  const noDeposit = depositLabel && emails.noDeposit !== undefined && draft.deposit.trim() !== "" && amount <= 0;
  const slots = noDeposit
    ? emails.noDeposit
    : refundOffer && draft.refundNow && emails.whenRefunding !== undefined
      ? emails.whenRefunding
      : emails.withDeposit;
  const refundTooMuch = !!refund && Number.isFinite(amount) && amount > refund.max;
  const shownAmount = Number.isFinite(amount) && amount > 0 ? formatDeposit(amount) : null;
  const previewSlots =
    slots && emails.previewAmount && shownAmount
      ? {
          ...slots,
          subject: slots.subject.split(emails.previewAmount).join(shownAmount),
          intro: slots.intro.split(emails.previewAmount).join(shownAmount),
        }
      : slots;

  return (
    <div className="space-y-3 text-left">
      {(depositLabel || showVia) && (
        <div className="flex gap-2">
          {depositLabel && (
            <label className="block flex-1">
              <span className="mb-1.5 block font-bold text-[12px] whitespace-nowrap text-[#5E6654]">{depositLabel}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={draft.deposit}
                onChange={(e) => update({ deposit: e.target.value })}
                className={dialogInputClass}
              />
            </label>
          )}
          {showVia && (
            <label className="block flex-1">
              <span className="mb-1.5 block font-bold text-[12px] whitespace-nowrap text-[#5E6654]">Paid by</span>
              <select
                value={draft.via}
                onChange={(e) => update({ via: e.target.value as ActionDraft["via"] })}
                className={cn(dialogInputClass, "cursor-pointer")}
              >
                {MANUAL_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {DEPOSIT_PAID_VIA_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {refund && (
            <label className="block flex-1">
              <span className="mb-1.5 block font-bold text-[12px] whitespace-nowrap text-[#5E6654]">Paid back</span>
              <select
                value={draft.refundVia}
                onChange={(e) => update({ refundVia: e.target.value as RefundVia })}
                className={cn(dialogInputClass, "cursor-pointer")}
              >
                {REFUND_METHODS.filter((m) => m !== "square" || refund.cardAllowed).map((m) => (
                  <option key={m} value={m}>
                    {REFUND_VIA_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {refund && (
        <p className={cn("text-[12px]", refundTooMuch ? "font-semibold text-admin-error" : "text-admin-muted")}>
          {refundTooMuch
            ? `Only ${formatDeposit(refund.max)} is still held.`
            : draft.refundVia === "square"
              ? `Up to ${formatDeposit(refund.max)}. Goes back to the card through Square and usually shows within 5-10 working days.`
              : `Up to ${formatDeposit(refund.max)}. Records a refund you've already paid back - nothing is sent to Square.`}
        </p>
      )}
      {refund && (
        <label className="block">
          <span className="mb-1.5 block font-bold text-[12px] whitespace-nowrap text-[#5E6654]">Reason (team only)</span>
          <input
            type="text"
            value={draft.reason}
            placeholder="Why it's being refunded..."
            onChange={(e) => update({ reason: e.target.value })}
            className={cn(dialogInputClass, "text-xs placeholder:text-[#5E6654]/50")}
          />
        </label>
      )}
      {refundOffer && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-admin-line bg-admin-surface/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={draft.refundNow}
            onChange={(e) => update({ refundNow: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#34451F]"
          />
          <span className="text-[12px] leading-snug text-admin-ink">
            <span className="font-semibold">Also refund the {formatDeposit(refundOffer.amount)} deposit to their card now.</span>{" "}
            Goes back through Square and the email says so. Untick to sort the refund out later.
          </span>
        </label>
      )}
      {notice}
      {noDeposit && (
        <p className="rounded-lg bg-admin-info-bg px-3 py-2 text-[12px] font-semibold text-admin-info">
          No deposit - this confirms the hire straight away and puts it on the schedule.
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block font-bold text-[12px] whitespace-nowrap text-[#5E6654]">{noteLabel}</span>
        <textarea
          value={draft.note}
          rows={3}
          placeholder={notePlaceholder}
          onChange={(e) => update({ note: e.target.value })}
          className={cn(dialogInputClass, "resize-none text-xs placeholder:text-[#5E6654]/50")}
        />
      </label>
      {previewSlots ? (
        <EmailPreview email={buildPrivateHireOutcomeEmail({ slots: previewSlots, notes: draft.note })} to={to} />
      ) : (
        <p className="text-[12px] text-admin-muted">This email is switched off, so nothing will be sent.</p>
      )}
    </div>
  );
}

const LIST_HREF = "/event-bookings/private-bookings";

export function PrivateHireCard({
  request,
  square,
  maxCapacity,
  onSheetOpenChange,
}: {
  request: PrivateHireRequest;
  square: SquareDashboard;
  maxCapacity: number | null;
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

  const [declineReasonText, setDeclineReasonText] = useState(request.decline_reason || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<HireAction | null>(null);
  const [clashes, setClashes] = useState<ClashEvent[]>([]);
  const [slotFlash, setSlotFlash] = useState(false);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [sysInfoOpen, setSysInfoOpen] = useState(false);
  const [declineReasonOpen, setDeclineReasonOpen] = useState(false);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const slotRowRef = useRef<HTMLDivElement>(null);
  const sheetBodyRef = useRef<HTMLDivElement>(null);
  const askingToClose = useRef(false);
  const actionDraft = useRef<ActionDraft>({
    note: "",
    deposit: "",
    via: "bank_transfer",
    reason: "",
    refundVia: "square",
    refundNow: false,
  });

  const status = normalizePrivateHireStatus(request.status);
  const theme = STATUS_THEME[status];
  const editable = status !== "declined" && status !== "cancelled";
  const isCancelled = !editable;
  const depositEditable = status === "new" || status === "awaiting_customer" || status === "awaiting_deposit";

  const currentSub = unwrapSubtype(request.event_subtypes);
  const shortRef = request.id.slice(0, 8).toUpperCase();

  const [guestCount, setGuestCount] = useState(String(request.guest_count ?? ""));
  const [subtypeId, setSubtypeId] = useState(String(request.event_subtypes_id));
  const [openingSlot] = useState(() => initialSlot(request, status));
  const savedSlot = {
    date: request.selected_date || "",
    start: toHHMM(request.selected_start_time),
    end: toHHMM(request.selected_end_time),
    prefilled: false,
  };
  const slotBaseline = savedSlot.date || savedSlot.start || savedSlot.end ? savedSlot : openingSlot;
  const [selectedDate, setSelectedDate] = useState(openingSlot.date);
  const [selectedStartTime, setSelectedStartTime] = useState(openingSlot.start);
  const [selectedEndTime, setSelectedEndTime] = useState(openingSlot.end);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState(
    request.deposit_amount != null ? String(request.deposit_amount) : ""
  );
  const [depositDue, setDepositDue] = useState(request.deposit_due_date || "");

  const joinedTypeName = unwrapSubtype(currentSub?.event_types)?.name;

  const [options, setOptions] = useState<PrivateEventOptions | null>(null);
  useEffect(() => {
    if (!open || options) return;
    getPrivateEventOptions().then(setOptions).catch(() => {});
  }, [open, options]);
  const [defaultDeposit, setDefaultDeposit] = useState<number | null>(null);
  const [depositDetailsOpen, setDepositDetailsOpen] = useState(false);
  const [contactDetailsOpen, setContactDetailsOpen] = useState(false);
  useEffect(() => {
    if (!open || defaultDeposit != null || !depositEditable) return;
    privateHireDepositDefaultAction().then(setDefaultDeposit).catch(() => {});
  }, [open, defaultDeposit, depositEditable]);
  const usingDefaultDeposit = depositEditable && depositAmount.trim() === "";
  const onlyType = options?.types.length === 1 ? options.types[0] : undefined;
  const typeId =
    currentSub?.event_types_id != null ? String(currentSub.event_types_id) : onlyType ? String(onlyType.id) : "";
  const subtypeOptions = (options?.subtypes ?? []).filter((s) => !typeId || String(s.event_types_id) === typeId);

  const typeName = toTitleCase(options?.types.find((t) => String(t.id) === typeId)?.name ?? joinedTypeName);
  const subtypeName =
    toTitleCase(subtypeOptions.find((s) => String(s.id) === subtypeId)?.name ?? currentSub?.name);

  const bookingNote = (request.additional_requirements ?? "").trim();
  const internalNotes = request.internal_notes ?? [];

  const declineReason = declineReasonText.trim();
  const declineIsLong = declineReason.length > DECLINE_PREVIEW_LEN;
  const declineHead = declineReason.slice(0, DECLINE_PREVIEW_LEN).trimEnd();

  const eventHref = request.event_id
    ? `/event-setups/events?open=${request.event_id}&back=${encodeURIComponent(`${LIST_HREF}?open=${request.id}`)}`
    : null;
  const linkedEvent = Array.isArray(request.linked_event) ? request.linked_event[0] : request.linked_event;
  const eventIsActive = linkedEvent?.is_active === true;

  const isWorkingStage = status === "new" || status === "awaiting_customer" || status === "expired";
  const showEventBadge = !!eventHref || !isWorkingStage;
  const needsDate = isWorkingStage && !selectedDate;
  const needsTime = isWorkingStage && (!selectedStartTime || !selectedEndTime);
  const dateHasPassed = isWorkingStage && !!selectedDate && selectedDate < format(new Date(), "yyyy-MM-dd");
  const slotWarning =
    needsDate && needsTime
      ? "Set a date and time before you approve or propose it."
      : needsDate
        ? "Set a date before you approve or propose it."
        : dateHasPassed
          ? `${formatDay(selectedDate)} has passed - pick a new date before you approve or propose it.`
          : needsTime
            ? "Set a start and end time before you approve or propose it."
            : undefined;
  const showSlotWarning = confirmAttempted && !!slotWarning;

  const clashCheckReady = !(isCancelled || !selectedDate || !selectedStartTime || !selectedEndTime);
  const visibleClashes = clashCheckReady ? clashes : [];
  const hasClashes = visibleClashes.length > 0;
  const clashWarning = hasClashes
    ? `Clashes with ${visibleClashes.map((c) => c.title).join(", ")} - pick another time.`
    : undefined;
  const slotIsSet = !!selectedDate && !!selectedStartTime && !!selectedEndTime && !hasClashes;

  const dateTimeChanged =
    selectedDate !== slotBaseline.date ||
    selectedStartTime !== slotBaseline.start ||
    selectedEndTime !== slotBaseline.end;
  const detailsChanged =
    guestCount !== String(request.guest_count ?? "") ||
    subtypeId !== String(request.event_subtypes_id) ||
    declineReasonText !== (request.decline_reason ?? "");
  const origDeposit = request.deposit_amount != null ? String(request.deposit_amount) : "";
  const depositValue = (v: string) => (v.trim() === "" ? null : Number(v));
  const depositChanged =
    depositValue(depositAmount) !== depositValue(origDeposit) || depositDue !== (request.deposit_due_date || "");
  const hasChanges = detailsChanged || dateTimeChanged || depositChanged;
  const depositAmountChanged =
    depositAmount.trim() !== "" && Number(depositAmount) !== Number(request.deposit_amount ?? 0);

  const editFields = () => ({
    guest_count: guestCount.trim() === "" ? request.guest_count : Number(guestCount),
    event_subtypes_id: subtypeId ? Number(subtypeId) : request.event_subtypes_id,
    selected_date: selectedDate || null,
    selected_start_time: selectedStartTime || null,
    selected_end_time: selectedEndTime || null,
    decline_reason: declineReasonText || null,
    ...(depositChanged
      ? {
          deposit_amount: depositAmount.trim() === "" ? null : Math.max(0, Number(depositAmount)),
          ...(status === "awaiting_deposit" && depositDue ? { deposit_due_date: depositDue } : {}),
        }
      : {}),
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
        const list = await getClashingEvents(selectedDate, selectedStartTime, selectedEndTime, request.event_id, request.id);
        if (!cancelled) setClashes(list);
      } catch {
        if (!cancelled) setClashes([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isCancelled, selectedDate, selectedStartTime, selectedEndTime, request.event_id, request.id]);

  async function findClashes(): Promise<ClashEvent[]> {
    if (!selectedDate) {
      setClashes([]);
      return [];
    }
    const list = await getClashingEvents(
      selectedDate,
      selectedStartTime || null,
      selectedEndTime || null,
      request.event_id,
      request.id
    );
    setClashes(list);
    return list;
  }

  function startEmail() {
    const composer = document.getElementById(`reply-${request.id}`);
    if (!composer) {
      window.location.href = `mailto:${request.email}`;
      return;
    }
    composer.scrollIntoView({ block: "center", behavior: "smooth" });
    composer.focus({ preventScroll: true });
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
    setSubtypeId(String(request.event_subtypes_id));
    setSelectedDate(slotBaseline.date);
    setSelectedStartTime(slotBaseline.start);
    setSelectedEndTime(slotBaseline.end);
    setDeclineReasonText(request.decline_reason || "");
    setDepositAmount(origDeposit);
    setDepositDue(request.deposit_due_date || "");
    setClashes([]);
    setError(null);
  }

  function closeDiscarding() {
    discardChanges();
    setSheetOpen(false);
  }

  type DialogSpec = {
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    email?: PrivateHireEmailKey;
    noDepositEmail?: PrivateHireEmailKey;
    deposit?: string;
    via?: boolean;
    noteLabel: string;
    notePlaceholder: string;
    notice?: React.ReactNode;
    refund?: { cardAllowed: boolean; max: number };
    refundOffer?: { amount: number };
  };

  const guestsOnScreen = guestCount.trim() === "" ? request.guest_count : Number(guestCount);
  const overCapacity = maxCapacity != null && guestsOnScreen != null && guestsOnScreen > maxCapacity;
  const capacityNotice = overCapacity ? (
    <div className="rounded-lg border border-admin-warning/30 bg-admin-warning-bg px-3 py-2 text-[12px] leading-snug text-admin-warning">
      <p className="font-semibold">
        {guestsOnScreen} guests is over the venue&apos;s capacity of {maxCapacity}.
      </p>
      <p className="mt-0.5">Check the numbers with the customer, or change Guests on the sheet, before going ahead.</p>
    </div>
  ) : undefined;
  const withCapacityNotice = (notice?: React.ReactNode) =>
    notice && capacityNotice ? (
      <div className="space-y-2">
        {notice}
        {capacityNotice}
      </div>
    ) : (notice ?? capacityNotice);

  const depositOverdue =
    !!request.deposit_due_date && request.deposit_due_date < format(new Date(), "yyyy-MM-dd");
  const refundLeft = refundableAmount(request.paid_amount, request.refunded_amount);
  const refundPending = request.refund_status === "pending";
  const cardRefundAllowed =
    canRefundToCard({ paidVia: request.deposit_paid_via, squarePaymentId: request.square_payment_id }) && !refundPending;
  const refundNotice =
    refundLeft > 0 ? (
      <div className="rounded-lg border border-admin-warning/30 bg-admin-warning-bg px-3 py-2 text-[12px] leading-snug text-admin-warning">
        <p className="font-semibold">
          {formatDeposit(refundLeft)} of the deposit is still held - cancelling doesn&apos;t give it back.
        </p>
        <p className="mt-0.5">
          {refundPending
            ? "A card refund is already on its way through Square."
            : `It was paid by ${(DEPOSIT_PAID_VIA_LABEL[request.deposit_paid_via as DepositPaidVia] ?? "another method").toLowerCase()}, so pay it back by hand and record it with Refund deposit.`}
        </p>
      </div>
    ) : undefined;

  function dialogFor(action: HireAction): DialogSpec | null {
    const approveLike = {
      email: "private_hire.approved" as const,
      noDepositEmail: "private_hire.confirmed" as const,
      deposit: "Deposit (£)",
      noteLabel: "Message to the customer (optional)",
      notePlaceholder: "Anything they should know before paying...",
    };
    switch (action) {
      case "approve":
        return {
          ...approveLike,
          title: "Approve these times?",
          description: "Emails the customer asking for the deposit. The date is held until it's due.",
          confirmLabel: "Approve & Email",
          notice: capacityNotice,
        };
      case "accept":
        return {
          ...approveLike,
          title: "Mark the proposed time accepted?",
          description: "Use this when the customer agreed by email or phone. Emails them asking for the deposit.",
          confirmLabel: "Mark Accepted & Email",
          notice: withCapacityNotice(
            dateTimeChanged ? (
            <div className="rounded-lg border border-admin-warning/30 bg-admin-warning-bg px-3 py-2 text-[12px] leading-snug text-admin-warning">
              <p className="font-semibold">This isn&apos;t the time the customer was offered.</p>
              <p className="mt-0.5">
                They were sent {formatDay(request.selected_date)}, {formatTimeRange(request.selected_start_time, request.selected_end_time)}.
                Continuing approves {formatDay(selectedDate)}, {formatTimeRange(selectedStartTime, selectedEndTime)} instead, which
                they haven&apos;t seen - only do this if they agreed to it by email or phone.
              </p>
            </div>
          ) : undefined
          ),
        };
      case "reopenDeposit":
        return {
          ...approveLike,
          title: "Reopen with a new deadline?",
          description: "Sends a fresh deposit request with a new due date and holds the date again.",
          confirmLabel: "Reopen & Email",
          notice: capacityNotice,
        };
      case "reschedule":
        return status === "awaiting_deposit"
          ? {
              title: "Move this hire?",
              description:
                "Emails the customer the new date and time with the deposit details, and replaces their payment link. The due date moves earlier if the new date needs it.",
              confirmLabel: "Move & Email",
              email: "private_hire.rescheduled",
              noDepositEmail: "private_hire.confirmed",
              deposit: "Deposit (£)",
              noteLabel: "Message to the customer (optional)",
              notePlaceholder: "Why the date or time has changed...",
            }
          : {
              title: "Move this hire?",
              description: "Updates the event on the schedule and emails the customer the new date and time.",
              confirmLabel: "Move & Email",
              email: "private_hire.rescheduled",
              noteLabel: "Message to the customer (optional)",
              notePlaceholder: "Why the date or time has changed...",
            };
      case "changeDeposit":
        return {
          title: "Change the deposit?",
          description:
            "Emails the customer the new amount, and their payment link is replaced with one for it. £0 confirms the hire with no deposit.",
          confirmLabel: "Update & Email",
          email: "private_hire.deposit_updated",
          noDepositEmail: "private_hire.confirmed",
          deposit: "New deposit (£)",
          noteLabel: "Message to the customer (optional)",
          notePlaceholder: "Why the deposit has changed...",
        };
      case "propose":
        return {
          title: "Propose this time?",
          description: "Emails the customer the selected date and time to accept or turn down.",
          confirmLabel: "Propose & Email",
          email: "private_hire.proposed",
          noteLabel: "Message to the customer (optional)",
          notePlaceholder: "Why you're suggesting this time...",
          notice: capacityNotice,
        };
      case "resend":
        return status === "awaiting_customer"
          ? {
              title: "Send the proposal again?",
              description: "Emails the customer the proposed date and time again, with the link to accept or turn it down.",
              confirmLabel: "Send Again",
              email: "private_hire.proposed",
              noteLabel: "Message to the customer (optional)",
              notePlaceholder: "Just checking you saw this...",
            }
          : {
              title: "Send the deposit request again?",
              description: "Emails the customer the deposit request again, with the link to pay.",
              confirmLabel: "Send Again",
              email: "private_hire.approved",
              noteLabel: "Message to the customer (optional)",
              notePlaceholder: "Just checking you saw this...",
              notice: depositOverdue ? (
                <div className="rounded-lg border border-admin-warning/30 bg-admin-warning-bg px-3 py-2 text-[12px] leading-snug text-admin-warning">
                  <p className="font-semibold">
                    The deadline of {formatDay(request.deposit_due_date)} has passed.
                  </p>
                  <p className="mt-0.5">
                    Sending again sets a new one from today, shown in the email below, and keeps holding the date. To
                    pick the deadline yourself, change Deposit due on the sheet first.
                  </p>
                </div>
              ) : undefined,
            };
      case "markPaid":
        return {
          title: "Record the deposit as paid?",
          description: "Confirms the hire, puts it on the schedule and emails the customer.",
          confirmLabel: "Confirm Hire & Email",
          email: "private_hire.confirmed",
          deposit: "Amount paid (£)",
          via: true,
          noteLabel: "Message to the customer (optional)",
          notePlaceholder: "Anything they should know before the day...",
        };
      case "decline":
        return {
          title: "Decline & email the customer?",
          description: "Turns the request down and emails the customer.",
          confirmLabel: "Decline & Email",
          destructive: true,
          email: "private_hire.declined",
          noteLabel: "Reason for declining (optional)",
          notePlaceholder: "Shared with the customer in the email. Leave blank to say nothing.",
        };
      case "cancel": {
        const offerRefund = refundLeft > 0 && cardRefundAllowed;
        return {
          title: "Cancel this hire?",
          description:
            status === "confirmed"
              ? "Takes the event off the schedule and emails the customer."
              : "Releases the held date and emails the customer.",
          confirmLabel: "Cancel Hire & Email",
          destructive: true,
          email: status === "confirmed" ? "private_hire.booking_cancelled" : "private_hire.cancelled",
          noteLabel: "Message to the customer (optional)",
          notePlaceholder: "Shared with the customer in the email.",
          notice: offerRefund ? undefined : refundNotice,
          refundOffer: offerRefund ? { amount: refundLeft } : undefined,
        };
      }
      case "refund":
        return {
          title: "Refund the deposit?",
          description: cardRefundAllowed
            ? "Sends the money back through Square, or records a refund you've paid back another way, and emails the customer."
            : "Records a refund you've paid back by hand and emails the customer. It wasn't paid by card, so Square isn't involved.",
          confirmLabel: "Refund & Email",
          email: "private_hire.deposit_refunded",
          deposit: "Refund amount (£)",
          refund: { cardAllowed: cardRefundAllowed, max: refundLeft },
          noteLabel: "Message to the customer (optional)",
          notePlaceholder: "Anything they should know about the refund...",
        };
      default:
        return null;
    }
  }

  async function askForAction(action: HireAction): Promise<boolean> {
    if (action === "reopen") {
      return confirm({
        title: "Reopen this request?",
        description:
          (Number(request.paid_amount) || 0) > 0
            ? `Moves it back to New so you can review it again, and clears the earlier approval and payment - the ${formatDeposit(request.paid_amount)} paid is kept in Team notes. Nothing is emailed.`
            : "Moves it back to New so you can review it again. The earlier approval stamps are cleared. Nothing is emailed.",
        confirmLabel: "Reopen",
      });
    }
    const d = dialogFor(action);
    if (!d) return false;

    /* Fetched rather than composed here, so the preview is the copy that will
       actually be sent - including any wording changed on the settings page. */
    const slotOnScreen = {
      date: selectedDate || null,
      start: selectedStartTime || null,
      end: selectedEndTime || null,
      subtypeId: subtypeId ? Number(subtypeId) : null,
      deposit: depositAmount.trim() ? Number(depositAmount) : null,
      renewOverdueDue: action === "resend",
    };
    const refundVia: RefundVia = d.refund?.cardAllowed ? "square" : "bank_transfer";
    const previewRefund = d.refund
      ? { amount: d.refund.max, via: refundVia }
      : d.refundOffer
        ? { amount: d.refundOffer.amount, via: "square" as const }
        : null;
    const [withDeposit, noDeposit, whenRefunding, defaultDeposit] = await Promise.all([
      d.email
        ? privateHireEmailSlotsAction(d.email, request.id, { ...slotOnScreen, refund: d.refund ? previewRefund : null })
        : Promise.resolve(null),
      d.noDepositEmail
        ? privateHireEmailSlotsAction(d.noDepositEmail, request.id, slotOnScreen)
        : Promise.resolve(undefined),
      d.email && d.refundOffer
        ? privateHireEmailSlotsAction(d.email, request.id, { ...slotOnScreen, refund: previewRefund })
        : Promise.resolve(undefined),
      d.deposit && !depositAmount && !d.refund
        ? privateHireDepositDefaultAction()
        : Promise.resolve(Number(depositAmount)),
    ]);

    const startingDeposit = d.refund
      ? String(d.refund.max)
      : action === "markPaid"
        ? String(request.deposit_amount ?? defaultDeposit ?? "")
        : String(depositAmount || defaultDeposit || "");
    const initial: ActionDraft = {
      note: action === "decline" || action === "cancel" ? declineReasonText : "",
      deposit: d.deposit ? startingDeposit : "",
      via: "bank_transfer",
      reason: "",
      refundVia,
      refundNow: !!d.refundOffer,
    };
    actionDraft.current = initial;

    return confirm({
      title: d.title,
      description: d.description,
      confirmLabel: d.confirmLabel,
      variant: d.destructive ? "destructive" : undefined,
      content: (
        <ActionDialogBody
          initial={initial}
          onChange={(draft) => {
            actionDraft.current = draft;
          }}
          emails={{
            withDeposit,
            noDeposit,
            whenRefunding,
            previewAmount: formatDeposit(Number(startingDeposit) || 0),
          }}
          depositLabel={d.deposit}
          showVia={d.via}
          refund={d.refund}
          refundOffer={d.refundOffer}
          notice={d.notice}
          to={request.email}
          noteLabel={d.noteLabel}
          notePlaceholder={d.notePlaceholder}
        />
      ),
    });
  }

  function handleAction(action: HireAction) {
    setError(null);
    setClashes([]);
    void attempt(async () => {
      const usesSlot =
        action === "approve" ||
        action === "propose" ||
        action === "accept" ||
        action === "reopenDeposit" ||
        action === "reschedule";
      if (usesSlot) {
        const c = await findClashes();
        if (c.length) return;
      }
      if (!(await askForAction(action))) return;
      runAction(action, actionDraft.current);
    }, () => setError("Failed to update. Please try again."));
  }

  function runAction(action: HireAction, draft: ActionDraft) {
    setPendingAction(action);
    startTransition(async () => {
      try {
        if (hasChanges || slotBaseline.prefilled) await updatePrivateHireFields(request.id, editFields());
        const note = draft.note.trim() || undefined;
        const amount = draft.deposit.trim() === "" ? null : Math.max(0, Number(draft.deposit));
        const check = (r: { ok: boolean; error?: string }) => {
          if (!r.ok) throw new Error(r.error);
        };
        let warning: string | null = null;
        switch (action) {
          case "approve":
          case "accept":
          case "reopenDeposit":
            check(
              await approvePrivateHireAction(request.id, {
                depositAmount: amount,
                note,
                source: action === "accept" ? "accepted_by_staff" : action === "reopenDeposit" ? "reopened" : "approved",
              })
            );
            break;
          case "propose":
            check(await proposePrivateHireAction(request.id, { note }));
            break;
          case "markPaid":
            check(await markPrivateHireDepositPaidAction(request.id, { via: draft.via, amount: amount ?? 0, note }));
            break;
          case "decline":
            check(await closePrivateHireAction(request.id, "declined", note));
            if (note?.trim()) setDeclineReasonText(note.trim());
            break;
          case "cancel": {
            const closed = await closePrivateHireAction(
              request.id,
              "cancelled",
              note,
              draft.refundNow && refundLeft > 0 ? { amount: refundLeft, via: "square" } : null
            );
            check(closed);
            if (closed.ok && closed.warning) warning = closed.warning;
            if (note?.trim()) setDeclineReasonText(note.trim());
            break;
          }
          case "refund":
            check(
              await refundPrivateHireDepositAction(request.id, {
                amount: amount ?? 0,
                via: draft.refundVia,
                reason: draft.reason.trim() || undefined,
                note,
              })
            );
            break;
          case "reopen":
            check(await reopenPrivateHireAction(request.id));
            setDeclineReasonText("");
            break;
          case "resend":
            check(await resendPrivateHireEmailAction(request.id, { note }));
            break;
          case "changeDeposit":
            check(await changeAgreedHireAction(request.id, { deposit: amount ?? 0 }, { note }));
            break;
          case "reschedule":
            check(
              await changeAgreedHireAction(
                request.id,
                {
                  slot: { date: selectedDate, start: selectedStartTime, end: selectedEndTime },
                  deposit: status === "awaiting_deposit" ? amount : null,
                },
                { note }
              )
            );
            break;
        }
        const zeroDeposit =
          (action === "approve" ||
            action === "accept" ||
            action === "reopenDeposit" ||
            action === "changeDeposit" ||
            (action === "reschedule" && status === "awaiting_deposit")) &&
          amount === 0;
        if (warning) toast.warning(warning, { duration: 10000 });
        else toast.success(zeroDeposit ? "Confirmed with no deposit - customer emailed" : ACTION_TOAST[action]);
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "Failed to update. Please try again.");
      }
      setPendingAction(null);
    });
  }

  function handleSave() {
    if (!hasChanges) return;
    if ((status === "awaiting_deposit" || status === "confirmed") && dateTimeChanged) {
      handleAction("reschedule");
      return;
    }
    if (status === "awaiting_deposit" && depositAmountChanged) {
      handleAction("changeDeposit");
      return;
    }
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
    if (askingToClose.current || !!pendingAction) return;
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
  const slotMatchesPreferred =
    !!preferredDate &&
    selectedDate === preferredDate &&
    selectedStartTime === preferredStart &&
    selectedEndTime === preferredEnd;
  const slotFilled = !!selectedDate && !!selectedStartTime && !!selectedEndTime;
  const slotRole = status !== "new" || !slotFilled ? null : slotMatchesPreferred ? "approve" : "propose";
  const slotHintsSeen = useSyncExternalStore(subscribeSlotHint, readSlotHintsSeen, () => "11");
  const slotHintSeen = slotRole === "approve" ? slotHintsSeen[0] === "1" : slotHintsSeen[1] === "1";
  const slotHintText =
    slotRole === "approve"
      ? `Approve times sends ${request.full_name} the deposit request for this slot.`
      : `Propose new time emails ${request.full_name} this slot to accept or turn down. Use the preferred pills above to switch back to their times.`;

  const subtypeBadge = toTitleCase(currentSub?.name);

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

  const [emailCount, setEmailCount] = useState<number | null>(null);

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
              {isCancelled && request.decline_reason && (
                <span
                  title={request.decline_reason}
                  className="shrink-0 rounded border border-admin-line bg-admin-surface px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-admin-muted uppercase"
                >
                  Reason given
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
                          {status === "cancelled" ? "Cancel Reason" : "Decline Reason"}
                        </span>
                        {declineReasonOpen ? (
                          <textarea
                            aria-label="Decline reason"
                            value={declineReasonText}
                            rows={3}
                            autoFocus
                            placeholder="Why was this rejected?"
                            onChange={(e) => setDeclineReasonText(e.target.value)}
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
                    <SheetRow label="Proposed" value={formatDateTime(request.proposed_at)} />
                    <SheetRow label="Approved" value={formatDateTime(request.approved_at)} />
                    <SheetRow label="Deposit reminded" value={formatDateTime(request.deposit_reminded_at)} />
                    <SheetRow label="Deposit paid" value={formatDateTime(request.deposit_paid_at)} />
                    <SheetRow label="Confirmed" value={formatDateTime(request.confirmed_at)} />
                    <SheetRow label="Closed" value={formatDateTime(request.closed_at)} />
                    <SheetRow label="Submitted" value={formatDateTime(request.created_at)} />
                    <SheetRow label="Last Modified" value={formatDateTime(request.updated_at)} />
                    <SheetRow label="Modified By" value={request.updated_by_employee?.full_name || "-"} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <StageStepper
              request={request}
              status={status}
              onAction={handleAction}
              pendingAction={pendingAction}
              slotBlocker={slotWarning ?? clashWarning}
              slotMatchesPreferred={slotMatchesPreferred}
              onRevealSlot={revealSlot}
              closedReason={declineReasonText}
              onClosedReasonChange={setDeclineReasonText}
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
            <div className="animate-in grid-cols-2 items-start gap-5 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid lg:space-y-0">
                <Section
                  className="min-w-0"
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

                  <EditRow
                    label="Guests"
                    value={guestCount}
                    onChange={setGuestCount}
                    editable={editable}
                    type="number"
                    placeholder="0"
                    readOnlyValue={request.guest_count}
                    trailing={
                      overCapacity ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Over the venue capacity of ${maxCapacity}`}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-admin-warning hover:bg-admin-warning-bg"
                            >
                              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="top" align="end" className="w-64 text-[12px] leading-snug">
                            {guestsOnScreen} guests is over the venue&apos;s capacity of {maxCapacity}, set in Company settings.
                          </PopoverContent>
                        </Popover>
                      ) : undefined
                    }
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
                      slotRole && "border-l-4 py-3 pl-3 sm:pl-4",
                      slotRole === "approve" && "border-l-admin-primary",
                      slotRole === "propose" && "border-l-admin-info",
                      hasClashes
                        ? "bg-red-50"
                        : showSlotWarning
                          ? "bg-amber-50"
                          : slotRole === "approve"
                            ? "bg-admin-primary-soft/60"
                            : slotRole === "propose" && "bg-admin-info-bg",
                      slotFlash && "ring-2 ring-amber-400/70 ring-inset"
                    )}
                  >
                    {slotRole && (
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-[13px] font-bold",
                            slotRole === "approve" ? "text-admin-primary" : "text-admin-info"
                          )}
                        >
                          {slotRole === "approve" ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                          ) : (
                            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                          )}
                          {slotRole === "approve" ? "You're approving" : "You're proposing"}
                          {slotHintSeen && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="What happens when you send this"
                                  className="-my-1 flex h-6 w-6 items-center justify-center rounded-full text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-admin-primary/40 focus-visible:outline-none max-sm:h-11 max-sm:w-11"
                                >
                                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="start"
                                className="w-72 rounded-xl border-admin-line bg-white p-3 text-[12px] leading-snug font-normal text-admin-ink"
                              >
                                {slotHintText}
                              </PopoverContent>
                            </Popover>
                          )}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                            slotRole === "approve"
                              ? "bg-admin-primary text-white"
                              : "bg-white text-admin-info ring-1 ring-admin-info/30"
                          )}
                        >
                          {slotRole === "approve" ? "Their requested time" : "Different time"}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <span className="shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]">
                        Selected Date &amp; Time
                      </span>
                      {editable ? (
                        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
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
                    {slotRole && !hasClashes && !slotHintSeen && (
                      <p className="mt-2 text-[12px] leading-snug text-admin-muted">
                        {slotHintText}{" "}
                        <button
                          type="button"
                          onClick={() => slotRole && markSlotHintSeen(slotRole)}
                          className="font-semibold text-admin-primary underline-offset-2 hover:underline max-sm:min-h-11"
                        >
                          Got it
                        </button>
                      </p>
                    )}
                    {editable && slotWarning && showSlotWarning && <FieldMessage warning={slotWarning} />}
                    {visibleClashes.length > 0 && (
                      <div className="mt-2">
                        <ClashList clashes={visibleClashes} />
                      </div>
                    )}
                  </div>
                </Section>

              <div className="min-w-0 space-y-4 sm:space-y-5">
                {notesCards}
              </div>

                <Section
                  className="min-w-0"
                  title="Deposit"
                  headerRight={
                    request.payment_status ? (
                      <PaymentStatusPill
                        status={request.payment_status}
                        refund={{ amount: Number(request.refunded_amount) || 0, status: request.refund_status }}
                      />
                    ) : undefined
                  }
                >
                  <EditRow
                    label="Deposit (£)"
                    value={depositAmount}
                    onChange={setDepositAmount}
                    editable={depositEditable}
                    type="number"
                    placeholder={defaultDeposit != null ? formatDeposit(defaultDeposit) : "Company default"}
                    inputClassName={usingDefaultDeposit && defaultDeposit != null ? "placeholder:text-[#20231A]" : undefined}
                    readOnlyValue={request.deposit_amount != null ? formatDeposit(request.deposit_amount) : "-"}
                    trailing={
                      usingDefaultDeposit && defaultDeposit != null ? (
                        <span
                          title="Not saved on the request yet - this amount is set when you approve, unless you type a different one"
                          className="shrink-0 rounded-full bg-admin-surface px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-admin-muted"
                        >
                          Company default
                        </span>
                      ) : undefined
                    }
                  />
                  {request.payment_status === "partially_paid" && (
                    <SheetRow
                      label="Balance owed"
                      value={
                        <span className="text-admin-warning">
                          {formatDeposit(
                            Math.max(0, (Number(request.deposit_amount) || 0) - (Number(request.paid_amount) || 0))
                          )}
                        </span>
                      }
                    />
                  )}
                  {depositDetailsOpen && (
                    <div id={`deposit-details-${request.id}`} className="animate-in border-b border-[#D8D5C8] duration-200 fade-in">
                      <SheetRow
                        label="Payment amount"
                        value={request.paid_amount != null ? formatDeposit(request.paid_amount) : "-"}
                      />
                      <EditRow
                        label="Deposit due"
                        value={depositDue}
                        onChange={setDepositDue}
                        editable={status === "awaiting_deposit"}
                        type="date"
                        readOnlyValue={formatDay(request.deposit_due_date) || "-"}
                      />
                      <SheetRow label="Deposit reminded at" value={formatDateTime(request.deposit_reminded_at)} />
                      <SheetRow
                        label="Deposit paid"
                        value={
                          [
                            request.deposit_paid_at ? formatDateTime(request.deposit_paid_at) : "",
                            request.deposit_paid_via
                              ? `via ${(DEPOSIT_PAID_VIA_LABEL[request.deposit_paid_via as DepositPaidVia] ?? request.deposit_paid_via).toLowerCase()}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ") || "-"
                        }
                      />
                      <LinkRow
                        label="Square payment ID"
                        value={request.square_payment_id}
                        href={
                          request.square_payment_id
                            ? squareTransactionUrl(square.environment, request.square_payment_id, square.locationId)
                            : null
                        }
                        title="Open this payment in the Square dashboard"
                      />
                      <LinkRow
                        label="Square order ID"
                        value={request.square_order_id}
                        href={request.square_order_id ? squareOrderUrl(square.environment, request.square_order_id) : null}
                        title="Open this order in the Square dashboard"
                      />
                      <LinkRow
                        label="Payment link"
                        value={request.payment_link_url}
                        href={request.payment_link_url}
                        title="Open the customer's Square payment link"
                      />
                      {(Number(request.refunded_amount) || 0) > 0 || request.refund_status ? (
                        <>
                          <SheetRow
                            label="Refunded"
                            value={
                              [
                                formatDeposit(request.refunded_amount),
                                request.refunded_at ? `on ${formatDateTime(request.refunded_at)}` : "",
                                request.refunded_via
                                  ? `via ${(REFUND_VIA_LABEL[request.refunded_via as RefundVia] ?? request.refunded_via).toLowerCase()}`
                                  : "",
                                request.refund_status === "pending"
                                  ? "(Square is processing it)"
                                  : request.refund_status === "failed"
                                    ? "(failed in Square)"
                                    : "",
                              ]
                                .filter(Boolean)
                                .join(" ")
                            }
                          />
                          <SheetRow label="Square refund ID" value={request.square_refund_id} />
                        </>
                      ) : null}
                    </div>
                  )}
                  {refundLeft > 0 && !refundPending && (
                    <div className="flex justify-end border-b border-[#D8D5C8] px-4 py-2 sm:px-5">
                      <button
                        type="button"
                        disabled={!!pendingAction}
                        onClick={() => handleAction("refund")}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#34451F] px-3.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#283719] disabled:pointer-events-none disabled:opacity-50 max-sm:h-11"
                      >
                        {pendingAction === "refund" ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                        ) : (
                          <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        Refund deposit
                      </button>
                    </div>
                  )}
                  <ViewMoreButton
                    open={depositDetailsOpen}
                    onToggle={() => setDepositDetailsOpen((v) => !v)}
                    controls={`deposit-details-${request.id}`}
                  />
                </Section>

              <div className="min-w-0 space-y-4 sm:space-y-5">
                <Section title="Contact">
                  <SheetRow label="Name" value={request.full_name} />
                  {contactDetailsOpen && (
                    <div
                      id={`contact-details-${request.id}`}
                      className="animate-in border-b border-[#D8D5C8] duration-200 fade-in"
                    >
                      <ContactRow
                        label="Email"
                        value={request.email}
                        href={request.email ? `mailto:${request.email}` : null}
                        icon={Mail}
                        onActivate={editable ? startEmail : undefined}
                        actionTitle={editable ? `Write an email to ${request.full_name}` : undefined}
                      />
                      <ContactRow
                        label="Phone"
                        value={request.phone_no}
                        href={request.phone_no ? `tel:${request.phone_no.replace(/\s+/g, "")}` : null}
                        icon={Phone}
                        actionTitle={request.phone_no ? `Call ${request.phone_no}` : undefined}
                      />
                      <ContactRow
                        label="Customer page"
                        value={status === "awaiting_customer" ? "Waiting for their answer" : status === "awaiting_deposit" ? "Pay deposit link" : "Request status"}
                        href={`/private-hire/${request.id}`}
                        icon={ExternalLink}
                        external
                        actionTitle="Open the customer's request page"
                      />
                    </div>
                  )}
                  <ViewMoreButton
                    open={contactDetailsOpen}
                    onToggle={() => setContactDetailsOpen((v) => !v)}
                    controls={`contact-details-${request.id}`}
                  />
                </Section>

                {isCancelled && (
                  <Section title="Reason Given to the Customer">
                    <div className="p-4 sm:p-5">
                      <textarea
                        aria-label="Reason given to the customer"
                        value={declineReasonText}
                        onChange={(e) => setDeclineReasonText(e.target.value)}
                        rows={4}
                        placeholder="The reason given to the customer when this was closed..."
                        className="w-full resize-none rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2 text-[13px] text-[#20231A] transition-all placeholder:text-[#5E6654]/50 focus:border-[#34451F]/30 focus:outline-none"
                      />
                      <p className="mt-1.5 text-[10px] leading-snug text-[#5E6654]/70">
                        Saved when you hit Save.
                      </p>
                    </div>
                  </Section>
                )}
              </div>

                <Section
                  className="min-w-0 lg:col-span-2"
                  title="Correspondence"
                  headerRight={
                    <span className="flex items-center gap-1.5">
                      <MessageCountPill count={emailCount} />
                      {(request.unread_emails ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#9A5B00] px-2 py-0.5 text-[11px] font-semibold text-white">
                          <Mail className="h-3 w-3" aria-hidden="true" />
                          {request.unread_emails} new
                        </span>
                      ) : null}
                    </span>
                  }
                >
                  <CorrespondencePanel
                    privateHireRequestId={request.id}
                    editable={editable}
                    showBookingLinks={false}
                    counterpartName={request.full_name}
                    onCountChange={setEmailCount}
                  />
                </Section>
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
