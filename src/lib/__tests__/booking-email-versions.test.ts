import { describe, it, expect } from "vitest";
import {
  BOOKING_EMAILS,
  STANDARD_CHOICE,
  bookingEmailSlot,
  isVersionable,
  normalizeVersionName,
  parseBookingEmails,
  resolveBookingEmailChoice,
  sanitizeBookingEmailChoices,
  withoutVersion,
} from "@/lib/email/booking-email-versions";
import { emailLevelsFromEvent, versionFor } from "@/lib/email/booking-email-choice";
import { findScenario } from "@/lib/email/scenarios";

describe("BOOKING_EMAILS", () => {
  it("only lists customer booking emails that exist", () => {
    for (const email of BOOKING_EMAILS) {
      const scenario = findScenario(email.key);
      expect(scenario, email.key).toBeDefined();
      expect(scenario?.recipient).toBe("customer");
    }
  });

  it("maps scenario keys to slots and back", () => {
    expect(bookingEmailSlot("booking.event.confirmed")).toBe("confirmed");
    expect(bookingEmailSlot("booking.cancelled.by_admin")).toBe("cancelled_by_admin");
    expect(bookingEmailSlot("admin.booking.new")).toBeNull();
    expect(isVersionable("booking.payment_pending")).toBe(true);
    expect(isVersionable("band.offered")).toBe(false);
  });
});

describe("sanitizeBookingEmailChoices", () => {
  it("keeps known slots with whole, non-negative ids", () => {
    expect(
      sanitizeBookingEmailChoices({ confirmed: 12, waitlisted: "7", payment_pending: 0, bogus: 3, changed_by_admin: -1, cancelled_by_admin: 1.5 })
    ).toEqual({ confirmed: 12, waitlisted: 7, payment_pending: 0 });
  });

  it("treats anything that isn't an object as no choices", () => {
    expect(sanitizeBookingEmailChoices(null)).toEqual({});
    expect(sanitizeBookingEmailChoices("x")).toEqual({});
    expect(sanitizeBookingEmailChoices([1, 2])).toEqual({});
  });
});

describe("parseBookingEmails", () => {
  it("stores null when nothing is chosen, so the column means inherit", () => {
    expect(parseBookingEmails("{}")).toBeNull();
    expect(parseBookingEmails(undefined)).toBeNull();
    expect(parseBookingEmails("not json")).toBeNull();
    expect(parseBookingEmails('{"confirmed":4}')).toEqual({ confirmed: 4 });
  });
});

describe("resolveBookingEmailChoice", () => {
  const type = { confirmed: 1, waitlisted: 1, payment_pending: 1 };
  const subtype = { confirmed: 2, waitlisted: 2 };
  const event = { confirmed: 3 };

  it("prefers the event, then the sub-type, then the type - per email", () => {
    const levels = { event, subtype, type };
    expect(resolveBookingEmailChoice("confirmed", levels)).toEqual({ versionId: 3, source: "event" });
    expect(resolveBookingEmailChoice("waitlisted", levels)).toEqual({ versionId: 2, source: "subtype" });
    expect(resolveBookingEmailChoice("payment_pending", levels)).toEqual({ versionId: 1, source: "type" });
    expect(resolveBookingEmailChoice("changed_by_customer", levels)).toBeNull();
  });

  it("lets a narrower level insist on the standard email", () => {
    const levels = { event: { confirmed: STANDARD_CHOICE }, subtype };
    expect(resolveBookingEmailChoice("confirmed", levels)).toEqual({ versionId: 0, source: "event" });
    expect(versionFor("booking.event.confirmed", levels)).toBeNull();
  });

  it("returns the version id for a send, and null for standard or unversioned emails", () => {
    expect(versionFor("booking.event.waitlisted", { subtype })).toBe(2);
    expect(versionFor("booking.event.confirmed", {})).toBeNull();
    expect(versionFor("admin.booking.new", { type })).toBeNull();
  });
});

describe("emailLevelsFromEvent", () => {
  it("reads the choices whether the joins come back as objects or arrays", () => {
    expect(
      emailLevelsFromEvent({
        booking_emails: { confirmed: 3 },
        event_subtypes: [{ booking_emails: { confirmed: 2 } }],
        event_types: { booking_emails: { confirmed: 1 } },
      })
    ).toEqual({ event: { confirmed: 3 }, subtype: { confirmed: 2 }, type: { confirmed: 1 } });
    expect(emailLevelsFromEvent(null)).toEqual({ event: undefined, subtype: undefined, type: undefined });
  });
});

describe("withoutVersion", () => {
  it("drops every slot that picked the deleted version and nulls an empty map", () => {
    expect(withoutVersion({ confirmed: 5, waitlisted: 5, payment_pending: 6 }, 5)).toEqual({ payment_pending: 6 });
    expect(withoutVersion({ confirmed: 5 }, 5)).toBeNull();
  });
});

describe("normalizeVersionName", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(normalizeVersionName("  Quiz   Night ")).toBe("Quiz Night");
    expect(normalizeVersionName("x".repeat(80))).toHaveLength(60);
  });
});
