import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, EMAIL_REPLY_DOMAIN } from "@/lib/email";
import {
  bareAddress,
  correspondenceReplyAddress,
  htmlToPlainText,
  parseCorrespondenceAddress,
  safeAttachmentName,
  type CorrespondenceMessage,
  type CorrespondenceTarget,
  type EmailAttachment,
} from "./correspondence";

export const EMAIL_ATTACHMENTS_BUCKET = "email-attachments";
const SIGNED_URL_SECONDS = 60 * 60;

type Links = { bandRequestId?: string | null; musicActId?: string | null };

function replyTarget(links: Links): CorrespondenceTarget | null {
  if (links.bandRequestId) return { kind: "band", id: links.bandRequestId };
  if (links.musicActId) return { kind: "act", id: links.musicActId };
  return null;
}

/* Sends an email to a band and records it in the thread. Logging failures are
   reported but never stop the email, which has already gone. */
export async function sendCorrespondenceEmail(p: {
  resend: Resend;
  links: Links;
  to: string;
  subject: string;
  html: string;
  kind: string;
  sentBy?: number | null;
  inReplyTo?: string | null;
}): Promise<{ error: string | null }> {
  const target = replyTarget(p.links);
  const replyTo = target ? correspondenceReplyAddress(target, EMAIL_REPLY_DOMAIN) : null;
  const headers = p.inReplyTo ? { "In-Reply-To": p.inReplyTo, References: p.inReplyTo } : undefined;

  const { data, error } = await p.resend.emails.send({
    from: EMAIL_FROM,
    to: p.to,
    subject: p.subject,
    html: p.html,
    ...(replyTo ? { replyTo } : {}),
    ...(headers ? { headers } : {}),
  });
  if (error) {
    console.error(`[correspondence ${p.kind}] Resend failed:`, JSON.stringify(error));
    return { error: error.message ?? "Email failed to send." };
  }

  const admin = createAdminClient();
  let musicActId = p.links.musicActId ?? null;
  if (!musicActId && p.links.bandRequestId) {
    const { data: req } = await admin
      .from("band_booking_requests")
      .select("music_acts_id")
      .eq("id", p.links.bandRequestId)
      .maybeSingle();
    musicActId = (req?.music_acts_id as string | null) ?? null;
  }

  const { error: logError } = await admin.from("email_messages").insert({
    band_booking_request_id: p.links.bandRequestId ?? null,
    music_act_id: musicActId,
    direction: "outbound",
    kind: p.kind,
    from_address: bareAddress(EMAIL_FROM),
    to_addresses: [p.to],
    subject: p.subject,
    text_body: htmlToPlainText(p.html),
    html_body: p.html,
    resend_email_id: data?.id ?? null,
    in_reply_to: p.inReplyTo ?? null,
    sent_by: p.sentBy ?? null,
  });
  if (logError) console.error(`[correspondence ${p.kind}] log failed:`, logError.code, logError.message);

  return { error: null };
}

type MessageRow = {
  id: string;
  direction: "outbound" | "inbound";
  kind: string | null;
  from_address: string;
  to_addresses: string[] | null;
  subject: string;
  text_body: string;
  attachments: EmailAttachment[] | null;
  read_at: string | null;
  band_booking_request_id: string | null;
  created_at: string;
  sender: { full_name: string | null } | { full_name: string | null }[] | null;
};

export async function loadCorrespondence(
  supabase: SupabaseClient,
  filter: { bandRequestId: string } | { musicActId: string }
): Promise<CorrespondenceMessage[]> {
  let query = supabase
    .from("email_messages")
    .select(
      "id, direction, kind, from_address, to_addresses, subject, text_body, attachments, read_at, band_booking_request_id, created_at, sender:employees!email_messages_sent_by_fkey(full_name)"
    )
    .order("created_at", { ascending: true });
  query =
    "bandRequestId" in filter
      ? query.eq("band_booking_request_id", filter.bandRequestId)
      : query.eq("music_act_id", filter.musicActId);

  const { data, error } = await query;
  if (error) {
    console.error("[correspondence] load failed:", error.code, error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as MessageRow[];

  const paths = rows.flatMap((r) => (r.attachments ?? []).map((a) => a.path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(EMAIL_ATTACHMENTS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return rows.map((r) => {
    const sender = Array.isArray(r.sender) ? r.sender[0] : r.sender;
    return {
      id: r.id,
      direction: r.direction,
      kind: r.kind,
      fromAddress: r.from_address,
      toAddresses: r.to_addresses ?? [],
      subject: r.subject,
      textBody: r.text_body,
      attachments: (r.attachments ?? []).map((a) => ({ ...a, url: urls.get(a.path) ?? null })),
      readAt: r.read_at,
      sentByName: sender?.full_name ?? null,
      bandRequestId: r.band_booking_request_id,
      createdAt: r.created_at,
    };
  });
}

/* The latest inbound message is what a staff reply answers: its subject and
   Message-ID keep the band's mail app threading the conversation. */
export async function latestInbound(
  supabase: SupabaseClient,
  filter: { bandRequestId: string } | { musicActId: string }
): Promise<{ subject: string; messageId: string | null; fromAddress: string } | null> {
  let query = supabase
    .from("email_messages")
    .select("subject, message_id, from_address")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1);
  query =
    "bandRequestId" in filter
      ? query.eq("band_booking_request_id", filter.bandRequestId)
      : query.eq("music_act_id", filter.musicActId);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  return {
    subject: data.subject as string,
    messageId: (data.message_id as string | null) ?? null,
    fromAddress: data.from_address as string,
  };
}

export async function latestSubject(
  supabase: SupabaseClient,
  filter: { bandRequestId: string } | { musicActId: string }
): Promise<string | null> {
  let query = supabase
    .from("email_messages")
    .select("subject")
    .order("created_at", { ascending: false })
    .limit(1);
  query =
    "bandRequestId" in filter
      ? query.eq("band_booking_request_id", filter.bandRequestId)
      : query.eq("music_act_id", filter.musicActId);
  const { data } = await query.maybeSingle();
  return (data?.subject as string | undefined) ?? null;
}

async function resolveInboundLinks(
  admin: SupabaseClient,
  recipients: string[],
  fromAddress: string,
  inReplyTo: string | null
): Promise<{ bandRequestId: string | null; musicActId: string | null }> {
  const target = parseCorrespondenceAddress(recipients, EMAIL_REPLY_DOMAIN);

  if (target?.kind === "band") {
    const { data } = await admin
      .from("band_booking_requests")
      .select("id, music_acts_id")
      .eq("id", target.id)
      .maybeSingle();
    if (data) return { bandRequestId: data.id as string, musicActId: (data.music_acts_id as string | null) ?? null };
  }
  if (target?.kind === "act") {
    const { data } = await admin.from("music_acts").select("id").eq("id", target.id).maybeSingle();
    if (data) return { bandRequestId: null, musicActId: data.id as string };
  }

  if (inReplyTo) {
    const { data } = await admin
      .from("email_messages")
      .select("band_booking_request_id, music_act_id")
      .eq("message_id", inReplyTo)
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        bandRequestId: (data.band_booking_request_id as string | null) ?? null,
        musicActId: (data.music_act_id as string | null) ?? null,
      };
    }
  }

  const { data: latest } = await admin
    .from("band_booking_requests")
    .select("id, music_acts_id")
    .ilike("email", bareAddress(fromAddress).replace(/[%_\\]/g, "\\$&"))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest) return { bandRequestId: latest.id as string, musicActId: (latest.music_acts_id as string | null) ?? null };

  return { bandRequestId: null, musicActId: null };
}

/* Called by the Resend inbound webhook. The event only carries metadata, so the
   body and attachments are fetched from Resend; attachments are copied into
   Storage because Resend's download links expire. Safe to call twice for the
   same email - the unique index on resend_email_id drops the repeat. */
export async function storeInboundEmail(resend: Resend, emailId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("email_messages")
    .select("id")
    .eq("direction", "inbound")
    .eq("resend_email_id", emailId)
    .maybeSingle();
  if (existing) return;

  const { data: email, error } = await resend.emails.receiving.get(emailId);
  if (error || !email) throw new Error(`Could not fetch received email ${emailId}: ${error?.message ?? "not found"}`);

  const headers = Object.fromEntries(
    Object.entries(email.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const inReplyTo = headers["in-reply-to"]?.trim() || null;
  const recipients = [...(email.to ?? []), ...(email.cc ?? []), ...(email.received_for ?? [])];
  const links = await resolveInboundLinks(admin, recipients, email.from, inReplyTo);

  const folder = `${links.bandRequestId ?? links.musicActId ?? "unmatched"}/${emailId}`;
  const attachments: EmailAttachment[] = [];
  if ((email.attachments ?? []).length > 0) {
    const { data: list } = await resend.emails.receiving.attachments.list({ emailId });
    for (const [i, a] of (list?.data ?? []).entries()) {
      if (a.content_disposition === "inline" && a.content_id) continue;
      try {
        const res = await fetch(a.download_url);
        if (!res.ok) throw new Error(`download ${res.status}`);
        const name = safeAttachmentName(a.filename, `attachment-${i + 1}`);
        const path = `${folder}/${i + 1}-${name}`;
        const { error: upErr } = await admin.storage
          .from(EMAIL_ATTACHMENTS_BUCKET)
          .upload(path, await res.arrayBuffer(), { contentType: a.content_type, upsert: true });
        if (upErr) throw upErr;
        attachments.push({ name, path, size: a.size, contentType: a.content_type });
      } catch (e) {
        console.error(`[correspondence inbound] attachment ${a.id} failed:`, e);
      }
    }
  }

  const textBody = email.text?.trim() || (email.html ? htmlToPlainText(email.html) : "");

  const { error: insertError } = await admin.from("email_messages").insert({
    band_booking_request_id: links.bandRequestId,
    music_act_id: links.musicActId,
    direction: "inbound",
    kind: "reply",
    from_address: email.from,
    to_addresses: email.to ?? [],
    subject: email.subject ?? "",
    text_body: textBody,
    html_body: email.html,
    resend_email_id: emailId,
    message_id: email.message_id ?? null,
    in_reply_to: inReplyTo,
    attachments,
  });
  if (insertError && insertError.code !== "23505") {
    throw new Error(`Could not store received email ${emailId}: ${insertError.message}`);
  }
}
