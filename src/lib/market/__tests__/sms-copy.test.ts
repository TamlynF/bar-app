import { describe, expect, it } from "vitest";
import { marketSmsBody, SMS_MAX_PER_NIGHT, SMS_SEGMENT_LIMIT, textsLeftTonight } from "../sms-copy";

const marketUrl = "https://donfenticas.co.uk/market";
const stopUrl = "https://donfenticas.co.uk/market/stop?t=0a1b2c3d4e5f";

describe("marketSmsBody", () => {
  it("lists the drinks, the board link and the stop link when they fit", () => {
    const body = marketSmsBody({ lines: ["Fireball down to £2.80 (-30.0%)", "Hooch running low"], marketUrl, stopUrl, crash: false });
    expect(body).toBe(`Fireball down to £2.80 (-30.0%)\nHooch running low\n${marketUrl}\nStop texts: ${stopUrl}`);
    expect(body.length).toBeLessThanOrEqual(SMS_SEGMENT_LIMIT);
  });

  it("drops trailing lines and counts them before giving up the board link", () => {
    const lines = Array.from({ length: 6 }, (_, i) => `Drink ${i + 1} down to £3.50 (-20.0%)`);
    const body = marketSmsBody({ lines, marketUrl, stopUrl, crash: false });
    expect(body.length).toBeLessThanOrEqual(SMS_SEGMENT_LIMIT);
    expect(body).toContain("Drink 1");
    expect(body).toMatch(/\+\d more/);
    expect(body).toContain(marketUrl);
    expect(body.endsWith(`Stop texts: ${stopUrl}`)).toBe(true);
  });

  it("gives up the board link before the only drink line", () => {
    const line = "Beppe Morchetta Spumante Extra Dry · 125ml glass down to £4.95 (-20.0%)";
    const body = marketSmsBody({ lines: [line], marketUrl, stopUrl, crash: false });
    expect(body.length).toBeLessThanOrEqual(SMS_SEGMENT_LIMIT);
    expect(body).toContain(line);
    expect(body).not.toContain(`${marketUrl}\n`);
    expect(body).toContain(stopUrl);
  });

  it("leads with the crash when one is on", () => {
    expect(marketSmsBody({ lines: ["Every drink at its floor price"], marketUrl, stopUrl, crash: true })).toMatch(/^Market crash/);
  });

  it("always keeps the stop link even when nothing else fits", () => {
    const body = marketSmsBody({ lines: ["x".repeat(200)], marketUrl, stopUrl, crash: false });
    expect(body).toBe(`Stop texts: ${stopUrl}`);
  });
});

describe("textsLeftTonight", () => {
  it("starts fresh on a new trading night", () => {
    expect(textsLeftTonight("2026-10-06", SMS_MAX_PER_NIGHT, "2026-10-07")).toBe(SMS_MAX_PER_NIGHT);
    expect(textsLeftTonight(null, 0, "2026-10-07")).toBe(SMS_MAX_PER_NIGHT);
  });

  it("counts down within the same night and never goes negative", () => {
    expect(textsLeftTonight("2026-10-07", 3, "2026-10-07")).toBe(SMS_MAX_PER_NIGHT - 3);
    expect(textsLeftTonight("2026-10-07", 99, "2026-10-07")).toBe(0);
  });
});
