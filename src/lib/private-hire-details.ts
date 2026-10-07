import { format } from "date-fns";
import { toHHMM, type ClashEventInput } from "@/lib/event-clash";
import { formatTime } from "@/lib/events-display";
import type { EventClashCandidate } from "@/lib/event-form-validation";

/* How a private hire request reads in emails, on the customer's request page
   and in the clash checks. Server-free so it can be tested on its own. */

export function formatHireDate(date: string | null | undefined): string {
  if (!date) return "TBC";
  return format(new Date(`${date}T00:00:00`), "EEE, d MMM yyyy");
}

export function formatHireTime(start: string | null | undefined, end: string | null | undefined): string {
  const from = formatTime(toHHMM(start) || null);
  const to = formatTime(toHHMM(end) || null);
  if (from && to) return `${from} - ${to}`;
  return from ?? to ?? "TBC";
}

export function formatDeposit(amount: number | null | undefined): string {
  return `£${(Number(amount) || 0).toFixed(2)}`;
}

export type HireDetailRow = { label: string; value: string };

export function hireDetailRows(p: {
  date: string | null;
  start: string | null;
  end: string | null;
  guests: number | null;
  reason?: string | null;
  deposit?: number | null;
  depositDue?: string | null;
}): HireDetailRow[] {
  const rows: HireDetailRow[] = [
    { label: "Date", value: formatHireDate(p.date) },
    { label: "Time", value: formatHireTime(p.start, p.end) },
    { label: "Guests", value: p.guests != null ? String(p.guests) : "TBC" },
  ];
  if (p.reason) rows.push({ label: "Occasion", value: p.reason.charAt(0).toUpperCase() + p.reason.slice(1) });
  if (p.deposit != null && p.deposit > 0) rows.push({ label: "Deposit", value: formatDeposit(p.deposit) });
  if (p.depositDue) rows.push({ label: "Deposit due", value: formatHireDate(p.depositDue) });
  return rows;
}

/* Drops the customer's checkout so the next "Pay deposit" makes a fresh one,
   keeping the old order so a payment made on it can still be matched. */
export function supersedeCheckout(
  row: { square_order_id: string | null; superseded_square_order_ids: string[] | null }
): Record<string, unknown> {
  const kept = row.superseded_square_order_ids ?? [];
  return {
    payment_link_url: null,
    square_payment_link_id: null,
    square_order_id: null,
    ...(row.square_order_id && !kept.includes(row.square_order_id)
      ? { superseded_square_order_ids: [...kept, row.square_order_id] }
      : {}),
  };
}

export type HeldHireSlot = {
  id: string;
  full_name: string;
  selected_date: string | null;
  selected_start_time: string | null;
  selected_end_time: string | null;
};

/* Requests waiting on their deposit, shaped like events for the clash checks.
   They have no event id yet, so each gets a negative one that can't collide
   with a real event. */
export function heldSlotsAsEvents(slots: HeldHireSlot[]): EventClashCandidate[] {
  return slots
    .filter((s) => s.selected_date)
    .map((s, i) => ({
      id: -(i + 1),
      title: `Private hire (deposit due) - ${s.full_name}`,
      date: s.selected_date,
      start_time: s.selected_start_time,
      end_time: s.selected_end_time,
      is_active: true,
    }));
}

export function heldSlotsOnDate(slots: HeldHireSlot[], date: string): ClashEventInput[] {
  return heldSlotsAsEvents(slots.filter((s) => s.selected_date === date));
}
