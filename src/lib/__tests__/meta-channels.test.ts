import { describe, expect, it } from "vitest";
import { channelAddress, instagramHandle, replyAllowance } from "@/lib/meta/channels";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 60 * 60 * 1000).toISOString();

describe("replyAllowance", () => {
  it("allows a plain reply inside 24 hours on both channels", () => {
    expect(replyAllowance("messenger", ago(23), NOW)).toEqual({ mode: "response" });
    expect(replyAllowance("instagram", ago(23), NOW)).toEqual({ mode: "response" });
  });

  it("stretches Messenger to 7 days with the human agent tag", () => {
    expect(replyAllowance("messenger", ago(25), NOW)).toEqual({ mode: "human_agent" });
    expect(replyAllowance("messenger", ago(24 * 6), NOW)).toEqual({ mode: "human_agent" });
    expect(replyAllowance("messenger", ago(24 * 8), NOW).mode).toBe("closed");
  });

  it("closes Instagram after 24 hours", () => {
    const closed = replyAllowance("instagram", ago(25), NOW);
    expect(closed.mode).toBe("closed");
    expect(closed.mode === "closed" && closed.reason).toMatch(/24 hours/);
  });

  it("is closed until they have written at all", () => {
    expect(replyAllowance("messenger", null, NOW).mode).toBe("closed");
  });
});

describe("instagramHandle", () => {
  it("reads a handle out of the ways people type it", () => {
    expect(instagramHandle("@TamFourie")).toBe("tamfourie");
    expect(instagramHandle("https://www.instagram.com/tamfourie/?hl=en")).toBe("tamfourie");
    expect(instagramHandle("instagram.com/tam.fourie_1")).toBe("tam.fourie_1");
    expect(instagramHandle("tamfourie")).toBe("tamfourie");
  });

  it("rejects things that are not a username", () => {
    expect(instagramHandle("")).toBeNull();
    expect(instagramHandle(null)).toBeNull();
    expect(instagramHandle("https://facebook.com/tamfourie")).toBeNull();
    expect(instagramHandle("not a handle")).toBeNull();
  });
});

describe("channelAddress", () => {
  it("prefers the handle and falls back to the id", () => {
    expect(channelAddress("instagram", "123", "tamfourie")).toBe("instagram:@tamfourie");
    expect(channelAddress("messenger", "123", null)).toBe("messenger:123");
  });
});
