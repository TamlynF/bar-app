import { NextRequest, NextResponse } from "next/server";
import { parseMetaWebhook, readMetaEnv, verifyMetaSignature, webhookChallenge } from "@/lib/meta/messaging";

export const dynamic = "force-dynamic";

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
   Meta retries on anything but a 200, so bad signatures are the only refusal. */
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
    console.log(
      `[meta ${message.channel}] from ${message.senderId}: ${message.text || `(${message.attachments.length} attachment(s))`}`
    );
  }
  return NextResponse.json({ ok: true });
}
