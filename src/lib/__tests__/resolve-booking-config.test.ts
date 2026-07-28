import { describe, it, expect } from "vitest";
import { resolveOwningBookingConfig } from "@/lib/resolve-booking-config";
import { normalizeBookingConfig } from "@/lib/booking-config";

const eventConfig = { tag_line: "from event" };
const typeConfig = { tag_line: "from type" };
const subtypeConfig = { tag_line: "from subtype" };
const all = { eventConfig, typeConfig, subtypeConfig };

describe("resolveOwningBookingConfig", () => {
  it("reads the level that owns the public booking page", () => {
    expect(resolveOwningBookingConfig({ grouping: "per_type", ...all })).toBe(typeConfig);
    expect(resolveOwningBookingConfig({ grouping: "per_subtype", ...all })).toBe(subtypeConfig);
    expect(resolveOwningBookingConfig({ grouping: "per_event", ...all })).toBe(eventConfig);
  });

  it("falls back to the event config when the grouping is unknown", () => {
    expect(resolveOwningBookingConfig({ grouping: null, ...all })).toBe(eventConfig);
    expect(resolveOwningBookingConfig({ grouping: undefined, ...all })).toBe(eventConfig);
  });

  it("returns an empty config rather than the wrong level when the owner has none", () => {
    expect(resolveOwningBookingConfig({ grouping: "per_type", eventConfig, typeConfig: null })).toEqual({});
    expect(resolveOwningBookingConfig({ grouping: "per_subtype", eventConfig, subtypeConfig: null })).toEqual({});
  });

  it("never leaks a per-event config into a grouped booking page", () => {
    const perEventOnly = {
      fields: { group_name: { visible: true, label: "Team Name", required: true } },
    };
    const resolved = resolveOwningBookingConfig({
      grouping: "per_subtype",
      eventConfig: perEventOnly,
      subtypeConfig: {},
    });
    expect(normalizeBookingConfig(resolved).fields.group_name.visible).toBe(false);
  });
});
