import { describe, expect, it } from "vitest";
import { orderToLineRows } from "../square-sync";

describe("orderToLineRows", () => {
  it("emits one row per line with the uid, quantity and trading night", () => {
    const rows = orderToLineRows({
      id: "ORD1",
      closedAt: "2026-09-19T22:50:00Z",
      lineItems: [
        { uid: "a", catalogObjectId: "V1", quantity: "2" },
        { uid: "b", catalogObjectId: "V2", quantity: 1 },
      ],
    });
    expect(rows).toEqual([
      { square_order_id: "ORD1", line_uid: "a", variation_id: "V1", quantity: 2, closed_at: "2026-09-19T22:50:00Z", trading_night: "2026-09-19" },
      { square_order_id: "ORD1", line_uid: "b", variation_id: "V2", quantity: 1, closed_at: "2026-09-19T22:50:00Z", trading_night: "2026-09-19" },
    ]);
  });

  it("puts a sale rung after midnight on the night before", () => {
    const [row] = orderToLineRows({
      id: "ORD2",
      closedAt: "2026-09-20T00:45:00Z",
      lineItems: [{ uid: "a", catalogObjectId: "V1", quantity: "1" }],
    });
    expect(row.trading_night).toBe("2026-09-19");
  });

  it("falls back to the line index when Square gives no uid, and skips empty lines", () => {
    const rows = orderToLineRows({
      id: "ORD3",
      createdAt: "2026-09-19T20:00:00Z",
      lineItems: [
        { catalogObjectId: "V1", quantity: "3" },
        { uid: "z", catalogObjectId: "V2", quantity: "0" },
        { uid: "y", catalogObjectId: null, quantity: "1" },
      ],
    });
    expect(rows.map((r) => [r.line_uid, r.variation_id, r.quantity])).toEqual([
      ["1", "V1", 3],
      ["y", null, 1],
    ]);
  });

  it("returns nothing for an order without an id", () => {
    expect(orderToLineRows({ lineItems: [{ uid: "a", catalogObjectId: "V1" }] })).toEqual([]);
  });
});
