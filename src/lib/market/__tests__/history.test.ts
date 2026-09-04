import { describe, expect, it } from "vitest";
import {
  buildHistoryEntries,
  eventEntryKind,
  marketEventEntries,
  priceChangeEntries,
} from "../history";

const instruments = [
  { id: 1, display_name: "Amaretto", serve: "single" },
  { id: 2, display_name: "Aperol Spritz", serve: "each" },
];

describe("priceChangeEntries", () => {
  it("emits one entry per tick where the price moved", () => {
    const entries = priceChangeEntries(instruments, [
      { instrument_id: 1, tick_no: 0, price: "4.00", created_at: "2026-09-03T20:00:00Z" },
      { instrument_id: 1, tick_no: 1, price: "4.00", created_at: "2026-09-03T20:01:00Z" },
      { instrument_id: 1, tick_no: 2, price: "3.80", created_at: "2026-09-03T20:02:00Z" },
      { instrument_id: 2, tick_no: 0, price: "8.95", created_at: "2026-09-03T20:00:00Z" },
      { instrument_id: 2, tick_no: 1, price: "9.40", created_at: "2026-09-03T20:01:00Z" },
    ]);
    expect(entries).toHaveLength(2);
    const amaretto = entries.find((entry) => entry.drink === "Amaretto");
    expect(amaretto).toMatchObject({ from: 4, to: 3.8, pct: -5, tickNo: 2, kind: "price" });
    expect(amaretto?.copy).toBe("£4.00 → £3.80 (-5.0%)");
    const spritz = entries.find((entry) => entry.drink === "Aperol Spritz");
    expect(spritz?.copy).toBe("£8.95 → £9.40 (+5.0%)");
  });

  it("does not compare across instruments", () => {
    const entries = priceChangeEntries(instruments, [
      { instrument_id: 1, tick_no: 0, price: "4.00", created_at: "2026-09-03T20:00:00Z" },
      { instrument_id: 2, tick_no: 0, price: "8.95", created_at: "2026-09-03T20:00:00Z" },
    ]);
    expect(entries).toHaveLength(0);
  });
});

describe("marketEventEntries", () => {
  it("classifies stock, alert and crash events with readable copy", () => {
    const entries = marketEventEntries(instruments, [
      {
        id: 10,
        instrument_id: 1,
        kind: "low_stock",
        payload: { name: "Amaretto", serve: "single" },
        created_at: "2026-09-03T20:05:00Z",
      },
      {
        id: 11,
        instrument_id: 2,
        kind: "surge",
        payload: { name: "Aperol Spritz", serve: "each", from: 8.95, to: 9.4, pct: 5 },
        created_at: "2026-09-03T20:06:00Z",
      },
      { id: 12, instrument_id: null, kind: "crash", payload: {}, created_at: "2026-09-03T20:07:00Z" },
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual(["stock", "alert", "crash"]);
    expect(entries[0].copy).toBe("Running low");
    expect(entries[1].copy).toBe("Surge alert £8.95 → £9.40 (+5.0%)");
    expect(entries[2].drink).toBeNull();
  });

  it("falls back to the instrument name when the payload has none", () => {
    const [entry] = marketEventEntries(instruments, [
      { id: 1, instrument_id: 2, kind: "restock", payload: {}, created_at: "2026-09-03T20:05:00Z" },
    ]);
    expect(entry.drink).toBe("Aperol Spritz");
  });
});

describe("buildHistoryEntries", () => {
  it("merges and sorts newest first", () => {
    const entries = buildHistoryEntries(
      instruments,
      [
        { instrument_id: 1, tick_no: 0, price: "4.00", created_at: "2026-09-03T20:00:00Z" },
        { instrument_id: 1, tick_no: 1, price: "3.90", created_at: "2026-09-03T20:01:00Z" },
      ],
      [{ id: 5, instrument_id: null, kind: "crash", payload: {}, created_at: "2026-09-03T20:03:00Z" }]
    );
    expect(entries.map((entry) => entry.kind)).toEqual(["crash", "price"]);
  });
});

describe("eventEntryKind", () => {
  it("maps unknown kinds to alert", () => {
    expect(eventEntryKind("something_new")).toBe("alert");
  });
});
