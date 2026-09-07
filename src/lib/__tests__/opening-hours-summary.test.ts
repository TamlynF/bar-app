import { describe, it, expect } from "vitest";
import { summariseOpeningHours } from "@/lib/opening-hours";

describe("summariseOpeningHours", () => {
  it("collapses consecutive days with the same session", () => {
    expect(
      summariseOpeningHours({
        monday: { open: "17:00", close: "00:00" },
        tuesday: { open: "17:00", close: "00:00" },
        wednesday: { open: "17:00", close: "00:00" },
        thursday: { open: "17:00", close: "00:00" },
        friday: { open: "17:00", close: "02:00" },
        saturday: { open: "17:00", close: "02:00" },
        sunday: { open: "17:00", close: "23:00" },
      })
    ).toEqual(["Mon–Thu 5pm–12am", "Fri–Sat 5pm–2am", "Sun 5pm–11pm"]);
  });

  it("skips closed days and keeps single days short", () => {
    expect(
      summariseOpeningHours({
        thursday: { open: "19:00", close: "22:00" },
        saturday: { open: "15:00", close: "01:00" },
      })
    ).toEqual(["Thu 7pm–10pm", "Sat 3pm–1am"]);
  });

  it("returns nothing without hours", () => {
    expect(summariseOpeningHours(null)).toEqual([]);
    expect(summariseOpeningHours({})).toEqual([]);
  });
});
