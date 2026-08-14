/* Turning stored template copy into the strings an email is built from.

   The eight slots below are the whole editable surface of an email. Everything
   else - the branded shell, the detail-row tables, the change lists, the loops
   over a band's video links - is generated, because none of it can be authored
   as free text: the rows vary in number and the styling of the last one differs
   from the rest. So an admin edits the words around the generated block, never
   the block itself. */

import { escapeHtml } from "./escape";

export const SLOT_KEYS = [
  "subject",
  "heading",
  "eyebrow",
  "greeting",
  "intro",
  "outro",
  "ctaLabel",
  "footnote",
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

export type TemplateSlots = Record<SlotKey, string>;

export const EMPTY_SLOTS: TemplateSlots = {
  subject: "",
  heading: "",
  eyebrow: "",
  greeting: "",
  intro: "",
  outro: "",
  ctaLabel: "",
  footnote: "",
};

/* The subject line lands in a mail client's list view as plain text, so its
   merge values are substituted raw - escaping there would show a customer
   "Smith &amp; Sons" in their inbox. */
const PLAIN_TEXT_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>(["subject", "ctaLabel"]);

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type MergeValues = Record<string, string | null | undefined>;

export type RenderResult = {
  slots: TemplateSlots;
  /* Tokens the copy asks for that the scenario does not supply. Left verbatim in
     the output rather than blanked, so a typo shows up in the preview instead of
     silently deleting half a sentence from a customer's email. */
  unknownTokens: string[];
};

function substitute(
  template: string,
  values: MergeValues,
  escape: boolean,
  unknown: Set<string>
): string {
  return template.replace(TOKEN, (match, token: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, token)) {
      unknown.add(token);
      return match;
    }
    const value = values[token];
    if (value == null) return "";
    return escape ? escapeHtml(value) : value;
  });
}

export function renderSlots(slots: TemplateSlots, values: MergeValues): RenderResult {
  const unknown = new Set<string>();

  const rendered = SLOT_KEYS.reduce((acc, key) => {
    acc[key] = substitute(slots[key] ?? "", values, !PLAIN_TEXT_SLOTS.has(key), unknown);
    return acc;
  }, {} as TemplateSlots);

  return { slots: rendered, unknownTokens: [...unknown] };
}

/* Blank lines separate paragraphs. Single newlines are left alone so a wrapped
   line in the textarea doesn't become a new <p>. */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/* Which tokens a piece of copy actually uses - drives the "this template
   references a field that doesn't exist" warning in the editor. */
export function tokensUsed(slots: TemplateSlots): string[] {
  const found = new Set<string>();
  for (const key of SLOT_KEYS) {
    for (const match of (slots[key] ?? "").matchAll(TOKEN)) {
      found.add(match[1]);
    }
  }
  return [...found];
}
