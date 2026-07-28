import { describe, it, expect } from "vitest";
import { adminBookingsHref, checkoutReturnPath, publicBookingUrl } from "@/lib/booking-links";

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
  const base = {
    siteUrl: "https://df.test",
    eventTypesId: 1,
    eventSubtypesId: 2,
    eventId: 5,
  };

  it("returns null when the event is not bookable", () => {
    expect(
      publicBookingUrl({ ...base, grouping: "per_event", isBookable: false, manualUrl: null })
    ).toBeNull();
  });

  it("returns null when not bookable even if a manual url is set", () => {
    expect(
      publicBookingUrl({ ...base, grouping: "per_event", isBookable: false, manualUrl: "https://x" })
    ).toBeNull();
  });

  it("lets a manual override win over the computed url when bookable", () => {
    expect(
      publicBookingUrl({ ...base, grouping: "per_type", isBookable: true, manualUrl: "https://override.test/x" })
    ).toBe("https://override.test/x");
  });

  it("builds the per_type grouped page keyed to the event id", () => {
    expect(
      publicBookingUrl({ ...base, grouping: "per_type", isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/group/type/1?id=5");
  });

  it("builds the per_subtype grouped page keyed to the event id", () => {
    expect(
      publicBookingUrl({ ...base, grouping: "per_subtype", isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/group/subtype/2?id=5");
  });

  it("falls back to the per-event page for per_subtype with no subtype", () => {
    expect(
      publicBookingUrl({ ...base, grouping: "per_subtype", isBookable: true, manualUrl: null, eventSubtypesId: null })
    ).toBe("https://df.test/book/event/5");
  });

  it("builds the per-event page for per_event and for an unknown/null grouping", () => {
    expect(
      publicBookingUrl({ ...base, grouping: "per_event", isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/event/5");
    expect(
      publicBookingUrl({ ...base, grouping: null, isBookable: true, manualUrl: null })
    ).toBe("https://df.test/book/event/5");
  });
});

describe("checkoutReturnPath", () => {
  it("sends bingo bookings back to the shared bingo success page", () => {
    expect(checkoutReturnPath({ behavior: "bingo", eventId: 7, bookingId: 42 })).toBe(
      "/book/bingo/success?bookingId=42"
    );
  });

  it("sends every other behavior back to the per-event success page", () => {
    for (const behavior of ["standard", "quiz", "karaoke", "music_act", "private"] as const) {
      expect(checkoutReturnPath({ behavior, eventId: 7, bookingId: 42 })).toBe(
        "/book/event/7/success?bookingId=42"
      );
    }
  });

  it("falls back to the per-event page when the behavior is unknown", () => {
    expect(checkoutReturnPath({ behavior: null, eventId: 7, bookingId: 42 })).toBe(
      "/book/event/7/success?bookingId=42"
    );
  });
});
