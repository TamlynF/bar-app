"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseUkMobile } from "@/lib/sms/phone";
import { checkSmsVerification, smsAlertsEnabled, startSmsVerification, whatsappAlertsEnabled } from "@/lib/sms/twilio";
import { emailAlertsEnabled, sendVerificationEmail } from "@/lib/market/email-alerts";
import { VERIFICATION_CODE_TTL_MIN } from "@/lib/market/email-copy";
import {
  VERIFICATION_MAX_ATTEMPTS,
  generateVerificationCode,
  hashVerificationCode,
  normaliseEmail,
  verificationCodeMatches,
} from "@/lib/market/verification-code";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine((value) => value.startsWith("https://"), "Push endpoints must be https"),
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(128),
  watchedInstrumentIds: z.array(z.number().int().positive()).max(200),
  userAgent: z.string().max(512).optional(),
});

export type SaveMarketPushSubscriptionInput = z.infer<typeof subscriptionSchema>;

export type MarketPushActionResult = { ok: true } | { ok: false; error: string };

export async function saveMarketPushSubscription(input: unknown): Promise<MarketPushActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That subscription didn't look right." };

  const { endpoint, p256dh, auth, watchedInstrumentIds, userAgent } = parsed.data;
  const supabase = createAdminClient();
  const { error } = await supabase.from("market_push_subscriptions").upsert(
    {
      endpoint,
      p256dh,
      auth,
      watched_instrument_ids: watchedInstrumentIds,
      user_agent: userAgent ?? null,
      last_error: null,
      failed_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    console.error("[market] push subscription save failed:", error);
    return { ok: false, error: "Couldn't save your alerts. Try again in a moment." };
  }
  return { ok: true };
}

export async function removeMarketPushSubscription(endpoint: string): Promise<MarketPushActionResult> {
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return { ok: false, error: "Unknown subscription." };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("market_push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    console.error("[market] push subscription delete failed:", error);
    return { ok: false, error: "Couldn't turn alerts off. Try again in a moment." };
  }
  return { ok: true };
}

const phoneSchema = z.string().min(1).max(32);
const watchedSchema = z.array(z.number().int().positive()).max(200);

const startSmsSchema = z.object({ phone: phoneSchema, watchedInstrumentIds: watchedSchema });
const confirmSmsSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{4,10}$/),
  watchedInstrumentIds: watchedSchema,
});
const manageSmsSchema = z.object({ phone: phoneSchema, token: z.uuid() });
const updateSmsSchema = manageSmsSchema.extend({ watchedInstrumentIds: watchedSchema });

export type SmsSubscriptionHandle = { phone: string; token: string };

export type StartSmsAlertsResult =
  | { ok: true; phone: string; verified: false }
  | { ok: false; error: string };

export type ConfirmSmsAlertsResult = { ok: true; handle: SmsSubscriptionHandle } | { ok: false; error: string };

const SMS_UNAVAILABLE = "Text alerts aren't switched on right now.";
const SMS_BAD_NUMBER = "Enter a UK mobile number, like 07700 900123.";

export async function startSmsAlerts(input: unknown): Promise<StartSmsAlertsResult> {
  if (!smsAlertsEnabled()) return { ok: false, error: SMS_UNAVAILABLE };
  const parsed = startSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: SMS_BAD_NUMBER };
  const phone = normaliseUkMobile(parsed.data.phone);
  if (!phone) return { ok: false, error: SMS_BAD_NUMBER };

  const result = await startSmsVerification(phone);
  if (!result.ok) {
    console.error("[market] sms verification start failed:", result.message);
    return { ok: false, error: "Couldn't send the code. Check the number and try again." };
  }
  return { ok: true, phone, verified: false };
}

export async function confirmSmsAlerts(input: unknown): Promise<ConfirmSmsAlertsResult> {
  if (!smsAlertsEnabled()) return { ok: false, error: SMS_UNAVAILABLE };
  const parsed = confirmSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the code from the text." };
  const phone = normaliseUkMobile(parsed.data.phone);
  if (!phone) return { ok: false, error: SMS_BAD_NUMBER };

  const check = await checkSmsVerification(phone, parsed.data.code);
  if (!check.ok) {
    console.error("[market] sms verification check failed:", check.message);
    return { ok: false, error: "Couldn't check that code. Try again in a moment." };
  }
  if (!check.approved) return { ok: false, error: "That code didn't match. Check the text and try again." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_sms_subscriptions")
    .upsert(
      {
        phone,
        watched_instrument_ids: parsed.data.watchedInstrumentIds,
        opted_out_at: null,
        last_error: null,
        failed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" }
    )
    .select("manage_token")
    .single();
  if (error || !data) {
    console.error("[market] sms subscription save failed:", error);
    return { ok: false, error: "Couldn't save your alerts. Try again in a moment." };
  }
  return { ok: true, handle: { phone, token: data.manage_token as string } };
}

export async function updateSmsWatched(input: unknown): Promise<MarketPushActionResult> {
  const parsed = updateSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown subscription." };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("market_sms_subscriptions")
    .update({ watched_instrument_ids: parsed.data.watchedInstrumentIds, updated_at: new Date().toISOString() })
    .eq("phone", parsed.data.phone)
    .eq("manage_token", parsed.data.token);
  if (error) {
    console.error("[market] sms watched update failed:", error);
    return { ok: false, error: "Couldn't update your alerts. Try again in a moment." };
  }
  return { ok: true };
}

export async function stopSmsAlerts(input: unknown): Promise<MarketPushActionResult> {
  const parsed = manageSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown subscription." };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("market_sms_subscriptions")
    .update({ opted_out_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("phone", parsed.data.phone)
    .eq("manage_token", parsed.data.token);
  if (error) {
    console.error("[market] sms stop failed:", error);
    return { ok: false, error: "Couldn't turn texts off. Try again in a moment." };
  }
  return { ok: true };
}

const emailSchema = z.string().min(3).max(254);
const startEmailSchema = z.object({ email: emailSchema, watchedInstrumentIds: watchedSchema });
const confirmEmailSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
  watchedInstrumentIds: watchedSchema,
});
const manageEmailSchema = z.object({ email: emailSchema, token: z.uuid() });
const updateEmailSchema = manageEmailSchema.extend({ watchedInstrumentIds: watchedSchema });

export type EmailSubscriptionHandle = { email: string; token: string };

export type StartEmailAlertsResult = { ok: true; email: string } | { ok: false; error: string };
export type ConfirmEmailAlertsResult = { ok: true; handle: EmailSubscriptionHandle } | { ok: false; error: string };

const EMAIL_UNAVAILABLE = "Email alerts aren't switched on right now.";
const EMAIL_BAD_ADDRESS = "Enter an email address, like you@example.com.";
const CODE_RESEND_GAP_MS = 60 * 1000;

export async function startEmailAlerts(input: unknown): Promise<StartEmailAlertsResult> {
  if (!emailAlertsEnabled()) return { ok: false, error: EMAIL_UNAVAILABLE };
  const parsed = startEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: EMAIL_BAD_ADDRESS };
  const email = normaliseEmail(parsed.data.email);
  if (!email) return { ok: false, error: EMAIL_BAD_ADDRESS };

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("market_email_subscriptions")
    .select("code_sent_at")
    .eq("email", email)
    .maybeSingle();
  const lastSent = existing?.code_sent_at ? new Date(existing.code_sent_at as string).getTime() : 0;
  if (Date.now() - lastSent < CODE_RESEND_GAP_MS) {
    return { ok: false, error: "We've just sent a code - give it a minute, then try again." };
  }

  const code = generateVerificationCode();
  const now = new Date();
  const { error } = await supabase.from("market_email_subscriptions").upsert(
    {
      email,
      watched_instrument_ids: parsed.data.watchedInstrumentIds,
      verify_code_hash: hashVerificationCode(email, code),
      verify_expires_at: new Date(now.getTime() + VERIFICATION_CODE_TTL_MIN * 60 * 1000).toISOString(),
      verify_attempts: 0,
      code_sent_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "email" }
  );
  if (error) {
    console.error("[market] email subscription save failed:", error);
    return { ok: false, error: "Couldn't save your alerts. Try again in a moment." };
  }

  const sent = await sendVerificationEmail(email, code);
  if (!sent.ok) {
    console.error("[market] email verification send failed:", sent.message);
    return { ok: false, error: "Couldn't send the code. Check the address and try again." };
  }
  return { ok: true, email };
}

export async function confirmEmailAlerts(input: unknown): Promise<ConfirmEmailAlertsResult> {
  if (!emailAlertsEnabled()) return { ok: false, error: EMAIL_UNAVAILABLE };
  const parsed = confirmEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the six-digit code from the email." };
  const email = normaliseEmail(parsed.data.email);
  if (!email) return { ok: false, error: EMAIL_BAD_ADDRESS };

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("market_email_subscriptions")
    .select("verify_code_hash, verify_expires_at, verify_attempts")
    .eq("email", email)
    .maybeSingle();
  if (error || !row) return { ok: false, error: "Ask for a new code and try again." };

  const expired = !row.verify_expires_at || new Date(row.verify_expires_at as string).getTime() < Date.now();
  const attempts = (row.verify_attempts as number) ?? 0;
  if (expired || attempts >= VERIFICATION_MAX_ATTEMPTS) {
    return { ok: false, error: "That code has expired. Ask for a new one." };
  }
  if (!verificationCodeMatches(email, parsed.data.code, row.verify_code_hash as string | null)) {
    const { error: attemptError } = await supabase
      .from("market_email_subscriptions")
      .update({ verify_attempts: attempts + 1 })
      .eq("email", email);
    if (attemptError) console.error("[market] email verification attempt update failed:", attemptError);
    return { ok: false, error: "That code didn't match. Check the email and try again." };
  }

  const now = new Date().toISOString();
  const { data, error: saveError } = await supabase
    .from("market_email_subscriptions")
    .update({
      verified_at: now,
      verify_code_hash: null,
      verify_expires_at: null,
      verify_attempts: 0,
      watched_instrument_ids: parsed.data.watchedInstrumentIds,
      opted_out_at: null,
      last_error: null,
      failed_at: null,
      updated_at: now,
    })
    .eq("email", email)
    .select("manage_token")
    .single();
  if (saveError || !data) {
    console.error("[market] email subscription confirm failed:", saveError);
    return { ok: false, error: "Couldn't save your alerts. Try again in a moment." };
  }
  return { ok: true, handle: { email, token: data.manage_token as string } };
}

export async function updateEmailWatched(input: unknown): Promise<MarketPushActionResult> {
  const parsed = updateEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown subscription." };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("market_email_subscriptions")
    .update({ watched_instrument_ids: parsed.data.watchedInstrumentIds, updated_at: new Date().toISOString() })
    .eq("email", parsed.data.email)
    .eq("manage_token", parsed.data.token);
  if (error) {
    console.error("[market] email watched update failed:", error);
    return { ok: false, error: "Couldn't update your alerts. Try again in a moment." };
  }
  return { ok: true };
}

export async function stopEmailAlerts(input: unknown): Promise<MarketPushActionResult> {
  const parsed = manageEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown subscription." };
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("market_email_subscriptions")
    .update({ opted_out_at: now, updated_at: now })
    .eq("email", parsed.data.email)
    .eq("manage_token", parsed.data.token);
  if (error) {
    console.error("[market] email stop failed:", error);
    return { ok: false, error: "Couldn't turn emails off. Try again in a moment." };
  }
  return { ok: true };
}

export type WhatsappSubscriptionHandle = { phone: string; token: string };

export type StartWhatsappAlertsResult = { ok: true; phone: string } | { ok: false; error: string };
export type ConfirmWhatsappAlertsResult = { ok: true; handle: WhatsappSubscriptionHandle } | { ok: false; error: string };

const WHATSAPP_UNAVAILABLE = "WhatsApp alerts aren't switched on right now.";

export async function startWhatsappAlerts(input: unknown): Promise<StartWhatsappAlertsResult> {
  if (!whatsappAlertsEnabled()) return { ok: false, error: WHATSAPP_UNAVAILABLE };
  const parsed = startSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: SMS_BAD_NUMBER };
  const phone = normaliseUkMobile(parsed.data.phone);
  if (!phone) return { ok: false, error: SMS_BAD_NUMBER };

  const result = await startSmsVerification(phone, "whatsapp");
  if (!result.ok) {
    console.error("[market] whatsapp verification start failed:", result.message);
    return { ok: false, error: "Couldn't send the code on WhatsApp. Check the number is on WhatsApp and try again." };
  }
  return { ok: true, phone };
}

export async function confirmWhatsappAlerts(input: unknown): Promise<ConfirmWhatsappAlertsResult> {
  if (!whatsappAlertsEnabled()) return { ok: false, error: WHATSAPP_UNAVAILABLE };
  const parsed = confirmSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the code from the WhatsApp message." };
  const phone = normaliseUkMobile(parsed.data.phone);
  if (!phone) return { ok: false, error: SMS_BAD_NUMBER };

  const check = await checkSmsVerification(phone, parsed.data.code);
  if (!check.ok) {
    console.error("[market] whatsapp verification check failed:", check.message);
    return { ok: false, error: "Couldn't check that code. Try again in a moment." };
  }
  if (!check.approved) return { ok: false, error: "That code didn't match. Check the message and try again." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_whatsapp_subscriptions")
    .upsert(
      {
        phone,
        watched_instrument_ids: parsed.data.watchedInstrumentIds,
        opted_out_at: null,
        last_error: null,
        failed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" }
    )
    .select("manage_token")
    .single();
  if (error || !data) {
    console.error("[market] whatsapp subscription save failed:", error);
    return { ok: false, error: "Couldn't save your alerts. Try again in a moment." };
  }
  return { ok: true, handle: { phone, token: data.manage_token as string } };
}

export async function updateWhatsappWatched(input: unknown): Promise<MarketPushActionResult> {
  const parsed = updateSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown subscription." };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("market_whatsapp_subscriptions")
    .update({ watched_instrument_ids: parsed.data.watchedInstrumentIds, updated_at: new Date().toISOString() })
    .eq("phone", parsed.data.phone)
    .eq("manage_token", parsed.data.token);
  if (error) {
    console.error("[market] whatsapp watched update failed:", error);
    return { ok: false, error: "Couldn't update your alerts. Try again in a moment." };
  }
  return { ok: true };
}

export async function stopWhatsappAlerts(input: unknown): Promise<MarketPushActionResult> {
  const parsed = manageSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown subscription." };
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("market_whatsapp_subscriptions")
    .update({ opted_out_at: now, updated_at: now })
    .eq("phone", parsed.data.phone)
    .eq("manage_token", parsed.data.token);
  if (error) {
    console.error("[market] whatsapp stop failed:", error);
    return { ok: false, error: "Couldn't turn WhatsApp alerts off. Try again in a moment." };
  }
  return { ok: true };
}
