import { describe, expect, it } from "vitest";
import { cleanSocialHandle, detectSocialLink, portableHandle, socialPrefix, socialUrl } from "@/lib/social-links";

describe("detectSocialLink", () => {
  it("reads Instagram profile links with share tracking", () => {
    expect(detectSocialLink("https://www.instagram.com/theband/?igsh=MTN2ZmFhZ")).toEqual({
      platform: "instagram",
      handle: "theband",
    });
    expect(detectSocialLink("instagram.com/the.band_")).toEqual({ platform: "instagram", handle: "the.band_" });
  });

  it("ignores Instagram post and reel links", () => {
    expect(detectSocialLink("https://www.instagram.com/p/C1abc/")).toBeNull();
    expect(detectSocialLink("https://www.instagram.com/reel/C1abc/")).toBeNull();
  });

  it("reads Facebook pages, people and profile ids", () => {
    expect(detectSocialLink("https://m.facebook.com/thebandofficial")).toEqual({
      platform: "facebook",
      handle: "thebandofficial",
    });
    expect(detectSocialLink("https://www.facebook.com/profile.php?id=100064&mibextid=abc")).toEqual({
      platform: "facebook",
      handle: "profile.php?id=100064",
    });
    expect(detectSocialLink("https://www.facebook.com/groups/123")).toBeNull();
  });

  it("reads YouTube handles and channel paths", () => {
    expect(detectSocialLink("https://youtube.com/@theband?si=xyz")).toEqual({ platform: "youtube", handle: "theband" });
    expect(detectSocialLink("https://www.youtube.com/channel/UC123abc")).toEqual({
      platform: "youtube",
      handle: "channel/UC123abc",
    });
    expect(detectSocialLink("https://www.youtube.com/watch?v=abc")).toBeNull();
  });

  it("reads TikTok profiles but not videos", () => {
    expect(detectSocialLink("https://www.tiktok.com/@theband?_t=8abc&_r=1")).toEqual({
      platform: "tiktok",
      handle: "theband",
    });
    expect(detectSocialLink("https://www.tiktok.com/@theband/video/123")).toEqual({ platform: "tiktok", handle: "theband" });
  });

  it("returns null for handles and other sites", () => {
    expect(detectSocialLink("@theband")).toBeNull();
    expect(detectSocialLink("https://example.com/theband")).toBeNull();
    expect(detectSocialLink("https://notinstagram.com/theband")).toBeNull();
  });
});

describe("cleanSocialHandle", () => {
  it("strips @, slashes and whole links for the same platform", () => {
    expect(cleanSocialHandle("instagram", "@theband")).toBe("theband");
    expect(cleanSocialHandle("tiktok", "  theband/ ")).toBe("theband");
    expect(cleanSocialHandle("instagram", "https://instagram.com/theband?igsh=x")).toBe("theband");
  });
});

describe("socialUrl and socialPrefix", () => {
  it("builds profile links, keeping YouTube channel paths", () => {
    expect(socialUrl("tiktok", "theband")).toBe("https://tiktok.com/@theband");
    expect(socialUrl("youtube", "theband")).toBe("https://youtube.com/@theband");
    expect(socialUrl("youtube", "channel/UC123")).toBe("https://youtube.com/channel/UC123");
    expect(socialPrefix("youtube", "channel/UC123")).toBe("youtube.com/");
  });
});

describe("portableHandle", () => {
  it("only offers plain handles for reuse", () => {
    expect(portableHandle("theband")).toBe("theband");
    expect(portableHandle("channel/UC123")).toBeNull();
    expect(portableHandle("profile.php?id=1")).toBeNull();
  });
});
