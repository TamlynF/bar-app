import { escapeHtml } from "./escape";

export type CorrespondenceTarget = { kind: "band"; id: string } | { kind: "act"; id: string };

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
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  textBody: string;
  attachments: (EmailAttachment & { url: string | null })[];
  readAt: string | null;
  sentByName: string | null;
  bandRequestId: string | null;
  createdAt: string;
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SHORT_REF = "[0-9a-f]{8}";
const LOCAL_PART = new RegExp(`^(band|act)-(${UUID}|${SHORT_REF})$`, "i");

/* The address carries the short reference staff already see (#Ref: 347CE8F7),
   not the full id, so it reads as a booking reference in the band's mail app.
   Addresses sent before this change carry the full id and still resolve. */
export function correspondenceReplyAddress(target: CorrespondenceTarget, domain: string): string | null {
  if (!domain) return null;
  return `${target.kind}-${target.id.slice(0, 8).toLowerCase()}@${domain}`;
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

export type ParsedCorrespondenceAddress = { kind: "band" | "act"; ref: string };

export function parseCorrespondenceAddress(addresses: string[], domain: string): ParsedCorrespondenceAddress | null {
  if (!domain) return null;
  for (const raw of addresses) {
    const address = bareAddress(raw);
    const at = address.lastIndexOf("@");
    if (at === -1 || address.slice(at + 1) !== domain) continue;
    const match = address.slice(0, at).match(LOCAL_PART);
    if (match) return { kind: match[1].toLowerCase() as "band" | "act", ref: match[2].toLowerCase() };
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

export function safeAttachmentName(name: string | null | undefined, fallback: string): string {
  const cleaned = (name ?? "").replace(/[/\\?%*:|"<>\u0000-\u001f]/g, "_").trim();
  return cleaned.slice(-120) || fallback;
}
