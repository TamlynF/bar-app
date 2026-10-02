/* Shared brand settings and block-built bodies for the automatic emails.

   Pure and free of any Supabase import, like merge.ts: the server renders sends
   with it and the settings page renders its live preview with the same code.

   Everything here is opt-in. An empty brand and a null block list reproduce the
   three existing designs exactly, so nothing changes until staff change it. */

import { escapeAttr, escapeHtml, safeUrl } from "./escape";
import { substitute, toParagraphs, type MergeValues, type TemplateSlots } from "./render";

function linkOrEmpty(url: string): string {
  const safe = safeUrl(url);
  return safe === "#" ? "" : safe;
}

/* ── Brand ────────────────────────────────────────────────────────────── */

export type FontKey = "helvetica" | "arial" | "georgia" | "verdana" | "trebuchet" | "tahoma" | "archivo";

/* Gmail ignores web fonts, so every choice ends in a font every client has. */
export const EMAIL_FONTS: Record<FontKey, { label: string; stack: string }> = {
  helvetica: { label: "Helvetica", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  georgia: { label: "Georgia (serif)", stack: "Georgia, 'Times New Roman', serif" },
  verdana: { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  trebuchet: { label: "Trebuchet", stack: "'Trebuchet MS', Helvetica, sans-serif" },
  tahoma: { label: "Tahoma", stack: "Tahoma, Verdana, sans-serif" },
  archivo: { label: "Archivo (Apple Mail; others fall back to Helvetica)", stack: "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif" },
};

export type EmailBrand = {
  logoUrl: string | null;
  logoWidth: number | null;
  font: FontKey | null;
  headerBg: string | null;
  headerText: string | null;
  accent: string | null;
  footerText: string | null;
  cardLabelColor: string | null;
  cardLabelCase: "upper" | "plain" | null;
  cardValueSize: "normal" | "large" | null;
  cardBg: string | null;
  cardBorder: string | null;
  noteBar: string | null;
};

export const EMPTY_BRAND: EmailBrand = {
  logoUrl: null,
  logoWidth: null,
  font: null,
  headerBg: null,
  headerText: null,
  accent: null,
  footerText: null,
  cardLabelColor: null,
  cardLabelCase: null,
  cardValueSize: null,
  cardBg: null,
  cardBorder: null,
  noteBar: null,
};

export type EmailBrandRow = {
  logo_url: string | null;
  logo_width: number | null;
  font: string | null;
  header_bg: string | null;
  header_text: string | null;
  accent: string | null;
  footer_text: string | null;
  card_label_color?: string | null;
  card_label_case?: string | null;
  card_value_size?: string | null;
  card_bg?: string | null;
  card_border?: string | null;
  note_bar?: string | null;
  updated_at?: string | null;
  updated_by?: number | null;
};

const HEX = /^#[0-9a-f]{6}$/i;

export function hexOrNull(value: unknown): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return HEX.test(v) ? v.toUpperCase() : null;
}

function isFontKey(value: unknown): value is FontKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EMAIL_FONTS, value);
}

function httpUrlOrNull(value: unknown): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return /^https?:\/\//i.test(v) ? v : null;
}

export function brandFromRow(row: EmailBrandRow | null | undefined): EmailBrand {
  if (!row) return EMPTY_BRAND;
  const width = Number(row.logo_width);
  return {
    logoUrl: httpUrlOrNull(row.logo_url),
    logoWidth: Number.isFinite(width) && width >= 40 && width <= 560 ? Math.round(width) : null,
    font: isFontKey(row.font) ? row.font : null,
    headerBg: hexOrNull(row.header_bg),
    headerText: hexOrNull(row.header_text),
    accent: hexOrNull(row.accent),
    footerText: typeof row.footer_text === "string" && row.footer_text.trim() ? row.footer_text.trim() : null,
    cardLabelColor: hexOrNull(row.card_label_color),
    cardLabelCase: row.card_label_case === "upper" || row.card_label_case === "plain" ? row.card_label_case : null,
    cardValueSize: row.card_value_size === "normal" || row.card_value_size === "large" ? row.card_value_size : null,
    cardBg: hexOrNull(row.card_bg),
    cardBorder: hexOrNull(row.card_border),
    noteBar: hexOrNull(row.note_bar),
  };
}

export function brandToRow(brand: EmailBrand): EmailBrandRow {
  return {
    logo_url: brand.logoUrl,
    logo_width: brand.logoWidth,
    font: brand.font,
    header_bg: brand.headerBg,
    header_text: brand.headerText,
    accent: brand.accent,
    footer_text: brand.footerText,
    card_label_color: brand.cardLabelColor,
    card_label_case: brand.cardLabelCase,
    card_value_size: brand.cardValueSize,
    card_bg: brand.cardBg,
    card_border: brand.cardBorder,
    note_bar: brand.noteBar,
  };
}

export function fontStack(brand: EmailBrand, fallback: string): string {
  return brand.font ? EMAIL_FONTS[brand.font].stack : fallback;
}

/* Dark or light text for a button, whichever reads on its colour. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#26300D" : "#FFFFFF";
}

export function logoHtml(brand: EmailBrand, margin = "0 auto 16px"): string {
  if (!brand.logoUrl) return "";
  const width = brand.logoWidth ?? 160;
  return `<img src="${escapeAttr(brand.logoUrl)}" alt="Don Fenticas" width="${width}" style="display:block;margin:${margin};width:${width}px;max-width:100%;height:auto;border:0;">`;
}

/* ── Blocks ───────────────────────────────────────────────────────────── */

export type EmailFamily = "band" | "brand" | "plain";

export type SystemBlockKey = "slotCard" | "teamNote" | "details" | "panel" | "button" | "trailer";

export const SYSTEM_BLOCK_LABELS: Record<SystemBlockKey, { label: string; hint: string }> = {
  slotCard: { label: "Slot card", hint: "The date, time and fee - filled in from the booking." },
  teamNote: { label: "Note from our team", hint: "The message typed when the email is sent. Hidden when left blank." },
  details: { label: "Booking details", hint: "The booking's details - filled in when the email is sent." },
  panel: { label: "Grey panel", hint: "The highlighted panel - the request's fields on staff alerts." },
  button: { label: "Button", hint: "The link button. Its wording is the Button label field." },
  trailer: { label: "Reference line", hint: "The reference printed at the bottom of staff alerts." },
};

export type ImageAlign = "left" | "center" | "right";
export type SpacerSize = "s" | "m" | "l";

export type EmailBlock =
  | { id: string; type: "text"; html: string; small?: boolean }
  | { id: string; type: "image"; url: string; alt: string; width: number; align: ImageAlign; href: string }
  | { id: string; type: "button"; label: string; url: string }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size: SpacerSize }
  | { id: string; type: "system"; key: SystemBlockKey };

export type TemplateAttachment = { name: string; path: string; size: number; contentType: string };

export const TEMPLATE_ATTACHMENT_LIMITS = { files: 5, bytes: 10 * 1024 * 1024 };

export function templateAttachmentFolder(scenarioKey: string): string {
  return `templates/${scenarioKey.replace(/[^a-z0-9._-]/gi, "_")}/`;
}

/* Only files that live in this template's own folder are accepted, so a
   crafted request cannot point a template at someone's email attachment. */
export function sanitizeAttachments(raw: unknown, scenarioKey: string): TemplateAttachment[] {
  if (!Array.isArray(raw)) return [];
  const folder = templateAttachmentFolder(scenarioKey);
  const out: TemplateAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const path = typeof a.path === "string" ? a.path : "";
    if (!path.startsWith(folder) || path.includes("..")) continue;
    out.push({
      name: typeof a.name === "string" && a.name.trim() ? a.name.slice(0, 120) : path.slice(folder.length),
      path,
      size: Math.max(0, Number(a.size) || 0),
      contentType: typeof a.contentType === "string" && a.contentType ? a.contentType : "application/octet-stream",
    });
    if (out.length >= TEMPLATE_ATTACHMENT_LIMITS.files) break;
  }
  return out;
}

export type EmailDesign = { brand: EmailBrand; blocks: EmailBlock[] | null; attachments?: TemplateAttachment[] };

/* What renderTemplate hands a send site: the filled-in copy plus the design to
   draw it with. The layouts read `design` when it is there. */
export type RenderedSlots = TemplateSlots & { design?: EmailDesign };

const FAMILY_SYSTEM_BLOCKS: Record<EmailFamily, SystemBlockKey[]> = {
  band: ["slotCard", "teamNote"],
  brand: ["details", "button"],
  plain: ["details", "panel", "button", "trailer"],
};

export function familySystemBlocks(family: EmailFamily): SystemBlockKey[] {
  return FAMILY_SYSTEM_BLOCKS[family];
}

/* The copy fields a block layout takes over - they become text blocks, so the
   editor stops showing them. Plain emails keep their closing copy: it is the
   text inside the grey panel block. */
export const BLOCK_REPLACED_SLOTS: Record<EmailFamily, ReadonlySet<string>> = {
  band: new Set(["greeting", "intro", "outro"]),
  brand: new Set(["greeting", "intro", "outro", "footnote"]),
  plain: new Set(["greeting", "intro", "footnote"]),
};

export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const TEXT_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "h2", "h3"]);

/* Text blocks come from the editor as a small HTML subset. Anything outside it
   is dropped and links keep only an http(s)/mailto href or a {{token}}. */
export function cleanBlockHtml(html: string): string {
  return unwrapListParagraphs(html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, name: string, attrs: string) => {
    const lower = name.toLowerCase();
    if (!TEXT_TAGS.has(lower)) return "";
    if (tag.startsWith("</")) return `</${lower}>`;
    if (lower === "a") {
      const href = attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? "";
      return /^(https?:|mailto:|\{\{)/i.test(href) ? `<a href="${href}">` : "<a>";
    }
    return `<${lower}>`;
  }));
}

/* The editor wraps each list item in a paragraph. Left in, every bullet picks
   up a paragraph's spacing in the email, so the wrapper is dropped. */
export function unwrapListParagraphs(html: string): string {
  return html.replace(/<li>\s*<p>/g, "<li>").replace(/<\/p>\s*<\/li>/g, "</li>");
}

function textFromParagraphs(text: string): string {
  return toParagraphs(text)
    .map((p) => `<p>${p}</p>`)
    .join("");
}

/* The block list a template starts from when staff choose to customise its
   layout - the same order and copy the standard layout draws. */
export function defaultBlocks(scenarioKey: string, family: EmailFamily, slots: TemplateSlots): EmailBlock[] {
  const text = (html: string, small = false): EmailBlock[] =>
    html.trim() ? [{ id: newBlockId(), type: "text", html, ...(small ? { small: true } : {}) }] : [];
  const system = (key: SystemBlockKey): EmailBlock => ({ id: newBlockId(), type: "system", key });

  if (family === "band") {
    const noteFirst = scenarioKey === "band.offered";
    return [
      ...text(`<p>${slots.greeting}</p>`),
      ...text(textFromParagraphs(slots.intro)),
      system("slotCard"),
      ...(noteFirst ? [system("teamNote")] : []),
      ...text(textFromParagraphs(slots.outro)),
      ...(noteFirst ? [] : [system("teamNote")]),
    ];
  }
  if (family === "brand") {
    return [
      ...text(`<h2>${slots.greeting}</h2>`),
      ...text(textFromParagraphs(slots.intro)),
      system("details"),
      ...text(textFromParagraphs(slots.outro)),
      system("button"),
      ...text(slots.footnote ? `<p>${slots.footnote}</p>` : "", true),
    ];
  }
  return [
    ...text(`<h2>${slots.greeting}</h2>`),
    ...text(textFromParagraphs(slots.intro)),
    system("details"),
    system("panel"),
    system("button"),
    ...text(slots.footnote ? `<p>${slots.footnote}</p>` : "", true),
    system("trailer"),
  ];
}

/* Validating whatever the browser sent before it is stored. Unknown block
   types are dropped, text is cut back to the editor's subset, and every system
   block the email family needs is kept exactly once. */
export function sanitizeBlocks(raw: unknown, family: EmailFamily): EmailBlock[] | null {
  if (!Array.isArray(raw)) return null;
  const allowedSystem = new Set(FAMILY_SYSTEM_BLOCKS[family]);
  const seenSystem = new Set<SystemBlockKey>();
  const out: EmailBlock[] = [];

  for (const item of raw.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const id = typeof b.id === "string" && b.id ? b.id.slice(0, 20) : newBlockId();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

    switch (b.type) {
      case "text":
        out.push({ id, type: "text", html: cleanBlockHtml(str(b.html, 20000)), ...(b.small ? { small: true } : {}) });
        break;
      case "image": {
        const width = Math.min(100, Math.max(10, Math.round(Number(b.width) || 100)));
        const align: ImageAlign = b.align === "left" || b.align === "right" ? b.align : "center";
        out.push({ id, type: "image", url: str(b.url, 2000), alt: str(b.alt, 200), width, align, href: str(b.href, 2000) });
        break;
      }
      case "button":
        out.push({ id, type: "button", label: str(b.label, 80), url: str(b.url, 2000) });
        break;
      case "divider":
        out.push({ id, type: "divider" });
        break;
      case "spacer":
        out.push({ id, type: "spacer", size: b.size === "s" || b.size === "l" ? b.size : "m" });
        break;
      case "system": {
        const key = b.key as SystemBlockKey;
        if (allowedSystem.has(key) && !seenSystem.has(key)) {
          seenSystem.add(key);
          out.push({ id, type: "system", key });
        }
        break;
      }
    }
  }
  for (const key of FAMILY_SYSTEM_BLOCKS[family]) {
    if (!seenSystem.has(key)) out.push({ id: newBlockId(), type: "system", key });
  }
  return out;
}

/* Merge values into the blocks at send time. Text is escaped, URLs are left raw
   and checked when drawn. */
export function fillBlocks(blocks: EmailBlock[], values: MergeValues, unknown: Set<string>): EmailBlock[] {
  return blocks.map((b) => {
    if (b.type === "text") return { ...b, html: substitute(b.html, values, true, unknown) };
    if (b.type === "image") return { ...b, alt: substitute(b.alt, values, false, unknown), href: substitute(b.href, values, false, unknown) };
    if (b.type === "button") return { ...b, label: substitute(b.label, values, false, unknown), url: substitute(b.url, values, false, unknown) };
    return b;
  });
}

export function blockTokens(blocks: EmailBlock[] | null): string[] {
  if (!blocks) return [];
  const found = new Set<string>();
  const scan = (s: string) => {
    for (const m of s.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) found.add(m[1]);
  };
  for (const b of blocks) {
    if (b.type === "text") scan(b.html);
    if (b.type === "image") {
      scan(b.alt);
      scan(b.href);
    }
    if (b.type === "button") {
      scan(b.label);
      scan(b.url);
    }
  }
  return [...found];
}

/* Inline styles for the editor's tags, per design - mail clients ignore
   <style> blocks often enough that every element carries its own. */
type TextStyles = { p: string; small: string; h2: string; h3: string; list: string; li: string; a: string };

export const FAMILY_TEXT_STYLES: Record<EmailFamily, TextStyles> = {
  band: {
    p: "margin:0 0 16px;color:#20231A;font-size:15px;line-height:1.6;",
    small: "margin:0 0 12px;color:#5E6654;font-size:12px;line-height:1.5;",
    h2: "margin:0 0 16px;color:#20231A;font-size:20px;font-weight:900;line-height:1.3;",
    h3: "margin:0 0 12px;color:#20231A;font-size:16px;font-weight:900;line-height:1.3;",
    list: "margin:0 0 16px;padding-left:22px;color:#20231A;font-size:15px;line-height:1.6;",
    li: "margin:0 0 4px;",
    a: "color:#34451F;text-decoration:underline;",
  },
  brand: {
    p: "font-size:16px;line-height:1.6;color:#5F624F;font-weight:500;",
    small: "font-size:12px;color:#5F624F;text-align:center;margin-top:24px;font-weight:500;",
    h2: "margin-top:0;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#1F1F1A;",
    h3: "margin:24px 0 8px;font-size:17px;font-weight:900;color:#1F1F1A;",
    list: "font-size:16px;line-height:1.6;color:#5F624F;font-weight:500;padding-left:22px;",
    li: "margin:0 0 4px;",
    a: "color:#26300D;text-decoration:underline;",
  },
  plain: {
    p: "",
    small: "font-size:12px;color:#6b7280;",
    h2: "margin-top:0;color:#111827;",
    h3: "color:#111827;",
    list: "padding-left:22px;",
    li: "",
    a: "color:#26300D;text-decoration:underline;",
  },
};

function styled(tag: string, style: string): string {
  return style ? `<${tag} style="${style}">` : `<${tag}>`;
}

export function styleTextHtml(html: string, family: EmailFamily, small = false): string {
  const s = FAMILY_TEXT_STYLES[family];
  return html
    .replace(/<p>/g, styled("p", small ? s.small : s.p))
    .replace(/<h2>/g, styled("h2", s.h2))
    .replace(/<h3>/g, styled("h3", s.h3))
    .replace(/<ul>/g, styled("ul", s.list))
    .replace(/<ol>/g, styled("ol", s.list))
    .replace(/<li>/g, styled("li", s.li))
    .replace(/<a href="([^"]*)">/g, (_m, href: string) => {
      const safe = linkOrEmpty(href);
      return safe ? `<a href="${safe}" style="${s.a}">` : "<a>";
    });
}

const SPACER_PX: Record<SpacerSize, number> = { s: 12, m: 24, l: 40 };

export function buttonHtml(label: string, url: string, accent: string): string {
  const href = linkOrEmpty(url);
  if (!href || !label.trim()) return "";
  return `<div style="text-align:center;margin:28px 0;"><a href="${href}" style="background-color:${accent};color:${textOn(accent)};padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:900;display:inline-block;letter-spacing:0.5px;">${escapeHtml(label)}</a></div>`;
}

export function renderBlocks(
  blocks: EmailBlock[],
  family: EmailFamily,
  accent: string,
  system: Partial<Record<SystemBlockKey, string>>
): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "text":
          return styleTextHtml(b.html, family, b.small);
        case "image": {
          const src = linkOrEmpty(b.url);
          if (!src) return "";
          const img = `<img src="${src}" alt="${escapeAttr(b.alt)}" style="display:inline-block;width:${b.width}%;max-width:100%;height:auto;border:0;">`;
          const href = b.href ? linkOrEmpty(b.href) : "";
          return `<div style="text-align:${b.align};margin:16px 0;">${href ? `<a href="${href}">${img}</a>` : img}</div>`;
        }
        case "button":
          return buttonHtml(b.label, b.url, accent);
        case "divider":
          return `<hr style="border:0;border-top:1px solid #D8D5C8;margin:24px 0;">`;
        case "spacer":
          return `<div style="height:${SPACER_PX[b.size]}px;line-height:${SPACER_PX[b.size]}px;font-size:1px;">&nbsp;</div>`;
        case "system":
          return system[b.key] ?? "";
      }
    })
    .join("\n");
}
