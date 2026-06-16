import { describe, it, expect } from "vitest";
import { adminBookingsHref, publicBookingUrl } from "@/lib/booking-links";

describe("adminBookingsHref", () => {
  it("routes each specialised behavior to its dedicated admin screen", () => {
    expect(adminBookingsHref("bingo")).toBe("/event-bookings/bingo-bookings");
    expect(adminBookingsHref("quiz")).toBe("/event-bookings/quiz-bookings");
    expect(adminBookingsHref("music_act")).toBe("/event-bookings/music-bookings");
    expect(adminBookingsHref("private")).toBe("/event-bookings/private-bookings");
  });

  it("falls back to the per-event page for generic behaviors when an id is known", () => {
    expect(adminBookingsHref("standard", 42)).toBe("/event-bookings/event/42");
    expect(adminBookingsHref("karaoke", 7)).toBe("/event-bookings/event/7");
  });

  it("falls back to the hub for generic behaviors with no id", () => {
    expect(adminBookingsHref("standard")).toBe("/event-bookings");
    expect(adminBookingsHref("karaoke")).toBe("/event-bookings");
  });

  it("ignores the id for specialised behaviors (dedicated screen wins)", () => {
    expect(adminBookingsHref("quiz", 99)).toBe("/event-bookings/quiz-bookings");
  });
});

describe("publicBookingUrl", () => {
  const base = { siteUrl: "https://df.test", date: "2026-06-23", eventId: 5 };

  it("returns null when the event is not bookable", () => {
    expect(
      publicBookingUrl({ ...base, behavior: "quiz", isBookable: false, manualUrl: null })
    ).toBeNull();
  });

  it("returns null when not bookable even if a manual url is set", () => {
    expect(
      publicBookingUrl({ ...base, behavior: "standard", isBookable: false, manualUrl: "https://x" })
    ).toBeNull();
  });

  it("lets a manual override win over the computed url when bookable", () => {
    expect(
      publicBookingUrl({ ...base, behavior: "quiz", isBookable: true, manualUrl: "https://override.test/x" })
    ).toBe("https://override.test/x");
  });

  it("builds the date-keyed quiz and bingo pages", () => {
    expect(
      publicBookingUrl({ ...base, behavior: "quiz", isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/quiz?date=2026-06-23");
    expect(
      publicBookingUrl({ ...base, behavior: "bingo", isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/bingo?date=2026-06-23");
  });

  it("builds the generic per-event page for other / unknown behaviors", () => {
    expect(
      publicBookingUrl({ ...base, behavior: "standard", isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/event/5");
    expect(
      publicBookingUrl({ ...base, behavior: "music_act", isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/event/5");
    // a null/undefined behavior (e.g. subtype lookup miss) still resolves sanely
    expect(
      publicBookingUrl({ ...base, behavior: null, isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/event/5");
  });
});
