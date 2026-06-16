import { describe, it, expect } from "vitest";
import {
  formatTime,
  getEventType,
  serializeEvent,
  type EventRow,
} from "@/lib/events-display";

/** Minimal valid EventRow with overridable fields. */
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
    event_subtypes: { name: "quiz", color: "blue", is_karaoke: false },
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
        event_subtypes: { name: "bingo", color: "red", is_karaoke: false },
      })
    );
    expect(et).toMatchObject({ type: "games", sub_type: "bingo", badge_color: "red" });
  });

  it("handles the join returned as an array (Supabase gotcha)", () => {
    const et = getEventType(
      makeEvent({
        event_types: [{ name: "music", color: "purple" }],
        event_subtypes: [{ name: "karaoke", color: "orange", is_karaoke: true }],
      })
    );
    expect(et).toMatchObject({ type: "music", sub_type: "karaoke", is_karaoke: true });
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
    // colour resolves to a brightened hex string
    expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
