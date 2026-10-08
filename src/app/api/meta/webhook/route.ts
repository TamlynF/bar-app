import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeInboundMetaMessage } from "@/lib/meta/inbound";
import {
  parseMetaWebhook,
  readMetaEnv,
  verifyMetaSignature,
  webhookChallenge,
  type InboundMetaMessage,
} from "@/lib/meta/messaging";
import { sendMetaMessage, venueName } from "@/lib/meta/outbound";
import { CHANNEL_LABELS } from "@/lib/meta/channels";
import { bandOfferAckText, parseBandOfferPayload } from "@/lib/band-offer-message";
import { bandOfferPagePath, respondAsAct } from "@/lib/band-flow";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

/* A tap on one of the offer's quick replies is the same answer as a click on
   the offer page, acknowledged with a short message back on the chat. The
   tapped title has already been filed as their message. */
async function answerOfferQuickReply(m: InboundMetaMessage): Promise<void> {
  const tap = parseBandOfferPayload(m.quickReplyPayload);
  if (!tap) return;
  const admin = createAdminClient();
  const discussNote = `Tapped "Let's discuss" on ${CHANNEL_LABELS[m.channel]} - reply on the chat.`;
  const result = await respondAsAct(
    { supabase: admin, resend, actorId: null },
    tap.requestId,
    tap.response,
    tap.response === "discuss" ? discussNote : null
  );
  const { data: request } = await admin
    .from("band_booking_requests")
    .select("music_acts_id, contact_id")
    .eq("id", tap.requestId)
    .maybeSingle();
  const text = result.ok ? bandOfferAckText(tap.response, result.status, await venueName(admin)) : result.error;
  await sendMetaMessage(admin, {
    target: { channel: m.channel, externalId: m.senderId, handle: null, lastInboundAt: m.sentAt },
    text,
    kind: "message",
    links: {
      bandRequestId: tap.requestId,
      musicActId: (request?.music_acts_id as string | null) ?? null,
      contactId: (request?.contact_id as number | null) ?? null,
    },
    sentBy: null,
  });
  if (!result.ok) return;
  revalidatePath(bandOfferPagePath(tap.requestId));
  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
  revalidatePath("/");
}

/* Meta's one-off handshake when the callback URL is saved in the app dashboard. */
export async function GET(req: NextRequest) {
  const env = readMetaEnv();
  if (!env) return NextResponse.json({ error: "Meta messaging not configured" }, { status: 503 });

  const params = req.nextUrl.searchParams;
  const challenge = webhookChallenge(
    {
      mode: params.get("hub.mode"),
      token: params.get("hub.verify_token"),
      challenge: params.get("hub.challenge"),
    },
    env.verifyToken
  );
  if (!challenge) return NextResponse.json({ error: "Verification failed" }, { status: 403 });
  return new NextResponse(challenge, { headers: { "content-type": "text/plain" } });
}

/* Every Messenger and Instagram event for the subscribed Page lands here.
   Meta retries on anything but a 200, so bad signatures are the only refusal;
   a message that cannot be stored is logged rather than bounced back. */
export async function POST(req: NextRequest) {
  const env = readMetaEnv();
  if (!env) return NextResponse.json({ error: "Meta messaging not configured" }, { status: 503 });

  const rawBody = await req.text();
  if (!verifyMetaSignature(env.appSecret, rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  for (const message of parseMetaWebhook(body)) {
    if (message.isEcho) continue;
    try {
      const outcome = await storeInboundMetaMessage(env, message);
      console.log(
        `[meta ${message.channel}] from ${message.senderId}: ${message.text || `(${message.attachments.length} attachment(s))`} -> ${
          outcome.stored ? `stored, contact ${outcome.contactId ?? "unmatched"}, request ${outcome.bandRequestId ?? "none"}` : "not stored"
        }`
      );
      if (outcome.stored) await answerOfferQuickReply(message);
    } catch (e) {
      console.error(`[meta ${message.channel}] store threw:`, e);
    }
  }
  return NextResponse.json({ ok: true });
}
