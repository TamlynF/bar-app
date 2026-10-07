import { createHmac, timingSafeEqual } from "node:crypto";

/* Twilio REST calls over fetch - Messages for the alerts, Verify for the
   sign-up code. The whole SMS channel switches on when every env key below
   is present and stays "coming soon" otherwise. */

type TwilioEnv = {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
  from: string;
};

export type SmsSendResult =
  | { ok: true; sid: string }
  | { ok: false; status: number; code: number | null; message: string; optedOut: boolean };

const UNSUBSCRIBED_ERROR_CODES = new Set([21610]);

export function readTwilioEnv(): TwilioEnv | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const from = process.env.TWILIO_SMS_FROM;
  if (!accountSid || !authToken || !verifyServiceSid || !from) return null;
  return { accountSid, authToken, verifyServiceSid, from };
}

export function smsAlertsEnabled(): boolean {
  return readTwilioEnv() != null;
}

async function twilioPost(env: TwilioEnv, url: string, form: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { response, json };
}

export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const env = readTwilioEnv();
  if (!env) return { ok: false, status: 0, code: null, message: "SMS not configured", optedOut: false };
  const sender: Record<string, string> = env.from.startsWith("MG")
    ? { MessagingServiceSid: env.from }
    : { From: env.from };
  const { response, json } = await twilioPost(
    env,
    `https://api.twilio.com/2010-04-01/Accounts/${env.accountSid}/Messages.json`,
    { To: to, Body: body, ...sender }
  );
  if (response.ok && typeof json.sid === "string") return { ok: true, sid: json.sid };
  const code = typeof json.code === "number" ? json.code : null;
  return {
    ok: false,
    status: response.status,
    code,
    message: typeof json.message === "string" ? json.message : response.statusText,
    optedOut: code != null && UNSUBSCRIBED_ERROR_CODES.has(code),
  };
}

export async function startSmsVerification(to: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const env = readTwilioEnv();
  if (!env) return { ok: false, message: "SMS not configured" };
  const { response, json } = await twilioPost(
    env,
    `https://verify.twilio.com/v2/Services/${env.verifyServiceSid}/Verifications`,
    { To: to, Channel: "sms" }
  );
  if (response.ok) return { ok: true };
  return { ok: false, message: typeof json.message === "string" ? json.message : response.statusText };
}

export async function checkSmsVerification(
  to: string,
  code: string
): Promise<{ ok: true; approved: boolean } | { ok: false; message: string }> {
  const env = readTwilioEnv();
  if (!env) return { ok: false, message: "SMS not configured" };
  const { response, json } = await twilioPost(
    env,
    `https://verify.twilio.com/v2/Services/${env.verifyServiceSid}/VerificationCheck`,
    { To: to, Code: code }
  );
  if (response.ok) return { ok: true, approved: json.status === "approved" };
  return { ok: false, message: typeof json.message === "string" ? json.message : response.statusText };
}

/* Twilio signs webhooks with HMAC-SHA1 over the full URL followed by every
   form field, sorted by name, each appended as key then value. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => `${acc}${key}${params[key]}`, url);
  return createHmac("sha1", authToken).update(payload).digest("base64");
}

export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
