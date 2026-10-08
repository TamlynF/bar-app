import type { SupabaseClient } from "@supabase/supabase-js";
import { isMetaChannel, replyAllowance, type MessageChannel, type MetaChannel } from "@/lib/meta/channels";
import { bookingLinkFor } from "@/lib/meta/preferred-channel";
import type { RenderedSlots } from "./design";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyInvoiceReply, type ReceivedFile } from "@/lib/band-invoice-reply";
import { ADMIN_EMAIL, EMAIL_FROM, EMAIL_REPLY_DOMAIN } from "@/lib/email";
import {
  bareAddress,
  correspondenceReplyAddress,
  idRangeForRef,
  senderDisplayName,
  withDisplayName,
  htmlToPlainText,
  parseCorrespondenceAddress,
  safeAttachmentName,
  correspondenceColumn,
  type CorrespondenceFilter,
  type ThreadChannel,
  type CorrespondenceMessage,
  type CorrespondenceSource,
  type CorrespondenceTarget,
  type EmailAttachment,
} from "./correspondence";

export const EMAIL_ATTACHMENTS_BUCKET = "email-attachments";

export type OutboundAttachment = { filename: string; content: Buffer; contentType: string };

/* A template's own files, read with the service role at send time. A file
   that cannot be read is skipped and logged - a missing PDF must never stop a
   booking confirmation from going out. */
export async function loadTemplateAttachments(
  slots: RenderedSlots | null | undefined
): Promise<OutboundAttachment[]> {
  const files = slots?.design?.attachments ?? [];
  if (files.length === 0) return [];
  const admin = createAdminClient();
  const loaded = await Promise.all(
    files.map(async (f): Promise<OutboundAttachment | null> => {
      const { data, error } = await admin.storage.from(EMAIL_ATTACHMENTS_BUCKET).download(f.path);
      if (error || !data) {
        console.error(`[email templates] attachment ${f.path} could not be read:`, error?.message);
        return null;
      }
      return { filename: f.name, content: Buffer.from(await data.arrayBuffer()), contentType: f.contentType };
    })
  );
  return loaded.filter((a): a is OutboundAttachment => a !== null);
}

/* For the send sites that call Resend directly rather than through
   sendCorrespondenceEmail - spread the result into the send options. */
export async function resendTemplateAttachments(
  slots: RenderedSlots | null | undefined
): Promise<{ attachments?: { filename: string; content: Buffer }[] }> {
  const files = await loadTemplateAttachments(slots);
  return files.length ? { attachments: files.map((f) => ({ filename: f.filename, content: f.content })) } : {};
}
const SIGNED_URL_SECONDS = 60 * 60;

type Links = {
  bandRequestId?: string | null;
  musicActId?: string | null;
  privateHireRequestId?: string | null;
  enquiryId?: string | null;
  contactId?: number | null;
};

type ResolvedLinks = {
  bandRequestId: string | null;
  musicActId: string | null;
  privateHireRequestId: string | null;
  enquiryId: string | null;
  contactId: number | null;
};

const NO_LINKS: ResolvedLinks = {
  bandRequestId: null,
  musicActId: null,
  privateHireRequestId: null,
  enquiryId: null,
  contactId: null,
};

function replyTarget(links: Links): CorrespondenceTarget | null {
  if (links.bandRequestId) return { kind: "band", id: links.bandRequestId };
  if (links.privateHireRequestId) return { kind: "hire", id: links.privateHireRequestId };
  if (links.enquiryId) return { kind: "enq", id: links.enquiryId };
  if (links.musicActId) return { kind: "act", id: links.musicActId };
  if (links.contactId) return { kind: "cust", id: String(links.contactId) };
  return null;
}

export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

async function contactIdFromRow(admin: SupabaseClient, table: string, id: string | null | undefined) {
  if (!id) return null;
  const { data } = await admin.from(table).select("contact_id").eq("id", id).maybeSingle();
  return (data?.contact_id as number | null | undefined) ?? null;
}

/* Every email is filed under the customer it was with, so their record shows
   one thread whatever each email was about. The linked request knows its
   customer; failing that, the other party's address is matched to a contact. */
async function resolveContactId(admin: SupabaseClient, links: Links, otherParty: string): Promise<number | null> {
  if (links.contactId) return links.contactId;
  const fromRequest =
    (await contactIdFromRow(admin, "band_booking_requests", links.bandRequestId)) ??
    (await contactIdFromRow(admin, "private_hire_requests", links.privateHireRequestId)) ??
    (await contactIdFromRow(admin, "music_acts", links.musicActId));
  if (fromRequest) return fromRequest;
  const email = bareAddress(otherParty);
  if (!email) return null;
  const { data } = await admin
    .from("contacts")
    .select("id")
    .ilike("email", escapeLike(email))
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as number | undefined) ?? null;
}

/* Sends an email to a customer - a band, a private hire or an enquiry - and
   records it in the thread, with a blind copy to
   the staff inbox so the outgoing side is in webmail too. Logging failures are
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
  fallbackReplyTo?: string | null;
  attachments?: OutboundAttachment[];
  /* The rendered template this email was built from - its own files go too. */
  templateSlots?: RenderedSlots | null;
}): Promise<{ error: string | null }> {
  const attachments = [...(await loadTemplateAttachments(p.templateSlots)), ...(p.attachments ?? [])];
  const target = replyTarget(p.links);
  const replyAddress = target ? correspondenceReplyAddress(target, EMAIL_REPLY_DOMAIN) : null;
  const replyTo = replyAddress
    ? withDisplayName(replyAddress, senderDisplayName(EMAIL_FROM))
    : (p.fallbackReplyTo ?? null);
  const headers = p.inReplyTo ? { "In-Reply-To": p.inReplyTo, References: p.inReplyTo } : undefined;
  const bcc = ADMIN_EMAIL && bareAddress(ADMIN_EMAIL) !== bareAddress(p.to) ? ADMIN_EMAIL : null;

  const { data, error } = await p.resend.emails.send({
    from: EMAIL_FROM,
    to: p.to,
    subject: p.subject,
    html: p.html,
    text: htmlToPlainText(p.html),
    ...(replyTo ? { replyTo } : {}),
    ...(bcc ? { bcc } : {}),
    ...(headers ? { headers } : {}),
    ...(attachments.length
      ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) }
      : {}),
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

  const stored: EmailAttachment[] = [];
  for (const [i, a] of attachments.entries()) {
    const name = safeAttachmentName(a.filename, `attachment-${i + 1}`);
    const path = `outbound/${data?.id ?? crypto.randomUUID()}/${i + 1}-${name}`;
    const { error: upErr } = await admin.storage
      .from(EMAIL_ATTACHMENTS_BUCKET)
      .upload(path, a.content, { contentType: a.contentType, upsert: true });
    if (upErr) console.error(`[correspondence ${p.kind}] attachment upload failed:`, upErr.message);
    else stored.push({ name, path, size: a.content.byteLength, contentType: a.contentType });
  }

  const { error: logError } = await admin.from("email_messages").insert({
    band_booking_request_id: p.links.bandRequestId ?? null,
    music_act_id: musicActId,
    private_hire_request_id: p.links.privateHireRequestId ?? null,
    enquiry_id: p.links.enquiryId ?? null,
    contact_id: await resolveContactId(admin, { ...p.links, musicActId }, p.to),
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
    attachments: stored,
  });
  if (logError) console.error(`[correspondence ${p.kind}] log failed:`, logError.code, logError.message);

  return { error: null };
}

type MessageRow = {
  id: string;
  direction: "outbound" | "inbound";
  kind: string | null;
  channel: MessageChannel | null;
  sender_name: string | null;
  from_address: string;
  to_addresses: string[] | null;
  subject: string;
  text_body: string;
  html_body: string | null;
  attachments: EmailAttachment[] | null;
  read_at: string | null;
  band_booking_request_id: string | null;
  private_hire_request_id: string | null;
  enquiry_id: string | null;
  music_act_id: string | null;
  created_at: string;
  sender: { full_name: string | null } | { full_name: string | null }[] | null;
};

function sourceOf(r: MessageRow): CorrespondenceSource {
  if (r.band_booking_request_id) return "band";
  if (r.private_hire_request_id) return "hire";
  if (r.enquiry_id) return "enquiry";
  if (r.music_act_id) return "act";
  return "customer";
}

export async function loadCorrespondence(
  supabase: SupabaseClient,
  filter: CorrespondenceFilter
): Promise<CorrespondenceMessage[]> {
  let query = supabase
    .from("email_messages")
    .select(
      "id, direction, kind, channel, sender_name, from_address, to_addresses, subject, text_body, html_body, attachments, read_at, band_booking_request_id, private_hire_request_id, enquiry_id, music_act_id, created_at, sender:employees!email_messages_sent_by_fkey(full_name)"
    )
    .order("created_at", { ascending: true });
  query = query.eq(...correspondenceColumn(filter));

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
      channel: r.channel ?? "email",
      senderName: r.sender_name,
      fromAddress: r.from_address,
      toAddresses: r.to_addresses ?? [],
      subject: r.subject,
      textBody: r.text_body,
      htmlBody: r.html_body ?? null,
      attachments: (r.attachments ?? []).map((a) => ({ ...a, url: urls.get(a.path) ?? null })),
      readAt: r.read_at,
      sentByName: sender?.full_name ?? null,
      bandRequestId: r.band_booking_request_id,
      privateHireRequestId: r.private_hire_request_id,
      source: sourceOf(r),
      createdAt: r.created_at,
    };
  });
}

/* The customer a thread belongs to, from whichever record the thread is on. */
export async function threadContactId(supabase: SupabaseClient, filter: CorrespondenceFilter): Promise<number | null> {
  if ("contactId" in filter) return filter.contactId;
  const [table, id] =
    "bandRequestId" in filter
      ? ["band_booking_requests", filter.bandRequestId]
      : "privateHireRequestId" in filter
        ? ["private_hire_requests", filter.privateHireRequestId]
        : "enquiryId" in filter
          ? ["enquiries", filter.enquiryId]
          : ["music_acts", filter.musicActId];
  return contactIdFromRow(supabase, table, id);
}

/* The chat channels the thread's customer has written on, each with Meta's
   reply window worked out as of now. */
export async function loadThreadChannels(
  supabase: SupabaseClient,
  filter: CorrespondenceFilter,
  now: number = Date.now()
): Promise<ThreadChannel[]> {
  const contactId = await threadContactId(supabase, filter);
  if (!contactId) return [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const bookingForm = "privateHireRequestId" in filter ? "private" : "band";
  const { data, error } = await supabase
    .from("contact_channels")
    .select("id, channel, external_id, handle, last_inbound_at")
    .eq("contact_id", contactId)
    .order("last_inbound_at", { ascending: false });
  if (error) {
    console.error("[correspondence] channels load failed:", error.code, error.message);
    return [];
  }
  return (data ?? [])
    .filter((r) => isMetaChannel(r.channel))
    .map((r) => ({
      channel: r.channel as MetaChannel,
      externalId: r.external_id as string,
      handle: (r.handle as string | null) ?? null,
      lastInboundAt: (r.last_inbound_at as string | null) ?? null,
      allowance: replyAllowance(r.channel as MetaChannel, r.last_inbound_at as string | null, now),
      bookingLink: siteUrl ? bookingLinkFor(siteUrl, r.channel as MetaChannel, r.id as string, bookingForm) : null,
    }));
}

/* The act's own choice from the booking form, on a band request thread. */
export async function threadPreferredChannel(
  supabase: SupabaseClient,
  filter: CorrespondenceFilter
): Promise<MessageChannel | null> {
  const [table, id] =
    "bandRequestId" in filter
      ? ["band_booking_requests", filter.bandRequestId]
      : "privateHireRequestId" in filter
        ? ["private_hire_requests", filter.privateHireRequestId]
        : [null, null];
  if (!table || !id) return null;
  const { data } = await supabase.from(table).select("preferred_channel").eq("id", id).maybeSingle();
  const value = data?.preferred_channel;
  return value === "email" || isMetaChannel(value) ? (value as MessageChannel) : null;
}

/* Emails only: the latest inbound email is what a staff reply answers - its
   subject and Message-ID keep the band's mail app threading the conversation. */
export async function latestInbound(
  supabase: SupabaseClient,
  filter: CorrespondenceFilter
): Promise<{ subject: string; messageId: string | null; fromAddress: string } | null> {
  let query = supabase
    .from("email_messages")
    .select("subject, message_id, from_address")
    .eq("direction", "inbound")
    .eq("channel", "email")
    .order("created_at", { ascending: false })
    .limit(1);
  query = query.eq(...correspondenceColumn(filter));
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
  filter: CorrespondenceFilter
): Promise<string | null> {
  let query = supabase
    .from("email_messages")
    .select("subject")
    .eq("channel", "email")
    .order("created_at", { ascending: false })
    .limit(1);
  query = query.eq(...correspondenceColumn(filter));
  const { data } = await query.maybeSingle();
  return (data?.subject as string | undefined) ?? null;
}

async function latestInRange(admin: SupabaseClient, table: string, select: string, ref: string) {
  const [lo, hi] = idRangeForRef(ref);
  const { data } = await admin
    .from(table)
    .select(select)
    .gte("id", lo)
    .lte("id", hi)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

async function latestByEmail(admin: SupabaseClient, table: string, select: string, email: string) {
  const { data } = await admin
    .from(table)
    .select(select)
    .ilike("email", escapeLike(email))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

function bandLinks(row: Record<string, unknown>): ResolvedLinks {
  return { ...NO_LINKS, bandRequestId: row.id as string, musicActId: (row.music_acts_id as string | null) ?? null };
}

async function resolveInboundLinks(
  admin: SupabaseClient,
  recipients: string[],
  fromAddress: string,
  inReplyTo: string | null
): Promise<ResolvedLinks> {
  const target = parseCorrespondenceAddress(recipients, EMAIL_REPLY_DOMAIN);

  if (target?.kind === "band") {
    const row = await latestInRange(admin, "band_booking_requests", "id, music_acts_id", target.ref);
    if (row) return bandLinks(row);
  }
  if (target?.kind === "hire") {
    const row = await latestInRange(admin, "private_hire_requests", "id", target.ref);
    if (row) return { ...NO_LINKS, privateHireRequestId: row.id as string };
  }
  if (target?.kind === "enq") {
    const row = await latestInRange(admin, "enquiries", "id", target.ref);
    if (row) return { ...NO_LINKS, enquiryId: row.id as string };
  }
  if (target?.kind === "act") {
    const row = await latestInRange(admin, "music_acts", "id", target.ref);
    if (row) return { ...NO_LINKS, musicActId: row.id as string };
  }
  if (target?.kind === "cust") {
    const { data } = await admin.from("contacts").select("id").eq("id", Number(target.ref)).maybeSingle();
    if (data) return { ...NO_LINKS, contactId: data.id as number };
  }

  if (inReplyTo) {
    const { data } = await admin
      .from("email_messages")
      .select("band_booking_request_id, music_act_id, private_hire_request_id, enquiry_id, contact_id")
      .eq("message_id", inReplyTo)
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        bandRequestId: (data.band_booking_request_id as string | null) ?? null,
        musicActId: (data.music_act_id as string | null) ?? null,
        privateHireRequestId: (data.private_hire_request_id as string | null) ?? null,
        enquiryId: (data.enquiry_id as string | null) ?? null,
        contactId: (data.contact_id as number | null) ?? null,
      };
    }
  }

  const sender = bareAddress(fromAddress);
  const [band, hire, enquiry] = await Promise.all([
    latestByEmail(admin, "band_booking_requests", "id, music_acts_id, created_at", sender),
    latestByEmail(admin, "private_hire_requests", "id, created_at", sender),
    latestByEmail(admin, "enquiries", "id, created_at", sender),
  ]);
  const candidates: { at: string; links: ResolvedLinks }[] = [];
  if (band) candidates.push({ at: String(band.created_at), links: bandLinks(band) });
  if (hire) candidates.push({ at: String(hire.created_at), links: { ...NO_LINKS, privateHireRequestId: hire.id as string } });
  if (enquiry) candidates.push({ at: String(enquiry.created_at), links: { ...NO_LINKS, enquiryId: enquiry.id as string } });
  candidates.sort((a, b) => b.at.localeCompare(a.at));

  return candidates[0]?.links ?? NO_LINKS;
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

  const contactId = await resolveContactId(admin, links, email.from);
  const owner =
    links.bandRequestId ??
    links.privateHireRequestId ??
    links.enquiryId ??
    links.musicActId ??
    (contactId ? `contact-${contactId}` : "unmatched");
  const folder = `${owner}/${emailId}`;
  const attachments: EmailAttachment[] = [];
  const received: ReceivedFile[] = [];
  if ((email.attachments ?? []).length > 0) {
    const { data: list } = await resend.emails.receiving.attachments.list({ emailId });
    for (const [i, a] of (list?.data ?? []).entries()) {
      if (a.content_disposition === "inline" && a.content_id) continue;
      try {
        const res = await fetch(a.download_url);
        if (!res.ok) throw new Error(`download ${res.status}`);
        const name = safeAttachmentName(a.filename, `attachment-${i + 1}`);
        const path = `${folder}/${i + 1}-${name}`;
        const bytes = new Uint8Array(await res.arrayBuffer());
        received.push({ name, contentType: a.content_type, bytes });
        const { error: upErr } = await admin.storage
          .from(EMAIL_ATTACHMENTS_BUCKET)
          .upload(path, bytes, { contentType: a.content_type, upsert: true });
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
    private_hire_request_id: links.privateHireRequestId,
    enquiry_id: links.enquiryId,
    contact_id: contactId,
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
  if (insertError || received.length === 0) return;

  try {
    await applyInvoiceReply(admin, links, received, new Date().toISOString(), email.subject ?? "");
  } catch (e) {
    console.error(`[correspondence inbound] invoice read failed for ${emailId}:`, e);
  }
}
