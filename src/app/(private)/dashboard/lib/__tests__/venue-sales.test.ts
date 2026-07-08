import { describe, it, expect } from "vitest";
import {
  sumSales,
  categoryTotals,
  dailyTakings,
  takingsByEvent,
  type VenueSaleRow,
} from "@/app/(private)/dashboard/lib/venue-sales";
import { bucketForCategory, orderToSaleRow } from "@/lib/square-sync";

function row(over: Partial<VenueSaleRow>): VenueSaleRow {
  return {
    business_date: "2026-07-04",
    net_sales: 0,
    gross_sales: 0,
    tips: 0,
    fees: 0,
    refunds: 0,
    total_collected: 0,
    category_breakdown: { drinks: 0, food: 0, tickets: 0, other: 0 },
    ...over,
  };
}

describe("bucketForCategory", () => {
  it("classifies drinks by keyword", () => {
    expect(bucketForCategory("Draught Beer")).toBe("drinks");
    expect(bucketForCategory("House Wine")).toBe("drinks");
    expect(bucketForCategory("Cocktails")).toBe("drinks");
  });
  it("classifies food", () => {
    expect(bucketForCategory("Kitchen")).toBe("food");
    expect(bucketForCategory("Burgers")).toBe("food");
  });
  it("classifies tickets/entry", () => {
    expect(bucketForCategory("Bingo Ticket")).toBe("tickets");
    expect(bucketForCategory("Door Entry")).toBe("tickets");
  });
  it("falls through to other", () => {
    expect(bucketForCategory("Merchandise")).toBe("other");
    expect(bucketForCategory("")).toBe("other");
    expect(bucketForCategory(null)).toBe("other");
  });
});

describe("sumSales", () => {
  it("sums each money column and rounds", () => {
    const t = sumSales([
      row({ net_sales: 100.1, tips: 5, fees: 2.5, refunds: 0, total_collected: 105.1, gross_sales: 110 }),
      row({ net_sales: 50.2, tips: 3, fees: 1.25, refunds: 10, total_collected: 43.2, gross_sales: 60 }),
    ]);
    expect(t.takings).toBe(150.3);
    expect(t.tips).toBe(8);
    expect(t.fees).toBe(3.75);
    expect(t.refunds).toBe(10);
    expect(t.collected).toBe(148.3);
    expect(t.gross).toBe(170);
  });
  it("handles nulls", () => {
    const t = sumSales([row({ net_sales: null, tips: null })]);
    expect(t.takings).toBe(0);
    expect(t.tips).toBe(0);
  });
});

describe("categoryTotals", () => {
  it("aggregates, drops zero buckets, sorts desc", () => {
    const res = categoryTotals([
      row({ category_breakdown: { drinks: 200, food: 50, tickets: 0, other: 0 } }),
      row({ category_breakdown: { drinks: 100, food: 20, tickets: 30, other: 0 } }),
    ]);
    expect(res).toEqual([
      { category: "Drinks", revenue: 300 },
      { category: "Food", revenue: 70 },
      { category: "Tickets", revenue: 30 },
    ]);
  });
});

describe("dailyTakings", () => {
  it("zero-fills the trailing window and buckets by date", () => {
    const now = new Date("2026-07-04T12:00:00Z");
    const pts = dailyTakings(
      [row({ business_date: "2026-07-04", net_sales: 120 }), row({ business_date: "2026-07-02", net_sales: 40 })],
      3,
      now
    );
    expect(pts.map((p) => p.date)).toEqual(["2026-07-02", "2026-07-03", "2026-07-04"]);
    expect(pts.map((p) => p.takings)).toEqual([40, 0, 120]);
  });
});

describe("takingsByEvent", () => {
  it("matches takings to event nights by date, drops empty, newest first", () => {
    const rows = [
      row({ business_date: "2026-07-03", net_sales: 640, tips: 95 }),
      row({ business_date: "2026-07-01", net_sales: 200, tips: 10 }),
    ];
    const res = takingsByEvent(rows, [
      { date: "2026-07-03", title: "Quiz Night" },
      { date: "2026-07-01", title: "Bingo" },
      { date: "2026-07-02", title: "No Sales Night" },
    ]);
    expect(res).toEqual([
      { date: "2026-07-03", title: "Quiz Night", takings: 640, tips: 95 },
      { date: "2026-07-01", title: "Bingo", takings: 200, tips: 10 },
    ]);
  });
});

describe("orderToSaleRow", () => {
  it("flattens a Square order, buckets line items via catalog, applies fees/refunds", () => {
    const variationCategory = new Map([["var-beer", "Draught Beer"], ["var-burger", "Kitchen"]]);
    const fees = new Map([["order-1", 1.35]]);
    const refunds = new Map([["order-1", 5]]);
    const order = {
      id: "order-1",
      locationId: "L1",
      createdAt: "2026-07-04T21:30:00Z",
      closedAt: "2026-07-04T22:00:00Z",
      state: "COMPLETED",
      lineItems: [
        { name: "IPA", catalogObjectId: "var-beer", grossSalesMoney: { amount: 500n } },
        { name: "Cheeseburger", catalogObjectId: "var-burger", grossSalesMoney: { amount: 900n } },
        { name: "Custom item", grossSalesMoney: { amount: 100n } },
      ],
      netAmounts: { totalMoney: { amount: 1500n }, tipMoney: { amount: 200n }, discountMoney: { amount: 0n } },
    };
    const r = orderToSaleRow(order, variationCategory, fees, refunds);
    expect(r).not.toBeNull();
    expect(r!.business_date).toBe("2026-07-04");
    expect(r!.gross_sales).toBe(15);
    expect(r!.net_sales).toBe(15);
    expect(r!.tips).toBe(2);
    expect(r!.fees).toBe(1.35);
    expect(r!.refunds).toBe(5);
    expect(r!.total_collected).toBe(12); // 15 + 2 - 5
    expect(r!.category_breakdown).toEqual({ drinks: 5, food: 9, tickets: 0, other: 1 });
  });

  it("returns null without an order id", () => {
    expect(orderToSaleRow({}, new Map(), new Map(), new Map())).toBeNull();
  });
});
