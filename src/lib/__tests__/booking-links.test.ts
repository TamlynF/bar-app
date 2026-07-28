import { describe, it, expect } from "vitest";
import { adminBookingsHref, checkoutReturnPath, manageBookingPath, publicBookingUrl } from "@/lib/booking-links";

describe("adminBookingsHref — grouping-driven routing", () => {
  const base = {
    behavior: "standard" as const,
    eventType: "Live Music",
    eventSubtype: "Acoustic",
    eventId: 7,
    bookingId: 42,
  };

  it("per_event deep-links to the single-event page with the booking selected", () => {
    expect(adminBookingsHref({ ...base, bookingGrouping: "per_event" })).toBe(
      "/event-bookings/event/7?bookingId=42"
    );
  });

  it("per_subtype deep-links to the sub-type list scoped to the event", () => {
    expect(adminBookingsHref({ ...base, bookingGrouping: "per_subtype" })).toBe(
      "/event-bookings/general/Live%20Music/Acoustic?eventId=7&bookingId=42"
    );
  });

  it("per_type deep-links to the all-subtypes list scoped to the event", () => {
    expect(adminBookingsHref({ ...base, bookingGrouping: "per_type" })).toBe(
      "/event-bookings/general/Live%20Music/__all__?eventId=7&bookingId=42"
    );
  });

  it("falls back to all-subtypes when per_subtype has no sub-type name", () => {
    expect(adminBookingsHref({ ...base, bookingGrouping: "per_subtype", eventSubtype: null })).toBe(
      "/event-bookings/general/Live%20Music/__all__?eventId=7&bookingId=42"
    );
  });

  it("omits the bookingId when there is none", () => {
    expect(adminBookingsHref({ ...base, bookingGrouping: "per_event", bookingId: null })).toBe(
      "/event-bookings/event/7"
    );
    expect(adminBookingsHref({ ...base, bookingGrouping: "per_type", bookingId: null })).toBe(
      "/event-bookings/general/Live%20Music/__all__?eventId=7"
    );
  });

  it("encodes names that contain url-unsafe characters", () => {
    expect(
      adminBookingsHref({
        ...base,
        bookingGrouping: "per_subtype",
        eventType: "Food & Drink",
        eventSubtype: "Wine / Cheese",
      })
    ).toBe("/event-bookings/general/Food%20%26%20Drink/Wine%20%2F%20Cheese?eventId=7&bookingId=42");
  });

  it("routes on grouping regardless of behavior", () => {
    expect(adminBookingsHref({ ...base, behavior: "quiz", bookingGrouping: "per_event" })).toBe(
      "/event-bookings/event/7?bookingId=42"
    );
    expect(adminBookingsHref({ ...base, behavior: "bingo", bookingGrouping: "per_type" })).toBe(
      "/event-bookings/general/Live%20Music/__all__?eventId=7&bookingId=42"
    );
  });
});

describe("adminBookingsHref — fallbacks when grouping is unknown", () => {
  it("falls back to the per-event page when an id is known", () => {
    expect(adminBookingsHref({ behavior: "standard", eventId: 42 })).toBe("/event-bookings/event/42");
    expect(adminBookingsHref({ behavior: "karaoke", eventId: 7, bookingId: 3 })).toBe(
      "/event-bookings/event/7?bookingId=3"
    );
  });

  it("falls back to the hub with no id", () => {
    expect(adminBookingsHref({ behavior: "standard" })).toBe("/event-bookings");
    expect(adminBookingsHref({})).toBe("/event-bookings");
  });

  it("needs an event id before grouping can be applied", () => {
    expect(adminBookingsHref({ behavior: "standard", bookingGrouping: "per_type", eventType: "X" })).toBe(
      "/event-bookings"
    );
  });

  it("falls back to the per-event page when per_type has no type name", () => {
    expect(
      adminBookingsHref({ bookingGrouping: "per_type", eventType: null, eventId: 7, bookingId: 42 })
    ).toBe("/event-bookings/event/7?bookingId=42");
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

describe("manageBookingPath", () => {
  it("routes every booking to the generic manage page", () => {
    expect(manageBookingPath(42)).toBe("/manage-booking/42");
    expect(manageBookingPath("abc")).toBe("/manage-booking/abc");
  });
});
