import { describe, expect, it } from "vitest";
import { summariseSaleLines, type SaleLineRow } from "../sales-history";

function line(overrides: Partial<SaleLineRow>): SaleLineRow {
  return { square_order_id: "O1", quantity: 1, trading_night: "2026-09-24", modifiers: [], ...overrides };
}

describe("summariseSaleLines", () => {
  const history = summariseSaleLines([
    line({ square_order_id: "A", trading_night: "2026-09-24", quantity: 2, modifiers: [{ name: "Tonic", quantity: 1 }] }),
    line({ square_order_id: "A", trading_night: "2026-09-24", quantity: "1", modifiers: [{ name: "Coke", quantity: "1" }] }),
    line({ square_order_id: "B", trading_night: "2026-09-24", quantity: 1, modifiers: [{ name: "Tonic", quantity: 1 }] }),
    line({ square_order_id: "C", trading_night: "2026-09-17", quantity: 3 }),
    line({ square_order_id: "D", trading_night: "2026-09-26", quantity: 1 }),
  ]);

  it("totals nights, distinct orders and units", () => {
    expect(history).toMatchObject({ nights: 3, orders: 4, quantity: 8, hasModifiers: true });
  });

  it("groups by weekday, Monday first", () => {
    expect(history.byWeekday.map((day) => [day.weekday, day.nights, day.orders, day.quantity])).toEqual([
      [4, 2, 3, 7],
      [6, 1, 1, 1],
    ]);
  });

  it("lists a weekday's nights latest first with modifiers counted per unit", () => {
    expect(history.byWeekday[0].byNight).toEqual([
      {
        night: "2026-09-24",
        orders: 2,
        quantity: 4,
        modifiers: [
          { name: "Tonic", quantity: 3 },
          { name: "Coke", quantity: 1 },
        ],
      },
      { night: "2026-09-17", orders: 1, quantity: 3, modifiers: [] },
    ]);
  });

  it("is empty with no lines", () => {
    expect(summariseSaleLines([])).toEqual({ nights: 0, orders: 0, quantity: 0, hasModifiers: false, byWeekday: [] });
  });
});
