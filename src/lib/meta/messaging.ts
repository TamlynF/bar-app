import { createHmac, timingSafeEqual } from "node:crypto";

export const META_GRAPH_VERSION = "v21.0";

export type MetaChannel = "messenger" | "instagram";

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
        sentAt: new Date(event.timestamp ?? entry.time ?? Date.now()).toISOString(),
        isEcho: message.is_echo === true,
      });
    }
  }
  return out;
}

export type MetaSendResult = { ok: true; messageId: string } | { ok: false; error: string };

/* A plain-text reply to someone who has messaged the Page or the Instagram
   account. Both products share the Send API; the Page token covers both once
   the Instagram account is linked to the Page. */
export async function sendMetaText(
  env: MetaEnv,
  p: { recipientId: string; text: string; humanAgent?: boolean }
): Promise<MetaSendResult> {
  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.pageAccessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: p.recipientId },
      messaging_type: p.humanAgent ? "MESSAGE_TAG" : "RESPONSE",
      ...(p.humanAgent ? { tag: "HUMAN_AGENT" } : {}),
      message: { text: p.text },
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
