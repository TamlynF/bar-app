import { describe, it, expect } from "vitest";
import { planBandEventSync } from "@/lib/band-event-sync";

describe("planBandEventSync", () => {
  describe("booking", () => {
    it("inserts a new event when booked with a date and no linked event", () => {
      expect(planBandEventSync({ status: "booked", selectedDate: "2026-07-01", eventId: null }))
        .toEqual({ action: "insert" });
    });

    it("updates the existing event when booked with a date and a linked event (no duplicate)", () => {
      expect(planBandEventSync({ status: "booked", selectedDate: "2026-07-01", eventId: 42 }))
        .toEqual({ action: "update", eventId: 42 });
    });

    it("does nothing when booked without a selected date", () => {
      expect(planBandEventSync({ status: "booked", selectedDate: null, eventId: null }))
        .toEqual({ action: "none" });
      expect(planBandEventSync({ status: "booked", selectedDate: null, eventId: 42 }))
        .toEqual({ action: "none" });
    });
  });

  describe("non-booked statuses deactivate the linked event", () => {
    it.each(["new", "reviewing", "offered", "declined"] as const)(
      "%s + a linked event → deactivate (is_active = false)",
      (status) => {
        expect(planBandEventSync({ status, selectedDate: "2026-07-01", eventId: 42 }))
          .toEqual({ action: "deactivate", eventId: 42 });
      }
    );

    it.each(["new", "reviewing", "offered", "declined"] as const)(
      "%s with no linked event → none",
      (status) => {
        expect(planBandEventSync({ status, selectedDate: "2026-07-01", eventId: null }))
          .toEqual({ action: "none" });
      }
    );
  });
});
