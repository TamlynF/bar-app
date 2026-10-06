/* The private hire request pipeline: who can move a request where, which
   stages hold the date, and the deposit deadline rules. Server-free so it can
   be tested on its own. A request runs new -> (awaiting_customer) ->
   awaiting_deposit -> confirmed; declined, cancelled and expired close it and
   staff can reopen it. */

export const PRIVATE_HIRE_STATUSES = [
  "new",
  "awaiting_customer",
  "awaiting_deposit",
  "confirmed",
  "declined",
  "cancelled",
  "expired",
] as const;

export type PrivateHireStatus = (typeof PRIVATE_HIRE_STATUSES)[number];

export const PRIVATE_HIRE_PIPELINE: PrivateHireStatus[] = [
  "new",
  "awaiting_customer",
  "awaiting_deposit",
  "confirmed",
];

export const PRIVATE_HIRE_STATUS_LABEL: Record<PrivateHireStatus, string> = {
  new: "New",
  awaiting_customer: "Awaiting customer",
  awaiting_deposit: "Awaiting deposit",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

/* What the customer reads on their request page. */
export const PRIVATE_HIRE_CUSTOMER_LABEL: Record<PrivateHireStatus, string> = {
  new: "We're reviewing your request",
  awaiting_customer: "We've suggested a different time",
  awaiting_deposit: "Approved - deposit due",
  confirmed: "Confirmed",
  declined: "We can't host this one",
  cancelled: "Cancelled",
  expired: "Deposit deadline passed",
};

const TRANSITIONS: Record<PrivateHireStatus, PrivateHireStatus[]> = {
  new: ["awaiting_customer", "awaiting_deposit", "confirmed", "declined", "cancelled"],
  awaiting_customer: ["awaiting_deposit", "confirmed", "new", "declined", "cancelled"],
  awaiting_deposit: ["confirmed", "awaiting_customer", "cancelled", "expired"],
  confirmed: ["cancelled"],
  declined: ["new"],
  cancelled: ["new"],
  expired: ["awaiting_deposit", "declined"],
};

/* 'pending' is the pre-pipeline name for a new request; old rows still carry it. */
export const LEGACY_NEW_STATUS = "pending";

export function normalizePrivateHireStatus(raw: string | null | undefined): PrivateHireStatus {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === LEGACY_NEW_STATUS) return "new";
  return (PRIVATE_HIRE_STATUSES as readonly string[]).includes(s) ? (s as PrivateHireStatus) : "new";
}

/* The stored values that mean a status, for `.in("status", ...)` filters. */
export function statusValues(...statuses: PrivateHireStatus[]): string[] {
  return statuses.flatMap((s) => (s === "new" ? ["new", LEGACY_NEW_STATUS] : [s]));
}

export function canMovePrivateHire(from: PrivateHireStatus, to: PrivateHireStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextPrivateHireStatuses(from: PrivateHireStatus): PrivateHireStatus[] {
  return TRANSITIONS[from];
}

export const CLOSED_STATUSES: PrivateHireStatus[] = ["declined", "cancelled", "expired"];

export function isClosedPrivateHire(status: PrivateHireStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

/* Stages where the customer can still back out from their request page. */
export function customerCanCancel(status: PrivateHireStatus): boolean {
  return status === "new" || status === "awaiting_customer" || status === "awaiting_deposit";
}

/* A request waiting on its deposit keeps the date for the customer; once paid
   the event itself holds it. */
export function holdsDate(status: PrivateHireStatus): boolean {
  return status === "awaiting_deposit";
}

export const DEFAULT_DEPOSIT_DAYS = 7;
export const DEPOSIT_REMINDER_DAYS = 2;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* The last day to pay, counted from the day the times are agreed. Never later
   than the day before the hire, so an unpaid booking can't reach its date. */
export function depositDueDate(today: string, days: number, hireDate?: string | null): string {
  const due = addDays(today, Math.max(1, Math.round(days || DEFAULT_DEPOSIT_DAYS)));
  if (!hireDate) return due;
  const dayBefore = addDays(hireDate, -1);
  return dayBefore < due ? (dayBefore < today ? today : dayBefore) : due;
}

export function isDepositOverdue(dueDate: string | null | undefined, today: string): boolean {
  return !!dueDate && dueDate < today;
}

export function shouldSendDepositReminder(p: {
  status: PrivateHireStatus;
  dueDate: string | null | undefined;
  remindedAt: string | null | undefined;
  today: string;
}): boolean {
  if (p.status !== "awaiting_deposit" || !p.dueDate || p.remindedAt) return false;
  if (p.dueDate < p.today) return false;
  return p.dueDate <= addDays(p.today, DEPOSIT_REMINDER_DAYS);
}

/* The status the customer actually sees: an unpaid request past its due date
   reads as expired even before the nightly job catches up. */
export function effectivePrivateHireStatus(
  status: PrivateHireStatus,
  dueDate: string | null | undefined,
  today: string
): PrivateHireStatus {
  return status === "awaiting_deposit" && isDepositOverdue(dueDate, today) ? "expired" : status;
}

export function resolveDepositAmount(
  requestAmount: number | null | undefined,
  companyDefault: number | null | undefined
): number {
  const own = Number(requestAmount);
  if (Number.isFinite(own) && own > 0) return Math.round(own * 100) / 100;
  const fallback = Number(companyDefault);
  return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback * 100) / 100 : 0;
}

export const DEPOSIT_PAID_VIA = ["square", "bank_transfer", "cash", "other", "none"] as const;
export type DepositPaidVia = (typeof DEPOSIT_PAID_VIA)[number];

export const DEPOSIT_PAID_VIA_LABEL: Record<DepositPaidVia, string> = {
  square: "Card (online)",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
  none: "No deposit",
};
