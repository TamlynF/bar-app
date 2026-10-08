import { describe, expect, it } from "vitest";
import {
  bookingLinkFor,
  defaultPreferredChannel,
  describePreferredChannel,
  parseArrival,
  preferredChannelOptions,
} from "@/lib/meta/preferred-channel";

const fromInstagram = { channel: "instagram" as const, handle: "tamfourie", channelId: "row-1" };

describe("preferredChannelOptions", () => {
  it("offers email and instagram, each only when the act has given it", () => {
    const options = preferredChannelOptions({ email: "a@b.com", instagram: "", arrival: null });
    expect(options.map((o) => [o.channel, o.available, o.detail])).toEqual([
      ["email", true, "a@b.com"],
      ["instagram", false, null],
    ]);
    expect(options[1].why).toMatch(/Instagram handle/);
  });

  it("reads the handle from a pasted profile link", () => {
    const [, instagram] = preferredChannelOptions({
      email: "",
      instagram: "https://instagram.com/TamFourie",
      arrival: null,
    });
    expect(instagram.available).toBe(true);
    expect(instagram.detail).toBe("@tamfourie");
  });

  it("lists Messenger only for an act who arrived from a Messenger chat", () => {
    const viaMessenger = preferredChannelOptions({
      email: "a@b.com",
      instagram: "",
      arrival: { channel: "messenger", handle: null, channelId: "row-2" },
    });
    expect(viaMessenger.map((o) => o.channel)).toEqual(["email", "instagram", "messenger"]);
    expect(preferredChannelOptions({ email: "a@b.com", instagram: "", arrival: fromInstagram }).map((o) => o.channel)).toEqual([
      "email",
      "instagram",
    ]);
  });
});

describe("defaultPreferredChannel", () => {
  it("defaults to where the link came from once that channel is usable", () => {
    const withHandle = preferredChannelOptions({ email: "a@b.com", instagram: "tamfourie", arrival: fromInstagram });
    expect(defaultPreferredChannel(withHandle, fromInstagram)).toBe("instagram");
    const noHandle = preferredChannelOptions({ email: "a@b.com", instagram: "", arrival: fromInstagram });
    expect(defaultPreferredChannel(noHandle, fromInstagram)).toBe("email");
    expect(defaultPreferredChannel(withHandle, null)).toBe("email");
  });
});

describe("parseArrival and bookingLinkFor", () => {
  it("accepts only known sources", () => {
    expect(parseArrival("instagram")).toBe("instagram");
    expect(parseArrival("sms")).toBe("sms");
    expect(parseArrival("tiktok")).toBeNull();
    expect(parseArrival(undefined)).toBeNull();
  });

  it("builds the tagged booking link", () => {
    expect(bookingLinkFor("https://bar-app-tau.vercel.app/", "instagram", "row-1")).toBe(
      "https://bar-app-tau.vercel.app/book/band?via=instagram&c=row-1"
    );
    expect(bookingLinkFor("https://bar-app-tau.vercel.app", "messenger", "row-2", "private")).toBe(
      "https://bar-app-tau.vercel.app/book/private?via=messenger&c=row-2"
    );
  });
});

describe("describePreferredChannel", () => {
  it("says what the channel points at", () => {
    expect(describePreferredChannel("instagram", { instagram: "https://instagram.com/tamfourie" })).toBe("Instagram (@tamfourie)");
    expect(describePreferredChannel("email", { email: "a@b.com" })).toBe("Email (a@b.com)");
    expect(describePreferredChannel("messenger", {})).toBe("Facebook Messenger");
  });
});
