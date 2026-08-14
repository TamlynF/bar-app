/* The three HTML shells these emails are built from.

   They are kept apart on purpose. The venue currently sends three visually
   distinct families - the cream/olive booking card, the darker band shell, and
   the plain white card used by enquiries and acknowledgements - and moving the
   copy into the database is not the moment to redesign any of them. What this
   file does remove is the duplication: the band shell existed three times in
   one file, and the booking card existed four times across four.

   Merge values are escaped by the renderer before they reach here. Template
   copy is trusted (an admin wrote it, and the booking intros already rely on
   <strong>), so it is interpolated as-is. */

import { escapeHtml, safeUrl } from "./escape";
import { toParagraphs, type TemplateSlots } from "./render";

/* ── Shared brand card - booking confirmations, changes, admin alerts ──── */

/* Row labels and values are always data - a customer's name, a team name, a
   special request - never authored copy, so both halves are escaped here. */

export type DetailRow = { label: string; value: string };

export function detailRowsHtml(rows: DetailRow[]): string {
  return rows
    .map((row, index) => {
      const spacing = index === rows.length - 1 ? "" : "padding-bottom: 16px; ";
      return `
              <tr>
                <td style="${spacing}color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 900; white-space: nowrap; padding-right: 12px;">${escapeHtml(row.label)}</td>
                <td style="${spacing}text-align: right; font-weight: 900; color: #1F1F1A;">${escapeHtml(row.value)}</td>
              </tr>`;
    })
    .join("");
}

export type ChangeRow = { label: string; from: string; to: string };

export function changeRowsHtml(changes: ChangeRow[]): string {
  return changes
    .map(
      (change) => `
              <tr>
                <td style="padding-bottom: 6px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 900;">${escapeHtml(change.label)}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #1F1F1A; font-weight: 900;">
                  <span style="color: #9A9483; text-decoration: line-through;">${escapeHtml(change.from)}</span>
                  <span style="color: #5F624F;"> &rarr; </span>
                  <span>${escapeHtml(change.to)}</span>
                </td>
              </tr>`
    )
    .join("");
}

const brandParagraphs = (text: string): string =>
  toParagraphs(text)
    .map(
      (p) =>
        `<p style="font-size: 16px; line-height: 1.6; color: #5F624F; font-weight: 500;">${p}</p>`
    )
    .join("");

export function brandLayout(p: {
  slots: TemplateSlots;
  bodyHtml: string;
  ctaUrl?: string;
}): string {
  const href = p.ctaUrl ? safeUrl(p.ctaUrl) : "";
  const cta =
    href && p.slots.ctaLabel
      ? `
          <div style="text-align: center; margin: 40px 0 20px 0;">
            <a href="${href}" style="background-color: #FDCC4B; color: #26300D; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: 900; display: inline-block; text-transform: uppercase; letter-spacing: 1.5px;">${p.slots.ctaLabel}</a>
          </div>
          <p style="font-size: 12px; color: #5F624F; text-align: center; margin-top: 24px; font-weight: 500;">
            Button not working? Copy and paste this link:<br>
            <a href="${href}" style="color: #26300D; text-decoration: underline; margin-top: 8px; display: inline-block;">${href}</a>
          </p>`
      : "";

  const footnote = p.slots.footnote
    ? `<p style="font-size: 12px; color: #5F624F; text-align: center; margin-top: 24px; font-weight: 500;">${p.slots.footnote}</p>`
    : "";

  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F7F4EA; margin: 0; padding: 24px 10px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #E6DFC8;">
        <div style="background-color: #26300D; padding: 32px 16px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">${p.slots.heading}</h1>
          <p style="color: #FDCC4B; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">${p.slots.eyebrow || "Don Fenticas"}</p>
        </div>
        <div style="padding: 32px 20px; color: #1F1F1A;">
          <h2 style="margin-top: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">${p.slots.greeting}</h2>
          ${brandParagraphs(p.slots.intro)}
          <div style="background-color: #F7F4EA; border: 2px solid #E6DFC8; border-radius: 16px; padding: 20px 16px; margin: 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px;">${p.bodyHtml}
            </table>
          </div>
          ${brandParagraphs(p.slots.outro)}${cta}
          ${footnote}
        </div>
        <div style="background-color: #1F1F1A; padding: 30px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #E6DFC8; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; opacity: 0.6;">Don Fenticas · Licensed Venue</p>
        </div>
      </div>
    </div>
  `;
}

/* ── Band shell ───────────────────────────────────────────────────────── */

const bandParagraphs = (text: string): string =>
  toParagraphs(text)
    .map((p) => `<p style="margin:0 0 16px;color:#20231A;font-size:15px;line-height:1.6;">${p}</p>`)
    .join("");

export function bandCard(label: string, value: string, sub?: string): string {
  return `
        <div style="background:#fff;border:2px solid #D8D5C8;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5E6654;">${label}</p>
          <p style="margin:0;font-size:18px;font-weight:900;color:#20231A;">${value}</p>
          ${sub ? `<p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#5E6654;">${sub}</p>` : ""}
        </div>`;
}

export function bandNote(note: string): string {
  if (!note) return "";
  return `
        <div style="background:#fff;border-left:4px solid #34451F;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5E6654;">Note from our team</p>
          <p style="margin:0;font-size:14px;color:#20231A;line-height:1.5;">${note}</p>
        </div>`;
}

/* middleHtml sits between the intro and the outro, tailHtml after the outro -
   which is the only thing that differs between the offer, outcome and
   reschedule emails. */
export function bandLayout(p: {
  slots: TemplateSlots;
  groupName?: string | null;
  middleHtml?: string;
  tailHtml?: string;
}): string {
  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#F4F1E8;border-radius:16px;overflow:hidden;">
      <div style="background:#34451F;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#FDCC4B;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;">
          ${p.slots.heading}
        </h1>
        ${p.groupName ? `<p style="margin:8px 0 0;color:#D8D5C8;font-size:14px;font-weight:700;">${p.groupName}</p>` : ""}
      </div>
      <div style="padding:32px 24px;">
        <p style="margin:0 0 16px;color:#20231A;font-size:15px;line-height:1.6;">${p.slots.greeting}</p>
        ${bandParagraphs(p.slots.intro)}${p.middleHtml ?? ""}
        ${bandParagraphs(p.slots.outro)}${p.tailHtml ?? ""}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #D8D5C8;text-align:center;">
        <p style="margin:0;font-size:11px;color:#5E6654;">
          Don Fenticas - Unit 1, Regent St, Hinckley LE10 0BB
        </p>
      </div>
    </div>`;
}

/* ── Plain card - enquiries, acknowledgements, private hire outcomes ───── */

const plainParagraphs = (text: string, style = ""): string =>
  toParagraphs(text)
    .map((p) => `<p${style ? ` style="${style}"` : ""}>${p}</p>`)
    .join("");

export function plainPanel(innerHtml: string): string {
  return `<div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">${innerHtml}</div>`;
}

export function plainNote(note: string): string {
  if (!note) return "";
  return `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;"><p style="margin:0;"><strong>Note from our team:</strong> ${note}</p></div>`;
}

export function plainLayout(p: {
  slots: TemplateSlots;
  /* Contents of the grey panel. Acknowledgements put their outro copy here;
     the admin alerts put a generated field list here instead. */
  panelHtml?: string;
  bodyHtml?: string;
  ctaUrl?: string;
  /* Generated trailer such as "Enquiry ID: …", distinct from the editable
     footnote above it. */
  trailer?: string;
}): string {
  const href = p.ctaUrl ? safeUrl(p.ctaUrl) : "";
  const cta =
    href && p.slots.ctaLabel
      ? `
        <div style="text-align:center;margin:32px 0 20px 0;">
          <a href="${href}" style="background-color:#FDCC4B;color:#26300D;padding:16px 32px;text-decoration:none;border-radius:12px;font-weight:900;display:inline-block;text-transform:uppercase;letter-spacing:1.5px;">${p.slots.ctaLabel}</a>
        </div>
        <p style="font-size:12px;color:#6b7280;text-align:center;">
          Button not working? Copy and paste this link:<br>
          <a href="${href}" style="color:#26300D;text-decoration:underline;margin-top:8px;display:inline-block;">${href}</a>
        </p>`
      : "";

  const panel = p.panelHtml
    ? plainPanel(p.panelHtml)
    : p.slots.outro
      ? plainPanel(
          plainParagraphs(p.slots.outro, "margin:0;font-size:14px;color:#6b7280;")
        )
      : "";

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">${p.slots.greeting}</h2>
        ${plainParagraphs(p.slots.intro)}${p.bodyHtml ?? ""}
        ${panel}${cta}
        ${p.slots.footnote ? `<p style="font-size:12px;color:#6b7280;">${p.slots.footnote}</p>` : ""}
        ${p.trailer ? `<p style="font-size:12px;color:#6b7280;">${p.trailer}</p>` : ""}
      </div>
    </div>`;
}
