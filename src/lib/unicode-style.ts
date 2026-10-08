/* Chat apps (Instagram, Messenger, WhatsApp) take plain text only, so the only
   way to "style" a word is to swap its letters for the Mathematical
   Alphanumeric lookalikes - which every modern phone font draws - or to add
   a combining underline to each character. Screen readers stumble over
   these, so they are for emphasis on a word or two, not whole messages. */

export type UnicodeStyle = "bold" | "italic" | "bold-italic" | "underline";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

const BASES: Record<Exclude<UnicodeStyle, "underline">, { upper: number; lower: number; digit: number | null }> = {
  bold: { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  italic: { upper: 0x1d608, lower: 0x1d622, digit: null },
  "bold-italic": { upper: 0x1d63c, lower: 0x1d656, digit: 0x1d7ec },
};

const UNDERLINE = "̲";

function restyle(ch: string, style: Exclude<UnicodeStyle, "underline">): string {
  const base = BASES[style];
  const u = UPPER.indexOf(ch);
  if (u >= 0) return String.fromCodePoint(base.upper + u);
  const l = LOWER.indexOf(ch);
  if (l >= 0) return String.fromCodePoint(base.lower + l);
  const d = DIGITS.indexOf(ch);
  if (d >= 0 && base.digit != null) return String.fromCodePoint(base.digit + d);
  return ch;
}

export function styleText(text: string, style: UnicodeStyle): string {
  const plain = plainText(text);
  if (style === "underline") {
    return [...plain].map((ch) => (/\s/.test(ch) ? ch : ch + UNDERLINE)).join("");
  }
  return [...plain].map((ch) => restyle(ch, style)).join("");
}

/* Back to ordinary letters, so applying bold to an italic word swaps the
   style rather than piling one on another. */
export function plainText(text: string): string {
  let out = "";
  for (const ch of text.replace(/̲/g, "")) {
    const cp = ch.codePointAt(0)!;
    let mapped: string | null = null;
    for (const base of Object.values(BASES)) {
      if (cp >= base.upper && cp < base.upper + 26) mapped = UPPER[cp - base.upper];
      else if (cp >= base.lower && cp < base.lower + 26) mapped = LOWER[cp - base.lower];
      else if (base.digit != null && cp >= base.digit && cp < base.digit + 10) mapped = DIGITS[cp - base.digit];
      if (mapped) break;
    }
    out += mapped ?? ch;
  }
  return out;
}

export const CHAT_DIVIDER = "━━━━━━━━━━━━";

/* A short list that suits gig chat; the picker stays dependency-free. */
export const CHAT_EMOJIS = [
  "🎸", "🎤", "🎶", "🥁", "🎹", "🎧", "🎉", "🔥", "✨", "⭐", "🙌", "👏",
  "👋", "😊", "😎", "🤘", "🍻", "🍺", "🥂", "📅", "🕙", "📍", "💷", "✅",
  "💬", "🙏", "👍", "❤️", "🎊", "🎟️",
];
