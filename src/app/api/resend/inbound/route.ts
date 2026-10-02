import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { storeInboundEmail } from "@/lib/email/correspondence-data";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[resend inbound] RESEND_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const payload = await req.text();
  const resend = new Resend(process.env.RESEND_API_KEY);

  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: WEBHOOK_SECRET,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "email.received") return NextResponse.json({ ok: true });

  try {
    await storeInboundEmail(resend, event.data.email_id);
  } catch (e) {
    console.error("[resend inbound]", e);
    return NextResponse.json({ error: "Could not store email" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
