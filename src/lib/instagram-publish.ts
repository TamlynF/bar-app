/* Instagram Content Publishing API - server-side only.

   This is the "true auto-publish" path from the Trends plan and it is dormant
   until two env vars exist. Everything else in the app keeps working without
   them; the share button (share-event-button.tsx) is the manual route and
   needs none of this.

   Required before it does anything:
     INSTAGRAM_USER_ID      - the Instagram *professional* account id (numeric),
                              found via GET /me/accounts → page → instagram_business_account
     INSTAGRAM_ACCESS_TOKEN - a long-lived Page token with instagram_basic +
                              instagram_content_publish (60-day expiry; needs a
                              refresh job or a System User token via Business Manager)
   Prerequisites Meta imposes (none of which are code):
     - @donfenticas must be a Business/Creator account linked to a Facebook Page
     - a Meta app with instagram_content_publish approved through App Review
     - image URLs must be public (Supabase storage URLs are fine), JPEG, and
       within Instagram's aspect-ratio limits (feed 4:5..1.91:1; stories 9:16 recommended)
   Rate limit: 100 API-published posts per 24h per account (Meta quota; nowhere near it).

   Two-step flow for every post: create a media container, then publish it.
   Reels are two steps plus polling because video is processed async; they're
   left until there's a hosted MP4 to send. */

const GRAPH = "https://graph.facebook.com/v21.0";

export type InstagramPublishInput =
  | { kind: "post"; imageUrl: string; caption: string }
  | { kind: "story"; imageUrl: string };

export type InstagramPublishResult =
  | { ok: true; mediaId: string; permalink: string | null }
  | { ok: false; error: string };

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN);
}

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

async function graphPost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: process.env.INSTAGRAM_ACCESS_TOKEN! });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = (await res.json()) as Record<string, unknown> & GraphError;
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(e?.message ? `Instagram: ${e.message} (code ${e.code ?? "?"})` : `Instagram: HTTP ${res.status}`);
  }
  return json;
}

async function graphGet(path: string, fields: string): Promise<Record<string, unknown>> {
  const url = `${GRAPH}/${path}?fields=${encodeURIComponent(fields)}&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`;
  const res = await fetch(url);
  const json = (await res.json()) as Record<string, unknown> & GraphError;
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Instagram: HTTP ${res.status}`);
  return json;
}

/* Publish one image as a feed post or a story. Idempotency is the caller's
   job - the API happily publishes the same image twice. Store the returned
   mediaId against the event so a second click can't re-post. */
export async function publishToInstagram(input: InstagramPublishInput): Promise<InstagramPublishResult> {
  if (!isInstagramConfigured()) {
    return { ok: false, error: "Instagram publishing isn't set up (INSTAGRAM_USER_ID / INSTAGRAM_ACCESS_TOKEN missing)." };
  }
  const igUser = process.env.INSTAGRAM_USER_ID!;

  try {
    // 1. Container. Stories take media_type=STORIES and no caption; feed posts
    //    take a caption (2,200 chars, up to 30 hashtags).
    const containerParams: Record<string, string> =
      input.kind === "story"
        ? { image_url: input.imageUrl, media_type: "STORIES" }
        : { image_url: input.imageUrl, caption: input.caption.slice(0, 2200) };
    const container = await graphPost(`${igUser}/media`, containerParams);
    const creationId = String(container.id ?? "");
    if (!creationId) return { ok: false, error: "Instagram didn't return a container id." };

    // 2. Publish. Images are usually ready immediately; if Meta says the
    //    container isn't finished yet, wait briefly and retry a few times.
    let mediaId = "";
    for (let attempt = 0; attempt < 5 && !mediaId; attempt++) {
      try {
        const published = await graphPost(`${igUser}/media_publish`, { creation_id: creationId });
        mediaId = String(published.id ?? "");
      } catch (err) {
        const msg = (err as Error).message;
        // Subcode 2207027 / "Media ID is not available" = still processing.
        if (attempt < 4 && /not available|2207027/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    if (!mediaId) return { ok: false, error: "Instagram never finished processing the image." };

    // Stories don't have a permalink; feed posts do.
    let permalink: string | null = null;
    if (input.kind === "post") {
      try {
        const media = await graphGet(mediaId, "permalink");
        permalink = typeof media.permalink === "string" ? media.permalink : null;
      } catch {
        /* permalink is a nice-to-have */
      }
    }
    return { ok: true, mediaId, permalink };
  } catch (err) {
    console.error("Instagram publish failed:", err);
    return { ok: false, error: (err as Error).message };
  }
}
