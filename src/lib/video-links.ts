import { detectSocialLink } from "@/lib/social-links";

export type VideoPlatform = "youtube" | "vimeo" | "instagram" | "tiktok" | "facebook" | "drive" | "dropbox" | "other";

export const VIDEO_PLATFORM_LABELS: Record<VideoPlatform, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  drive: "Google Drive",
  dropbox: "Dropbox",
  other: "Video link",
};

export type VideoLink = { url: string; platform: VideoPlatform };
export type VideoLinkResult = VideoLink | { error: string };

const TRACKING_PARAMS = /^(si|igsh|igshid|_t|_r|mibextid|feature|pp|is_from_webapp|sender_device|utm_.*)$/i;

function toUrl(input: string): URL | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!/^https?:$/.test(url.protocol) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function bareHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^(www|m|web|mobile)\./, "");
}

function stripTracking(url: URL): string {
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  return url.toString();
}

function youTubeId(url: URL, host: string): string | null {
  if (host === "youtu.be") return url.pathname.split("/")[1] || null;
  if (host !== "youtube.com" && host !== "music.youtube.com") return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const match = url.pathname.match(/^\/(shorts|live|embed)\/([\w-]{11})/);
  return match ? match[2] : null;
}

function platformVideo(url: URL, host: string): VideoPlatform | null {
  const path = url.pathname;
  if (host === "vimeo.com" && /^\/(\d+|channels\/[^/]+\/\d+|groups\/[^/]+\/videos\/\d+|showcase\/\d+\/video\/\d+)/.test(path)) return "vimeo";
  if (host === "player.vimeo.com" && /^\/video\/\d+/.test(path)) return "vimeo";
  if ((host === "instagram.com" || host === "instagr.am") && /^\/(p|reel|reels|tv)\/[^/]+/.test(path)) return "instagram";
  if (host === "tiktok.com" && /^\/@[^/]+\/video\/\d+/.test(path)) return "tiktok";
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return "tiktok";
  if (host === "fb.watch") return "facebook";
  if (
    (host === "facebook.com" || host === "fb.com") &&
    (/\/videos\//.test(path) || path === "/watch" || path === "/watch/" || /^\/(reel|share\/v|share\/r)\//.test(path))
  ) {
    return "facebook";
  }
  if (host === "drive.google.com" && /^\/(file\/d\/|open)/.test(path)) return "drive";
  if (host === "dropbox.com" && /^\/(s|scl|sh)\//.test(path)) return "dropbox";
  return null;
}

/* A performance video link pasted by a band. Known platforms are recognised
   (YouTube links are rewritten to a plain watch URL so they embed), share
   tracking is stripped, and a profile link is turned away with a hint to
   paste the video itself. Any other https link is kept as a plain link. */
export function parseVideoLink(input: string): VideoLinkResult {
  const url = toUrl(input);
  if (!url) return { error: "That doesn't look like a link. Paste the full address of the video." };
  const host = bareHost(url);

  const ytId = youTubeId(url, host);
  if (ytId && /^[\w-]{11}$/.test(ytId)) return { url: `https://www.youtube.com/watch?v=${ytId}`, platform: "youtube" };

  const platform = platformVideo(url, host);
  if (platform) return { url: stripTracking(url), platform };

  if (detectSocialLink(url.toString()) || host === "youtube.com" || host === "vimeo.com") {
    return { error: "That's a profile link. Open the video itself and copy its link." };
  }
  if (host.endsWith("spotify.com")) return { error: "Spotify goes in the Spotify field above. Paste a video link here." };

  return { url: stripTracking(url), platform: "other" };
}

export function videoLinkPlatform(url: string): VideoPlatform {
  const parsed = parseVideoLink(url);
  return "platform" in parsed ? parsed.platform : "other";
}
