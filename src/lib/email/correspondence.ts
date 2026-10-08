import { escapeHtml } from "./escape";
import { unwrapListParagraphs } from "./design";
import type { MessageChannel, MetaChannel, ReplyAllowance } from "@/lib/meta/channels";

export type CorrespondenceKind = "band" | "act" | "hire" | "enq" | "cust";

export type CorrespondenceTarget = { kind: CorrespondenceKind; id: string };

export type CorrespondenceFilter =
  | { bandRequestId: string }
  | { musicActId: string }
  | { privateHireRequestId: string }
  | { enquiryId: string }
  | { contactId: number };

export type CorrespondenceColumn =
  | "band_booking_request_id"
  | "music_act_id"
  | "private_hire_request_id"
  | "enquiry_id"
  | "contact_id";

export function correspondenceColumn(filter: CorrespondenceFilter): [CorrespondenceColumn, string | number] {
  if ("bandRequestId" in filter) return ["band_booking_request_id", filter.bandRequestId];
  if ("privateHireRequestId" in filter) return ["private_hire_request_id", filter.privateHireRequestId];
  if ("enquiryId" in filter) return ["enquiry_id", filter.enquiryId];
  if ("contactId" in filter) return ["contact_id", filter.contactId];
  return ["music_act_id", filter.musicActId];
}

export type CorrespondenceSource = "band" | "hire" | "enquiry" | "act" | "customer";

export const CORRESPONDENCE_SOURCE_LABELS: Record<CorrespondenceSource, string> = {
  band: "Band request",
  hire: "Private hire",
  enquiry: "Enquiry",
  act: "Music act",
  customer: "Customer",
};

export type EmailAttachment = {
  name: string;
  path: string;
  size: number;
  contentType: string;
};

export type CorrespondenceMessage = {
  id: string;
  direction: "outbound" | "inbound";
  kind: string | null;
  channel: MessageChannel;
  senderName: string | null;
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  textBody: string;
  htmlBody: string | null;
  attachments: (EmailAttachment & { url: string | null })[];
  readAt: string | null;
  sentByName: string | null;
  bandRequestId: string | null;
  privateHireRequestId: string | null;
  source: CorrespondenceSource;
  createdAt: string;
};

/* A chat channel the other party has used, with whether Meta will take a
   reply right now. */
export type ThreadChannel = {
  channel: MetaChannel;
  externalId: string;
  handle: string | null;
  lastInboundAt: string | null;
  allowance: ReplyAllowance;
  /* The tagged booking link to send on this channel, when the site URL is set. */
  bookingLink: string | null;
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SHORT_REF = "[0-9a-f]{8}";
const LOCAL_PART = new RegExp(`^(?:(band|act|hire|enq)-(${UUID}|${SHORT_REF})|(cust)-([0-9]{1,18}))$`, "i");

/* The address carries the short reference staff already see (#Ref: 347CE8F7),
   not the full id, so it reads as a booking reference in the band's mail app.
   Addresses sent before this change carry the full id and still resolve. */
export function correspondenceReplyAddress(target: CorrespondenceTarget, domain: string): string | null {
  if (!domain) return null;
  const ref = target.kind === "cust" ? target.id : target.id.slice(0, 8).toLowerCase();
  return `${target.kind}-${ref}@${domain}`;
}

export function withDisplayName(address: string, name: string): string {
  const cleaned = name.replace(/["<>\r\n]/g, "").trim();
  return cleaned ? `"${cleaned}" <${address}>` : address;
}

export function senderDisplayName(from: string): string {
  const match = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return match ? match[1].trim() : "";
}

/* Inclusive uuid bounds for a reference: one id for a full uuid, every id
   starting with the eight characters for a short one. */
export function idRangeForRef(ref: string): [string, string] {
  if (ref.length === 36) return [ref, ref];
  return [`${ref}-0000-0000-0000-000000000000`, `${ref}-ffff-ffff-ffff-ffffffffffff`];
}

export function bareAddress(address: string): string {
  const angled = address.match(/<([^>]+)>/);
  return (angled ? angled[1] : address).trim().toLowerCase();
}

export type ParsedCorrespondenceAddress = { kind: CorrespondenceKind; ref: string };

export function parseCorrespondenceAddress(addresses: string[], domain: string): ParsedCorrespondenceAddress | null {
  if (!domain) return null;
  for (const raw of addresses) {
    const address = bareAddress(raw);
    const at = address.lastIndexOf("@");
    if (at === -1 || address.slice(at + 1) !== domain) continue;
    const match = address.slice(0, at).match(LOCAL_PART);
    if (match?.[1]) return { kind: match[1].toLowerCase() as CorrespondenceKind, ref: match[2].toLowerCase() };
    if (match?.[3]) return { kind: "cust", ref: match[4] };
  }
  return null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  pound: "£",
  hellip: "…",
  ndash: "–",
  mdash: "—",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

export function htmlToPlainText(html: string): string {
  const text = html
    .replace(/<(head|style|script|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const QUOTE_STARTS = [/^>/, /^On .+wrote:$/i, /^-{2,}\s*Original Message\s*-{2,}$/i, /^From: .+/i, /^Sent from my /i];

function startsQuote(lines: string[], i: number): boolean {
  const line = lines[i].trim();
  if (QUOTE_STARTS.some((re) => re.test(line))) return true;
  return /^On .+/i.test(line) && /wrote:$/i.test((lines[i + 1] ?? "").trim());
}

/* Mail apps append the message being replied to beneath the reply. The thread
   already shows that message, so only the new text is shown by default. */
export function splitQuotedReply(text: string): { body: string; quoted: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex((_, i) => startsQuote(lines, i));
  if (cut <= 0) return { body: text.trim(), quoted: "" };
  return {
    body: lines.slice(0, cut).join("\n").trim(),
    quoted: lines.slice(cut).join("\n").trim(),
  };
}

export function replySubject(subject: string): string {
  const s = subject.trim();
  if (!s) return "Message from Don Fenticas";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

export function plainReplyHtml(body: string): string {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.55;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:sans-serif;max-width:600px;color:#1f2937;font-size:14px;">${paragraphs}</div>`;
}

const REPLY_ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "blockquote"]);

/* Staff replies come from the editor as a small HTML subset. Anything outside
   it is dropped and links keep only an http(s)/mailto href, so a reply can't
   carry markup the editor never produces. */
export function cleanReplyFragment(editorHtml: string): string {
  return unwrapListParagraphs(editorHtml.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, name: string, attrs: string) => {
    const lower = name.toLowerCase();
    if (!REPLY_ALLOWED_TAGS.has(lower)) return "";
    if (tag.startsWith("</")) return `</${lower}>`;
    if (lower === "a") {
      const href = attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? "";
      return /^(https?:|mailto:)/i.test(href) ? `<a href="${href}" target="_blank" rel="noopener noreferrer">` : "<a>";
    }
    return `<${lower}>`;
  }));
}

export function replyHtml(editorHtml: string): string {
  return `<div style="font-family:sans-serif;max-width:600px;color:#1f2937;font-size:14px;line-height:1.55;">${cleanReplyFragment(editorHtml)}</div>`;
}

export function safeAttachmentName(name: string | null | undefined, fallback: string): string {
  const cleaned = (name ?? "").replace(/[/\\?%*:|"<>\u0000-\u001f]/g, "_").trim();
  return cleaned.slice(-120) || fallback;
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  offered: "Offered",
  booked: "Booked",
  declined: "Declined",
  pending: "Pending",
  pending_review: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  awaiting_customer: "With customer",
  awaiting_deposit: "Deposit due",
  expired: "Expired",
};

/* How a band booking or private hire is named in a thread: the date it's
   for (or when it came in, if no date yet), its stage and its short reference. */
export function correspondenceBookingLabel(b: {
  id: string;
  status: string | null;
  date: string | null;
  createdAt: string;
}): string {
  const when = b.date
    ? new Date(`${b.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : `Received ${new Date(b.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const status = b.status ? (BOOKING_STATUS_LABELS[b.status] ?? b.status.charAt(0).toUpperCase() + b.status.slice(1)) : "";
  return [when, status, `#${b.id.slice(0, 8)}`].filter(Boolean).join(" · ");
}
