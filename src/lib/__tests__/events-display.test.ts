import { describe, it, expect } from "vitest";
import {
  formatTime,
  getEventType,
  serializeEvent,
  ticketAvailability,
  type EventRow,
} from "@/lib/events-display";

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    title: "Quiz Night",
    date: "2026-06-18",
    start_time: "20:00:00+00",
    end_time: "23:30:00+00",
    is_active: true,
    is_fully_booked: false,
    is_bookable: true,
    external_link: null,
    booking_page_url: null,
    karaoke_request_url: null,
    event_types: { name: "games", color: "blue" },
    event_subtypes: { name: "quiz", color: "blue", behavior: "quiz" },
    ...overrides,
  };
}

describe("formatTime", () => {
  it("formats afternoon/evening times as pm", () => {
    expect(formatTime("20:00:00+00")).toBe("8:00pm");
    expect(formatTime("12:00:00+00")).toBe("12:00pm");
  });

  it("formats morning times as am, with midnight as 12am", () => {
    expect(formatTime("09:30:00+00")).toBe("9:30am");
    expect(formatTime("00:15:00+00")).toBe("12:15am");
  });

  it("preserves half-hours and returns null for no time", () => {
    expect(formatTime("20:30:00+00")).toBe("8:30pm");
    expect(formatTime(null)).toBeNull();
  });
});

describe("getEventType", () => {
  it("handles the join returned as an object", () => {
    const et = getEventType(
      makeEvent({
        event_types: { name: "games", color: "blue" },
        event_subtypes: { name: "bingo", color: "red", behavior: "bingo" },
      })
    );
    expect(et).toMatchObject({ type: "games", sub_type: "bingo", badge_color: "red", behavior: "bingo" });
  });

  it("handles the join returned as an array (Supabase gotcha)", () => {
    const et = getEventType(
      makeEvent({
        event_types: [{ name: "music", color: "purple" }],
        event_subtypes: [{ name: "karaoke", color: "orange", behavior: "karaoke" }],
      })
    );
    expect(et).toMatchObject({ type: "music", sub_type: "karaoke", behavior: "karaoke" });
  });

  it("falls back to 'standard' when behavior is null or unrecognised", () => {
    const nullBehavior = getEventType(
      makeEvent({ event_subtypes: { name: "trivia", color: null, behavior: null } })
    );
    expect(nullBehavior?.behavior).toBe("standard");

    const bogusBehavior = getEventType(
      makeEvent({
        event_subtypes: { name: "trivia", color: null, behavior: "games" },
      })
    );
    expect(bogusBehavior?.behavior).toBe("standard");
  });
});

describe("serializeEvent", () => {
  it("maps a row into the shared serialized shape with formatted times", () => {
    const s = serializeEvent(makeEvent());
    expect(s).toMatchObject({
      id: 1,
      title: "Quiz Night",
      startTimeLabel: "8:00pm",
      endTimeLabel: "11:30pm",
      isBookable: true,
      subType: "quiz",
      isKaraoke: false,
    });
    expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("serializeEvent image fallback", () => {
  const EVENT_IMG = "https://cdn.test/event.png";
  const ACT_IMG = "https://cdn.test/act.png";
  const SUBTYPE_IMG = "https://cdn.test/subtype.png";

  const withSubtypeDefault = {
    event_subtypes: {
      name: "quiz",
      color: "blue",
      behavior: "quiz",
      default_image_url: SUBTYPE_IMG,
    },
  } satisfies Partial<EventRow>;

  const withActCover = {
    band_booking_requests: [{ music_acts: { cover_image: { url: ACT_IMG } } }],
  } satisfies Partial<EventRow>;

  it("uses the event's own image when set", () => {
    const s = serializeEvent(
      makeEvent({ image_url: EVENT_IMG, ...withActCover, ...withSubtypeDefault })
    );
    expect(s.imageUrl).toBe(EVENT_IMG);
  });

  it("falls back to the booked act's cover when the event has none", () => {
    const s = serializeEvent(makeEvent({ ...withActCover, ...withSubtypeDefault }));
    expect(s.imageUrl).toBe(ACT_IMG);
  });

  it("falls back to the subtype default when event and act have none", () => {
    const s = serializeEvent(makeEvent(withSubtypeDefault));
    expect(s.imageUrl).toBe(SUBTYPE_IMG);
  });

  it("is null when nothing resolves", () => {
    expect(serializeEvent(makeEvent()).imageUrl).toBeNull();
  });

  it("treats an empty event image as absent and inherits", () => {
    const s = serializeEvent(makeEvent({ image_url: "", ...withSubtypeDefault }));
    expect(s.imageUrl).toBe(SUBTYPE_IMG);
  });

  it("skips band requests that have no linked act", () => {
    const s = serializeEvent(
      makeEvent({
        band_booking_requests: [
          { music_acts: null },
          { music_acts: { cover_image: { url: ACT_IMG } } },
        ],
      })
    );
    expect(s.imageUrl).toBe(ACT_IMG);
  });

  it("prefers the booking's own poster over the act's", () => {
    const s = serializeEvent(
      makeEvent({
        band_booking_requests: [
          { cover_image: { url: "https://cdn.test/request.png" }, music_acts: { cover_image: { url: ACT_IMG } } },
        ],
      })
    );
    expect(s.imageUrl).toBe("https://cdn.test/request.png");
  });

  it("handles the act embed arriving as an array", () => {
    const s = serializeEvent(
      makeEvent({
        band_booking_requests: [{ music_acts: [{ cover_image: [{ url: ACT_IMG }] }] }],
      })
    );
    expect(s.imageUrl).toBe(ACT_IMG);
  });
});

describe("ticketAvailability", () => {
  const ticketed = serializeEvent(makeEvent({ seating_required: false }));
  const seated = serializeEvent(makeEvent({ seating_required: true }));

  it("shows nothing for events that cannot be booked", () => {
    expect(ticketAvailability({ ...ticketed, isBookable: false }, { left: 1, total: 100 })).toBeNull();
  });

  it("is sold out when flagged or when no space is left", () => {
    expect(ticketAvailability({ ...ticketed, isFullyBooked: true })?.status).toBe("sold_out");
    expect(ticketAvailability(ticketed, { left: 0, total: 100 })).toEqual({ status: "sold_out", label: "Sold out" });
  });

  it("is nearly sold out at 20% or less remaining", () => {
    expect(ticketAvailability(ticketed, { left: 20, total: 100 })).toEqual({ status: "nearly", label: "Only 20 left" });
    expect(ticketAvailability(seated, { left: 2, total: 10 })).toEqual({ status: "nearly", label: "Nearly sold out" });
  });

  it("is available above 20% remaining or when space is unknown", () => {
    expect(ticketAvailability(ticketed, { left: 21, total: 100 })).toEqual({
      status: "available",
      label: "Tickets available",
    });
    expect(ticketAvailability(seated, null)).toEqual({ status: "available", label: "Tables available" });
  });
});
