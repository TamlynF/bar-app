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
export function bandEmailHtml(p: {
  kind: BandEmailKind;
  slots: RenderedSlots;
  email: BandEmail;
  groupName: string | null;
  noteHtml: string;
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
  return bandLayout({
    slots: p.slots,
    groupName: p.groupName ? escapeHtml(p.groupName) : null,
    middleHtml: offerLike ? card + note : card,
    tailHtml: offerLike ? "" : note,
    cardHtml: card,
    noteHtml: note,
  });
}
