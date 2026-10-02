export const SOCIAL_PLATFORMS = ["instagram", "facebook", "youtube", "tiktok"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const HOSTS: Record<string, SocialPlatform> = {
  "instagram.com": "instagram",
  "instagr.am": "instagram",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "youtube.com": "youtube",
  "tiktok.com": "tiktok",
};

const INSTAGRAM_RESERVED = new Set(["p", "reel", "reels", "tv", "explore", "accounts", "direct"]);
const FACEBOOK_RESERVED = new Set(["groups", "events", "watch", "share", "photo", "photos", "story.php", "sharer"]);
const YOUTUBE_PATHS = new Set(["channel", "c", "user"]);

/* YouTube channels without an @handle are stored with their path (channel/UC…,
   c/name, user/name), so the field shows youtube.com/ instead of youtube.com/@. */
export function socialPrefix(platform: SocialPlatform, handle: string): string {
  switch (platform) {
    case "instagram":
      return "instagram.com/";
    case "facebook":
      return "facebook.com/";
    case "youtube":
      return YOUTUBE_PATHS.has(handle.split("/")[0]) ? "youtube.com/" : "youtube.com/@";
    case "tiktok":
      return "tiktok.com/@";
  }
}

export function socialUrl(platform: SocialPlatform, handle: string): string {
  return `https://${socialPrefix(platform, handle)}${handle}`;
}

/* A bare handle shared across platforms, used to offer the same name on the
   ones not filled in yet. Channel paths and Facebook profile ids don't carry
   over, so they return null. */
export function portableHandle(handle: string): string | null {
  return /^[A-Za-z0-9._-]{2,30}$/.test(handle) ? handle : null;
}

function asUrl(input: string): URL | null {
  const text = input.trim();
  if (!/^(https?:\/\/)?([a-z0-9-]+\.)*(instagram\.com|instagr\.am|facebook\.com|fb\.com|youtube\.com|tiktok\.com)(\/|$)/i.test(text)) {
    return null;
  }
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

function hostPlatform(url: URL): SocialPlatform | null {
  const host = url.hostname.toLowerCase().replace(/^(www|m|web|mobile)\./, "");
  return HOSTS[host] ?? null;
}

function handleFromUrl(platform: SocialPlatform, url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [first, second] = segments;
  switch (platform) {
    case "instagram":
      if (!first || INSTAGRAM_RESERVED.has(first.toLowerCase())) return null;
      if (first === "stories" && second) return second;
      return first;
    case "facebook": {
      if (first === "profile.php") {
        const id = url.searchParams.get("id");
        return id ? `profile.php?id=${id}` : null;
      }
      if (!first || FACEBOOK_RESERVED.has(first.toLowerCase())) return null;
      if (first === "people" || first === "pages") return segments.join("/");
      return first;
    }
    case "youtube":
      if (!first) return null;
      if (first.startsWith("@")) return first.slice(1) || null;
      if (YOUTUBE_PATHS.has(first) && second) return `${first}/${second}`;
      return null;
    case "tiktok":
      return first?.startsWith("@") ? first.slice(1) || null : null;
  }
}

/* Recognises a pasted profile link from any of the four platforms, with or
   without www./m., trailing slashes or share tracking (?igsh=, ?si=, ?_t=). */
export function detectSocialLink(input: string): { platform: SocialPlatform; handle: string } | null {
  const url = asUrl(input);
  if (!url) return null;
  const platform = hostPlatform(url);
  if (!platform) return null;
  const handle = handleFromUrl(platform, url);
  return handle ? { platform, handle } : null;
}

/* What a band types or pastes into one platform's field, reduced to the
   handle: @name, name, or a full profile link for that platform. */
export function cleanSocialHandle(platform: SocialPlatform, input: string): string {
  const detected = detectSocialLink(input);
  if (detected && detected.platform === platform) return detected.handle;
  return input.trim().replace(/^@+/, "").replace(/\/+$/, "");
}
