import { describe, expect, it } from "vitest";
import { parseVideoLink } from "@/lib/video-links";

describe("parseVideoLink", () => {
  it("rewrites YouTube watch, short, shorts and live links to a watch URL", () => {
    const expected = { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", platform: "youtube" };
    expect(parseVideoLink("https://youtu.be/dQw4w9WgXcQ?si=abc")).toEqual(expected);
    expect(parseVideoLink("https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share")).toEqual(expected);
    expect(parseVideoLink("youtube.com/shorts/dQw4w9WgXcQ")).toEqual(expected);
    expect(parseVideoLink("https://www.youtube.com/live/dQw4w9WgXcQ")).toEqual(expected);
  });

  it("keeps platform video links and strips share tracking", () => {
    expect(parseVideoLink("https://vimeo.com/123456789")).toEqual({ url: "https://vimeo.com/123456789", platform: "vimeo" });
    expect(parseVideoLink("https://www.instagram.com/reel/C1abc/?igsh=xyz")).toEqual({
      url: "https://www.instagram.com/reel/C1abc/",
      platform: "instagram",
    });
    expect(parseVideoLink("https://www.tiktok.com/@theband/video/7300000000?_t=8abc&_r=1")).toEqual({
      url: "https://www.tiktok.com/@theband/video/7300000000",
      platform: "tiktok",
    });
    expect(parseVideoLink("https://www.facebook.com/theband/videos/123456/")).toMatchObject({ platform: "facebook" });
    expect(parseVideoLink("https://fb.watch/abc123/")).toMatchObject({ platform: "facebook" });
    expect(parseVideoLink("https://drive.google.com/file/d/1AbC/view?usp=sharing")).toMatchObject({ platform: "drive" });
    expect(parseVideoLink("https://www.dropbox.com/scl/fi/abc/gig.mp4?rlkey=x&dl=0")).toMatchObject({ platform: "dropbox" });
  });

  it("turns away profile and Spotify links", () => {
    expect(parseVideoLink("https://www.instagram.com/theband/")).toHaveProperty("error");
    expect(parseVideoLink("https://www.tiktok.com/@theband")).toHaveProperty("error");
    expect(parseVideoLink("https://youtube.com/@theband")).toHaveProperty("error");
    expect(parseVideoLink("https://open.spotify.com/artist/abc")).toHaveProperty("error");
  });

  it("keeps other https links and rejects text that isn't a link", () => {
    expect(parseVideoLink("https://theband.co.uk/live")).toEqual({ url: "https://theband.co.uk/live", platform: "other" });
    expect(parseVideoLink("our gig at the cavern")).toHaveProperty("error");
    expect(parseVideoLink("javascript:alert(1)")).toHaveProperty("error");
  });
});
