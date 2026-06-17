import { describe, it, expect } from "vitest";
import { planPrivateEventSync } from "@/lib/private-event-sync";

describe("planPrivateEventSync", () => {
  describe("confirming", () => {
    it("inserts a new event when confirmed with a date and no linked event", () => {
      expect(planPrivateEventSync({ status: "confirmed", selectedDate: "2026-07-01", eventId: null }))
        .toEqual({ action: "insert" });
    });

    it("updates the existing event when confirmed with a date and a linked event (no duplicate)", () => {
      expect(planPrivateEventSync({ status: "confirmed", selectedDate: "2026-07-01", eventId: 42 }))
        .toEqual({ action: "update", eventId: 42 });
    });

    it("does nothing when confirmed without a selected date", () => {
      expect(planPrivateEventSync({ status: "confirmed", selectedDate: null, eventId: null }))
        .toEqual({ action: "none" });
      expect(planPrivateEventSync({ status: "confirmed", selectedDate: null, eventId: 42 }))
        .toEqual({ action: "none" });
    });
  });

  describe("rejecting", () => {
    it("deactivates the linked event when rejected", () => {
      expect(planPrivateEventSync({ status: "rejected", selectedDate: "2026-07-01", eventId: 42 }))
        .toEqual({ action: "deactivate", eventId: 42 });
    });

    it("does nothing when rejected with no linked event", () => {
      expect(planPrivateEventSync({ status: "rejected", selectedDate: "2026-07-01", eventId: null }))
        .toEqual({ action: "none" });
    });
  });
});
