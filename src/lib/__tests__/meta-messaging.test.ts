import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseMetaWebhook, verifyMetaSignature, webhookChallenge } from "@/lib/meta/messaging";

const SECRET = "app-secret";
const sign = (body: string) => `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;

describe("webhookChallenge", () => {
  it("echoes the challenge only for a subscribe with the right token", () => {
    expect(webhookChallenge({ mode: "subscribe", token: "t", challenge: "123" }, "t")).toBe("123");
    expect(webhookChallenge({ mode: "subscribe", token: "wrong", challenge: "123" }, "t")).toBeNull();
    expect(webhookChallenge({ mode: "unsubscribe", token: "t", challenge: "123" }, "t")).toBeNull();
    expect(webhookChallenge({ mode: "subscribe", token: "t", challenge: null }, "t")).toBeNull();
  });
});

describe("verifyMetaSignature", () => {
  it("accepts Meta's sha256 header for the raw body and nothing else", () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    expect(verifyMetaSignature(SECRET, body, sign(body))).toBe(true);
    expect(verifyMetaSignature(SECRET, body + " ", sign(body))).toBe(false);
    expect(verifyMetaSignature("other", body, sign(body))).toBe(false);
    expect(verifyMetaSignature(SECRET, body, null)).toBe(false);
    expect(verifyMetaSignature(SECRET, body, "sha1=abc")).toBe(false);
  });
});

describe("parseMetaWebhook", () => {
  const event = (over: Record<string, unknown> = {}) => ({
    sender: { id: "psid-1" },
    recipient: { id: "page-1" },
    timestamp: 1_760_000_000_000,
    message: { mid: "m1", text: "Yes, we accept", ...over },
  });

  it("flattens Messenger messages and labels the channel", () => {
    const [m] = parseMetaWebhook({ object: "page", entry: [{ id: "page-1", messaging: [event()] }] });
    expect(m).toMatchObject({
      channel: "messenger",
      senderId: "psid-1",
      recipientId: "page-1",
      messageId: "m1",
      text: "Yes, we accept",
      isEcho: false,
    });
    expect(m.sentAt).toBe(new Date(1_760_000_000_000).toISOString());
  });

  it("labels Instagram traffic and keeps attachments", () => {
    const [m] = parseMetaWebhook({
      object: "instagram",
      entry: [
        {
          id: "ig-1",
          messaging: [event({ text: undefined, attachments: [{ type: "image", payload: { url: "https://x/y.jpg" } }] })],
        },
      ],
    });
    expect(m.channel).toBe("instagram");
    expect(m.text).toBe("");
    expect(m.attachments).toEqual([{ type: "image", url: "https://x/y.jpg" }]);
  });

  it("skips receipts, reads and unknown objects", () => {
    expect(parseMetaWebhook({ object: "page", entry: [{ messaging: [{ sender: { id: "a" }, delivery: {} }] }] })).toEqual([]);
    expect(parseMetaWebhook({ object: "user", entry: [{ messaging: [event()] }] })).toEqual([]);
    expect(parseMetaWebhook(null)).toEqual([]);
  });

  it("carries a tapped quick reply's payload", () => {
    const [m] = parseMetaWebhook({
      object: "instagram",
      entry: [{ messaging: [event({ text: "Yes, I accept", quick_reply: { payload: "band_offer:x:accept" } })] }],
    });
    expect(m.quickReplyPayload).toBe("band_offer:x:accept");
    expect(parseMetaWebhook({ object: "page", entry: [{ messaging: [event()] }] })[0].quickReplyPayload).toBeNull();
  });

  it("marks the Page's own outbound copies as echoes", () => {
    const [m] = parseMetaWebhook({ object: "page", entry: [{ messaging: [event({ is_echo: true })] }] });
    expect(m.isEcho).toBe(true);
  });
});
