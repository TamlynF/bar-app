import { describe, it, expect } from "vitest";
import {
  canMovePrivateHire,
  customerCanCancel,
  depositDueDate,
  depositPaymentStatus,
  dueDateForNewHireDate,
  effectivePrivateHireStatus,
  holdsDate,
  isClosedPrivateHire,
  isDepositOverdue,
  normalizePrivateHireStatus,
  paymentStatusAfterRefund,
  refundableAmount,
  canRefundToCard,
  renewedDepositDue,
  resolveDepositAmount,
  shouldSendDepositReminder,
  statusValues,
} from "@/lib/private-hire-status";
import {
  formatDeposit,
  formatHireDate,
  formatHireTime,
  heldSlotsAsEvents,
  heldSlotsOnDate,
  hireDetailRows,
  supersedeCheckout,
} from "@/lib/private-hire-details";

describe("normalizePrivateHireStatus", () => {
  it("reads the legacy 'pending' as new", () => {
    expect(normalizePrivateHireStatus("pending")).toBe("new");
    expect(normalizePrivateHireStatus(" Pending ")).toBe("new");
  });

  it("keeps every pipeline status and falls back to new for anything else", () => {
    expect(normalizePrivateHireStatus("awaiting_deposit")).toBe("awaiting_deposit");
    expect(normalizePrivateHireStatus("expired")).toBe("expired");
    expect(normalizePrivateHireStatus("")).toBe("new");
    expect(normalizePrivateHireStatus(null)).toBe("new");
    expect(normalizePrivateHireStatus("whatever")).toBe("new");
  });

  it("filters new by both stored names", () => {
    expect(statusValues("new")).toEqual(["new", "pending"]);
    expect(statusValues("awaiting_deposit", "confirmed")).toEqual(["awaiting_deposit", "confirmed"]);
  });
});

describe("canMovePrivateHire", () => {
  it("follows review -> proposal -> deposit -> confirmed", () => {
    expect(canMovePrivateHire("new", "awaiting_customer")).toBe(true);
    expect(canMovePrivateHire("new", "awaiting_deposit")).toBe(true);
    expect(canMovePrivateHire("awaiting_customer", "awaiting_deposit")).toBe(true);
    expect(canMovePrivateHire("awaiting_deposit", "confirmed")).toBe(true);
  });

  it("lets a £0 deposit skip straight to confirmed", () => {
    expect(canMovePrivateHire("new", "confirmed")).toBe(true);
    expect(canMovePrivateHire("awaiting_customer", "confirmed")).toBe(true);
  });

  it("sends a turned-down proposal back to review", () => {
    expect(canMovePrivateHire("awaiting_customer", "new")).toBe(true);
  });

  it("only cancels a confirmed hire", () => {
    expect(canMovePrivateHire("confirmed", "cancelled")).toBe(true);
    expect(canMovePrivateHire("confirmed", "declined")).toBe(false);
    expect(canMovePrivateHire("confirmed", "new")).toBe(false);
  });

  it("never confirms a closed request without reopening it", () => {
    expect(canMovePrivateHire("declined", "confirmed")).toBe(false);
    expect(canMovePrivateHire("cancelled", "awaiting_deposit")).toBe(false);
    expect(canMovePrivateHire("declined", "new")).toBe(true);
    expect(canMovePrivateHire("expired", "awaiting_deposit")).toBe(true);
  });

  it("can't expire anything but an unpaid deposit", () => {
    expect(canMovePrivateHire("awaiting_deposit", "expired")).toBe(true);
    expect(canMovePrivateHire("new", "expired")).toBe(false);
    expect(canMovePrivateHire("confirmed", "expired")).toBe(false);
  });
});

describe("stage rules", () => {
  it("holds the date only while the deposit is due", () => {
    expect(holdsDate("awaiting_deposit")).toBe(true);
    expect(holdsDate("awaiting_customer")).toBe(false);
    expect(holdsDate("confirmed")).toBe(false);
  });

  it("closes declined, cancelled and expired", () => {
    expect(isClosedPrivateHire("declined")).toBe(true);
    expect(isClosedPrivateHire("expired")).toBe(true);
    expect(isClosedPrivateHire("awaiting_deposit")).toBe(false);
  });

  it("lets the customer cancel until the deposit is paid", () => {
    expect(customerCanCancel("new")).toBe(true);
    expect(customerCanCancel("awaiting_deposit")).toBe(true);
    expect(customerCanCancel("confirmed")).toBe(false);
    expect(customerCanCancel("expired")).toBe(false);
  });
});

describe("deposit deadline", () => {
  it("is the set number of days from today", () => {
    expect(depositDueDate("2026-10-07", 7)).toBe("2026-10-14");
    expect(depositDueDate("2026-10-07", 7, "2026-12-01")).toBe("2026-10-14");
  });

  it("is never later than the day before the hire", () => {
    expect(depositDueDate("2026-10-07", 7, "2026-10-10")).toBe("2026-10-09");
  });

  it("is today when the hire is tomorrow or sooner", () => {
    expect(depositDueDate("2026-10-07", 7, "2026-10-08")).toBe("2026-10-07");
    expect(depositDueDate("2026-10-07", 7, "2026-10-07")).toBe("2026-10-07");
  });

  it("treats a missing day count as the default week and anything below a day as one day", () => {
    expect(depositDueDate("2026-10-07", 0)).toBe("2026-10-14");
    expect(depositDueDate("2026-10-07", Number.NaN)).toBe("2026-10-14");
    expect(depositDueDate("2026-10-07", -3)).toBe("2026-10-08");
  });

  it("is overdue the day after it falls due", () => {
    expect(isDepositOverdue("2026-10-14", "2026-10-14")).toBe(false);
    expect(isDepositOverdue("2026-10-14", "2026-10-15")).toBe(true);
    expect(isDepositOverdue(null, "2026-10-15")).toBe(false);
  });

  it("knows how much of a deposit can still be refunded", () => {
    expect(refundableAmount(100, 0)).toBe(100);
    expect(refundableAmount(100, 40)).toBe(60);
    expect(refundableAmount(100, 100)).toBe(0);
    expect(refundableAmount(100, 120)).toBe(0);
    expect(refundableAmount(null, null)).toBe(0);
    expect(refundableAmount(0.3, 0.1)).toBe(0.2);
  });

  it("reads as refunded only once the whole deposit is back", () => {
    expect(paymentStatusAfterRefund("paid", 100, 100)).toBe("refunded");
    expect(paymentStatusAfterRefund("paid", 100, 40)).toBe("paid");
    expect(paymentStatusAfterRefund("partially_paid", 60, 20)).toBe("partially_paid");
    expect(paymentStatusAfterRefund("partially_paid", 60, 60)).toBe("refunded");
    expect(paymentStatusAfterRefund("paid", 100, 0)).toBe("paid");
  });

  it("only refunds to a card when the deposit came through Square", () => {
    expect(canRefundToCard({ paidVia: "square", squarePaymentId: "pay_1" })).toBe(true);
    expect(canRefundToCard({ paidVia: "square", squarePaymentId: null })).toBe(false);
    expect(canRefundToCard({ paidVia: "bank_transfer", squarePaymentId: "pay_1" })).toBe(false);
  });

  it("gives a resent deposit request a fresh deadline only when the old one has passed", () => {
    expect(renewedDepositDue("2026-10-14", "2026-10-15", 7, "2026-11-20")).toBe("2026-10-22");
    expect(renewedDepositDue("2026-10-14", "2026-10-15", 7, "2026-10-18")).toBe("2026-10-17");
    expect(renewedDepositDue("2026-10-14", "2026-10-14", 7, "2026-11-20")).toBeNull();
    expect(renewedDepositDue("2026-10-20", "2026-10-15", 7, "2026-11-20")).toBeNull();
    expect(renewedDepositDue(null, "2026-10-15", 7, "2026-11-20")).toBeNull();
  });

  it("shows an unpaid request past its date as expired before the nightly job runs", () => {
    expect(effectivePrivateHireStatus("awaiting_deposit", "2026-10-14", "2026-10-15")).toBe("expired");
    expect(effectivePrivateHireStatus("awaiting_deposit", "2026-10-14", "2026-10-14")).toBe("awaiting_deposit");
    expect(effectivePrivateHireStatus("confirmed", "2026-10-14", "2026-10-20")).toBe("confirmed");
  });
});

describe("shouldSendDepositReminder", () => {
  const base = { status: "awaiting_deposit" as const, dueDate: "2026-10-14", remindedAt: null };

  it("reminds within two days of the deadline", () => {
    expect(shouldSendDepositReminder({ ...base, today: "2026-10-12" })).toBe(true);
    expect(shouldSendDepositReminder({ ...base, today: "2026-10-14" })).toBe(true);
  });

  it("waits until then", () => {
    expect(shouldSendDepositReminder({ ...base, today: "2026-10-11" })).toBe(false);
  });

  it("reminds once, never after the deadline and never for other stages", () => {
    expect(shouldSendDepositReminder({ ...base, remindedAt: "2026-10-12T07:00:00Z", today: "2026-10-13" })).toBe(false);
    expect(shouldSendDepositReminder({ ...base, today: "2026-10-15" })).toBe(false);
    expect(shouldSendDepositReminder({ ...base, status: "confirmed", today: "2026-10-13" })).toBe(false);
  });
});

describe("resolveDepositAmount", () => {
  it("prefers the request's own amount", () => {
    expect(resolveDepositAmount(150, 100)).toBe(150);
  });

  it("falls back to the company default only when the request has no amount", () => {
    expect(resolveDepositAmount(null, 99.999)).toBe(100);
    expect(resolveDepositAmount(undefined, 100)).toBe(100);
  });

  it("keeps a deposit staff waived to £0", () => {
    expect(resolveDepositAmount(0, 100)).toBe(0);
  });

  it("is zero when neither is set", () => {
    expect(resolveDepositAmount(null, null)).toBe(0);
    expect(resolveDepositAmount(undefined, 0)).toBe(0);
  });
});

describe("private hire details", () => {
  it("formats the date, time and deposit", () => {
    expect(formatHireDate("2026-11-14")).toBe("Sat, 14 Nov 2026");
    expect(formatHireDate(null)).toBe("TBC");
    expect(formatHireTime("19:00:00+00", "23:30:00+00")).toBe("7:00pm - 11:30pm");
    expect(formatHireTime(null, null)).toBe("TBC");
    expect(formatDeposit(100)).toBe("£100.00");
    expect(formatDeposit(null)).toBe("£0.00");
  });

  it("lists the deposit rows only when there is a deposit", () => {
    const rows = hireDetailRows({ date: "2026-11-14", start: "19:00", end: "23:00", guests: 40 });
    expect(rows.map((r) => r.label)).toEqual(["Date", "Time", "Guests"]);
    const withDeposit = hireDetailRows({
      date: "2026-11-14",
      start: "19:00",
      end: "23:00",
      guests: 40,
      reason: "Birthday",
      deposit: 100,
      depositDue: "2026-10-16",
    });
    expect(withDeposit.map((r) => r.label)).toEqual(["Date", "Time", "Guests", "Occasion", "Deposit", "Deposit due"]);
  });

  it("turns held requests into clash candidates that can't collide with event ids", () => {
    const held = [
      { id: "a", full_name: "Jane", selected_date: "2026-11-14", selected_start_time: "19:00", selected_end_time: "23:00" },
      { id: "b", full_name: "Sam", selected_date: "2026-11-15", selected_start_time: "18:00", selected_end_time: "22:00" },
      { id: "c", full_name: "No date", selected_date: null, selected_start_time: null, selected_end_time: null },
    ];
    const events = heldSlotsAsEvents(held);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.id < 0 && e.is_active)).toBe(true);
    expect(events[0].title).toContain("Jane");
    expect(heldSlotsOnDate(held, "2026-11-15")).toHaveLength(1);
  });
});

describe("supersedeCheckout", () => {
  it("clears the checkout and keeps the old order so a late payment still matches", () => {
    expect(supersedeCheckout({ square_order_id: "ORDER_2", superseded_square_order_ids: ["ORDER_1"] })).toEqual({
      payment_link_url: null,
      square_payment_link_id: null,
      square_order_id: null,
      superseded_square_order_ids: ["ORDER_1", "ORDER_2"],
    });
  });

  it("leaves the superseded list alone when there's no order yet or it's already kept", () => {
    expect(supersedeCheckout({ square_order_id: null, superseded_square_order_ids: [] })).toEqual({
      payment_link_url: null,
      square_payment_link_id: null,
      square_order_id: null,
    });
    expect(supersedeCheckout({ square_order_id: "ORDER_1", superseded_square_order_ids: ["ORDER_1"] })).toEqual({
      payment_link_url: null,
      square_payment_link_id: null,
      square_order_id: null,
    });
  });

  it("starts the list when the column is empty", () => {
    expect(supersedeCheckout({ square_order_id: "ORDER_1", superseded_square_order_ids: null })).toMatchObject({
      superseded_square_order_ids: ["ORDER_1"],
    });
  });
});

describe("dueDateForNewHireDate", () => {
  it("keeps the due date when the new hire date is still after it", () => {
    expect(dueDateForNewHireDate("2026-10-16", "2026-11-14", "2026-10-08")).toBe("2026-10-16");
    expect(dueDateForNewHireDate("2026-10-16", "2026-10-17", "2026-10-08")).toBe("2026-10-16");
  });

  it("pulls it back to the day before an earlier hire date, but never into the past", () => {
    expect(dueDateForNewHireDate("2026-10-16", "2026-10-12", "2026-10-08")).toBe("2026-10-11");
    expect(dueDateForNewHireDate("2026-10-16", "2026-10-08", "2026-10-08")).toBe("2026-10-08");
  });

  it("leaves a missing due date or hire date alone", () => {
    expect(dueDateForNewHireDate(null, "2026-10-12", "2026-10-08")).toBeNull();
    expect(dueDateForNewHireDate("2026-10-16", null, "2026-10-08")).toBe("2026-10-16");
  });
});

describe("depositPaymentStatus", () => {
  it("is paid when the whole deposit (or more) came in", () => {
    expect(depositPaymentStatus(500, 500)).toBe("paid");
    expect(depositPaymentStatus(600, 500)).toBe("paid");
  });

  it("is part paid when less than the deposit came in", () => {
    expect(depositPaymentStatus(200, 500)).toBe("partially_paid");
  });

  it("is unpaid when nothing came in", () => {
    expect(depositPaymentStatus(0, 500)).toBe("unpaid");
    expect(depositPaymentStatus(0, 0)).toBe("unpaid");
  });

  it("counts any payment as paid when no deposit amount was set", () => {
    expect(depositPaymentStatus(100, null)).toBe("paid");
  });
});
