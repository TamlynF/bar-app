import { escapeHtml } from "@/lib/email/escape";

/* Email is cheap but attention isn't: a few per night, like the texts, and
   every one carries its own unsubscribe link. */
export const EMAIL_MAX_PER_NIGHT = 6;
export const VERIFICATION_CODE_TTL_MIN = 10;

const OLIVE = "#26300D";
const GOLD = "#FDCC4B";
const CREAM = "#F7F4EA";
const INK = "#1F1F1A";
const MUTED = "#5F624F";

function shell(heading: string, bodyHtml: string, footerHtml: string): string {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: ${CREAM}; margin: 0; padding: 24px 10px;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #E6DFC8;">
        <div style="background-color: ${OLIVE}; padding: 28px 16px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px;">${heading}</h1>
          <p style="color: ${GOLD}; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Market Night · Don Fenticas</p>
        </div>
        <div style="padding: 28px 20px; color: ${INK};">${bodyHtml}</div>
        <div style="padding: 0 20px 24px; text-align: center; font-size: 12px; color: ${MUTED};">${footerHtml}</div>
      </div>
    </div>`;
}

function button(href: string, label: string): string {
  return `
    <div style="text-align: center; margin: 28px 0 8px;">
      <a href="${escapeHtml(href)}" style="background-color: ${GOLD}; color: ${OLIVE}; padding: 16px 32px; text-decoration: none; border-radius: 14px; font-weight: 900; display: inline-block; text-transform: uppercase; letter-spacing: 1.5px;">${label}</a>
    </div>`;
}

export function marketEmailSubject(lines: string[], crash: boolean): string {
  if (crash) return "Market crash - every drink is dropping";
  if (lines.length === 1) return `Market Night: ${lines[0]}`;
  return `Market Night: ${lines.length} drinks on the move`;
}

export function marketEmailHtml(p: { lines: string[]; crash: boolean; marketUrl: string; unsubscribeUrl: string }): string {
  const items = p.lines
    .map((line) => `<li style="margin: 0 0 10px; font-size: 16px; line-height: 1.5;">${escapeHtml(line)}</li>`)
    .join("");
  const body = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${MUTED};">${
      p.crash ? "Buy the dip - the whole board is heading for its floor price." : "Prices just moved on the board:"
    }</p>
    <ul style="margin: 0; padding: 0 0 0 20px;">${items}</ul>
    ${button(p.marketUrl, "See the live board")}`;
  const footer = `You're getting this because you asked for Market Night price alerts.<br>
    <a href="${escapeHtml(p.unsubscribeUrl)}" style="color: ${OLIVE}; text-decoration: underline;">Unsubscribe</a>`;
  return shell(p.crash ? "Market crash" : "Prices are dropping", body, footer);
}

export function marketEmailText(p: { lines: string[]; crash: boolean; marketUrl: string; unsubscribeUrl: string }): string {
  return [
    p.crash ? "Market crash - buy the dip" : "Market Night: prices just moved",
    "",
    ...p.lines.map((line) => `- ${line}`),
    "",
    `Live board: ${p.marketUrl}`,
    `Unsubscribe: ${p.unsubscribeUrl}`,
  ].join("\n");
}

export function verificationEmailSubject(code: string): string {
  return `${code} is your Market Night code`;
}

export function verificationEmailHtml(code: string): string {
  const body = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${MUTED};">Enter this code on the Market Night page to turn on price-drop emails.</p>
    <p style="margin: 0; text-align: center; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: ${INK};">${escapeHtml(code)}</p>
    <p style="margin: 16px 0 0; text-align: center; font-size: 13px; color: ${MUTED};">It expires in ${VERIFICATION_CODE_TTL_MIN} minutes.</p>`;
  return shell("Your code", body, "Didn't ask for this? Ignore it and nothing will be sent.");
}

export function verificationEmailText(code: string): string {
  return `Your Market Night code is ${code}. It expires in ${VERIFICATION_CODE_TTL_MIN} minutes. Didn't ask for this? Ignore it.`;
}
