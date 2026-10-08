export type MessageChannel = "email" | "messenger" | "instagram";
export type MetaChannel = Exclude<MessageChannel, "email">;

export const CHANNEL_LABELS: Record<MessageChannel, string> = {
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
};

export const META_CHANNELS: MetaChannel[] = ["messenger", "instagram"];

export function isMetaChannel(value: unknown): value is MetaChannel {
  return value === "messenger" || value === "instagram";
}

const HOUR = 60 * 60 * 1000;
export const STANDARD_WINDOW_MS = 24 * HOUR;
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR;

export type ReplyAllowance =
  | { mode: "response" }
  | { mode: "human_agent" }
  | { mode: "closed"; reason: string };

/* Meta's rule: a free reply only inside 24 hours of the customer's last
   message. Messenger stretches that to 7 days under the Human Agent tag;
   Instagram has no such tag, so after 24 hours the thread is closed until
   they write again. */
export function replyAllowance(
  channel: MetaChannel,
  lastInboundAt: string | null | undefined,
  now: number = Date.now()
): ReplyAllowance {
  if (!lastInboundAt) return { mode: "closed", reason: `They haven't messaged on ${CHANNEL_LABELS[channel]} yet.` };
  const age = now - Date.parse(lastInboundAt);
  if (age <= STANDARD_WINDOW_MS) return { mode: "response" };
  if (channel === "messenger" && age <= HUMAN_AGENT_WINDOW_MS) return { mode: "human_agent" };
  return {
    mode: "closed",
    reason:
      channel === "messenger"
        ? "More than 7 days since their last message - Meta won't deliver a reply until they write again."
        : "More than 24 hours since their last message - Instagram won't deliver a reply until they write again.",
  };
}

/* "@handle", "instagram.com/handle/" and "https://www.instagram.com/handle?x" all
   give "handle"; anything that isn't a plausible username gives null. */
export function instagramHandle(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  let candidate = raw;
  const url = raw.match(/instagram\.com\/([^/?#\s]+)/i);
  if (url) candidate = url[1];
  candidate = candidate.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(candidate) ? candidate : null;
}

/* The address shown on a chat message in place of an email: the handle
   when Meta gave one, else the opaque id. */
export function channelAddress(channel: MetaChannel, externalId: string, handle?: string | null): string {
  return handle ? `${channel}:@${handle}` : `${channel}:${externalId}`;
}
