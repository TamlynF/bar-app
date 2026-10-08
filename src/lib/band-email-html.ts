import { bandSlotCardLabel, offerLikeBandEmail, type BandEmail, type BandEmailKind } from "@/lib/band-emails";
import { escapeHtml } from "@/lib/email/escape";
import { bandCard, bandLayout, bandNote } from "@/lib/email/layout";
import type { RenderedSlots } from "@/lib/email/design";

export function plainNoteHtml(note: string): string {
  return escapeHtml(note.trim()).replace(/\n/g, "<br>");
}

/* The one place a band email's HTML is put together, so the confirm dialog's
   preview is the exact email the server sends. noteHtml must already be safe:
   escaped plain text, or a cleaned editor fragment. */
/* The offer's answer buttons, each a link into the act's offer page with the
   answer preselected - one tap on a phone, no mail client involved. */
export function bandOfferActionsHtml(url: string, brand: { accent?: string | null } = {}): string {
  const accent = brand.accent ?? "#34451F";
  const button = (label: string, href: string, solid: boolean) =>
    `<a href="${href}" style="display:block;margin:0 0 10px;padding:14px 18px;border-radius:12px;text-align:center;font-size:14px;font-weight:900;text-decoration:none;${
      solid
        ? `background:${accent};color:#ffffff;`
        : `background:#ffffff;color:#20231A;border:2px solid #D8D5C8;`
    }">${label}</a>`;
  return `
        <div style="margin:24px 0 8px;">
          ${button("Yes, I accept this slot", `${url}?respond=accept`, true)}
          ${button("I'd like to discuss it", `${url}?respond=discuss`, false)}
          ${button("Withdraw my application", `${url}?respond=withdraw`, false)}
          <p style="margin:12px 0 0;font-size:12px;color:#5E6654;text-align:center;">Buttons not working? Just reply to this email.</p>
        </div>`;
}

export function bandEmailHtml(p: {
  kind: BandEmailKind;
  slots: RenderedSlots;
  email: BandEmail;
  groupName: string | null;
  noteHtml: string;
  /* The act's offer page - the offer email puts its answer buttons under the card. */
  actionsUrl?: string;
}): string {
  const e = p.email;
  const brand = p.slots.design?.brand;
  const cardTitle = p.slots.cardTitle || bandSlotCardLabel(p.kind);
  const offerLike = offerLikeBandEmail(p.kind);
  const card =
    offerLike
      ? bandCard(cardTitle, escapeHtml(e.slotLabel ?? ""), escapeHtml(e.feeLabel ?? ""), brand)
      : e.dateLabel
        ? bandCard(
            cardTitle,
            escapeHtml(e.dateLabel),
            escapeHtml([e.timeLabel, e.feeLabel].filter(Boolean).join(" · ")),
            brand
          )
        : "";
  const note = bandNote(p.noteHtml, brand, p.slots.noteTitle || undefined);
  const actions =
    (p.kind === "offered" || p.kind === "rescheduled") && p.actionsUrl ? bandOfferActionsHtml(p.actionsUrl, brand ?? {}) : "";
  return bandLayout({
    slots: p.slots,
    groupName: p.groupName ? escapeHtml(p.groupName) : null,
    middleHtml: offerLike ? card + note + actions : card,
    tailHtml: offerLike ? "" : note + actions,
    cardHtml: card,
    noteHtml: note + actions,
  });
}
