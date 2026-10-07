import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseUkMobile } from "@/lib/sms/phone";
import { readTwilioEnv, verifyTwilioSignature } from "@/lib/sms/twilio";
import { PHONE_CHANNEL_TABLE } from "@/lib/market/alert-stop";

export const dynamic = "force-dynamic";

/* Twilio posts every reply to the alert sender here. Twilio already blocks
   sends to a number that replied STOP; this keeps our own row in step so the
   tick stops trying, and lets START switch the texts back on. */
const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_WORDS = new Set(["START", "UNSTOP", "YES"]);

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function webhookUrl(req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return base ? `${base}/api/twilio/inbound` : req.url;
}

export async function POST(req: NextRequest) {
  const env = readTwilioEnv();
  if (!env) return NextResponse.json({ error: "SMS not configured" }, { status: 503 });

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!verifyTwilioSignature(env.authToken, webhookUrl(req), params, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const from = params.From ?? "";
  const channel = from.startsWith("whatsapp:") ? "whatsapp" : "sms";
  const phone = normaliseUkMobile(from.replace(/^whatsapp:/, ""));
  const word = (params.Body ?? "").trim().toUpperCase();
  if (phone && (STOP_WORDS.has(word) || START_WORDS.has(word))) {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(PHONE_CHANNEL_TABLE[channel])
      .update({ opted_out_at: STOP_WORDS.has(word) ? now : null, updated_at: now })
      .eq("phone", phone);
    if (error) console.error(`[market] ${channel} opt-out update failed:`, error);
  }

  return new NextResponse(EMPTY_TWIML, { headers: { "content-type": "text/xml" } });
}
