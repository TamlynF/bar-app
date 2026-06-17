import { describe, it, expect } from "vitest";
import { planBandEventSync } from "@/lib/band-event-sync";

describe("planBandEventSync", () => {
  describe("confirming", () => {
    it("inserts a new event when confirmed with a date and no linked event", () => {
      expect(planBandEventSync({ status: "confirmed", selectedDate: "2026-07-01", eventId: null }))
        .toEqual({ action: "insert" });
    });

    it("updates the existing event when confirmed with a date and a linked event (no duplicate)", () => {
      expect(planBandEventSync({ status: "confirmed", selectedDate: "2026-07-01", eventId: 42 }))
        .toEqual({ action: "update", eventId: 42 });
    });

    it("does nothing when confirmed without a selected date", () => {
      expect(planBandEventSync({ status: "confirmed", selectedDate: null, eventId: null }))
        .toEqual({ action: "none" });
      // even if an event is somehow linked, a dateless confirm must not touch it
      expect(planBandEventSync({ status: "confirmed", selectedDate: null, eventId: 42 }))
        .toEqual({ action: "none" });
    });
  });

  describe("non-confirmed statuses deactivate the linked event", () => {
    it.each(["pending", "cancelled"] as const)(
      "%s + a linked event → deactivate (is_active = false)",
      (status) => {
        expect(planBandEventSync({ status, selectedDate: "2026-07-01", eventId: 42 }))
          .toEqual({ action: "deactivate", eventId: 42 });
      }
    );

    it.each(["pending", "cancelled"] as const)(
      "%s with no linked event → none",
      (status) => {
        expect(planBandEventSync({ status, selectedDate: "2026-07-01", eventId: null }))
          .toEqual({ action: "none" });
      }
    );
  });
});
