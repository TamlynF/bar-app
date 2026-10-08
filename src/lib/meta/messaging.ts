import { createHmac, timingSafeEqual } from "node:crypto";
import type { MetaChannel } from "@/lib/meta/channels";

export const META_GRAPH_VERSION = "v21.0";

export type { MetaChannel };

export type MetaEnv = {
  appSecret: string;
  verifyToken: string;
  pageAccessToken: string;
};

/* All three must be set before the webhook answers or a message is sent;
   a half-configured integration is treated as switched off. */
export function readMetaEnv(): MetaEnv | null {
  const appSecret = process.env.META_APP_SECRET ?? "";
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN ?? "";
  if (!appSecret || !verifyToken || !pageAccessToken) return null;
  return { appSecret, verifyToken, pageAccessToken };
}

export function metaMessagingEnabled(): boolean {
  return readMetaEnv() !== null;
}

/* Meta signs the raw body with the app secret: X-Hub-Signature-256 = "sha256=<hex>". */
export function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

/* The GET handshake Meta makes when a callback URL is saved. Returns the
   challenge to echo back, or null when the token does not match. */
export function webhookChallenge(
  params: { mode: string | null; token: string | null; challenge: string | null },
  verifyToken: string
): string | null {
  if (params.mode !== "subscribe" || params.token !== verifyToken || !params.challenge) return null;
  return params.challenge;
}

export type InboundMetaMessage = {
  channel: MetaChannel;
  senderId: string;
  recipientId: string;
  messageId: string;
  text: string;
  attachments: { type: string; url: string | null }[];
  quickReplyPayload: string | null;
  sentAt: string;
  isEcho: boolean;
};

type MetaWebhookBody = {
  object?: string;
  entry?: {
    id?: string;
    time?: number;
    messaging?: MetaMessagingEvent[];
  }[];
};

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload?: string };
    attachments?: { type?: string; payload?: { url?: string } }[];
  };
};

/* One flat list of messages from a webhook body, whichever of the two
   products sent it; delivery receipts, reads and postbacks are skipped. */
export function parseMetaWebhook(body: unknown): InboundMetaMessage[] {
  const data = body as MetaWebhookBody;
  const channel: MetaChannel | null =
    data?.object === "page" ? "messenger" : data?.object === "instagram" ? "instagram" : null;
  if (!channel || !Array.isArray(data.entry)) return [];

  const out: InboundMetaMessage[] = [];
  for (const entry of data.entry) {
    for (const event of entry.messaging ?? []) {
      const message = event.message;
      if (!message?.mid || !event.sender?.id) continue;
      out.push({
        channel,
        senderId: event.sender.id,
        recipientId: event.recipient?.id ?? entry.id ?? "",
        messageId: message.mid,
        text: message.text ?? "",
        attachments: (message.attachments ?? []).map((a) => ({
          type: a.type ?? "file",
          url: a.payload?.url ?? null,
        })),
        quickReplyPayload: message.quick_reply?.payload ?? null,
        sentAt: new Date(event.timestamp ?? entry.time ?? Date.now()).toISOString(),
        isEcho: message.is_echo === true,
      });
    }
  }
  return out;
}

export type MetaSendResult = { ok: true; messageId: string } | { ok: false; error: string };

export type MetaQuickReply = { title: string; payload: string };

/* A plain-text reply to someone who has messaged the Page or the Instagram
   account. Both products share the Send API; the Page token covers both once
   the Instagram account is linked to the Page. Quick replies are tappable
   chips under the message - both products allow up to 13, titles of 20
   characters - that come back through the webhook as a message carrying the
   chip's payload. */
export async function sendMetaText(
  env: MetaEnv,
  p: { recipientId: string; text: string; humanAgent?: boolean; quickReplies?: MetaQuickReply[] }
): Promise<MetaSendResult> {
  return postMetaMessage(env, p.recipientId, { text: p.text, ...quickReplyField(p.quickReplies) }, p.humanAgent);
}

export type MetaCard = { title: string; subtitle?: string; buttons: { title: string; url: string }[] };

/* A generic-template card: a title, a line under it and up to three link
   buttons, drawn by both products as a bordered tile. The one way to put a
   link in a DM as a button rather than a pasted address. */
export async function sendMetaCard(
  env: MetaEnv,
  p: { recipientId: string; card: MetaCard; humanAgent?: boolean; quickReplies?: MetaQuickReply[] }
): Promise<MetaSendResult> {
  return postMetaMessage(
    env,
    p.recipientId,
    {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: p.card.title,
              ...(p.card.subtitle ? { subtitle: p.card.subtitle } : {}),
              buttons: p.card.buttons.slice(0, 3).map((b) => ({ type: "web_url", url: b.url, title: b.title })),
            },
          ],
        },
      },
      ...quickReplyField(p.quickReplies),
    },
    p.humanAgent
  );
}

function quickReplyField(quickReplies?: MetaQuickReply[]) {
  return quickReplies?.length
    ? { quick_replies: quickReplies.map((q) => ({ content_type: "text", title: q.title, payload: q.payload })) }
    : {};
}

async function postMetaMessage(
  env: MetaEnv,
  recipientId: string,
  message: Record<string, unknown>,
  humanAgent?: boolean
): Promise<MetaSendResult> {
  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.pageAccessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: humanAgent ? "MESSAGE_TAG" : "RESPONSE",
      ...(humanAgent ? { tag: "HUMAN_AGENT" } : {}),
      message,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    message_id?: string;
    error?: { message?: string; code?: number };
  };
  if (!res.ok || !json.message_id) {
    return { ok: false, error: json.error?.message ?? `Meta send failed (${res.status})` };
  }
  return { ok: true, messageId: json.message_id };
}

export type MetaProfile = { name: string | null; username: string | null };

/* Who a Page-scoped or Instagram-scoped id belongs to. Messenger gives a
   first and last name; Instagram gives the username as well. Either call can
   be refused for people outside the app's roles while it is in development,
   so a failure is just an empty profile. */
export async function fetchMetaProfile(env: MetaEnv, channel: MetaChannel, id: string): Promise<MetaProfile> {
  const fields = channel === "instagram" ? "name,username" : "first_name,last_name";
  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(id)}?fields=${fields}`,
    { headers: { authorization: `Bearer ${env.pageAccessToken}` } }
  );
  if (!res.ok) return { name: null, username: null };
  const json = (await res.json().catch(() => ({}))) as {
    name?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  const name = json.name ?? [json.first_name, json.last_name].filter(Boolean).join(" ");
  return { name: name?.trim() || null, username: json.username?.trim() || null };
}
