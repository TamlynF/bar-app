import type { HostCopy } from "./host-copy";
import { QR_OPTIONS } from "./playlist-qr";

const QR_SIZE = 28;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - MARGIN;
const LINE = 5;
const MUTED: [number, number, number] = [94, 102, 84];

/* A4 host copy built the same way as the picture sheet, so a phone can hand it
   to the share sheet and a desktop can open it in a tab. Text only - the
   pictures have their own sheet. */
export async function buildHostCopyPdf(copy: HostCopy): Promise<Blob> {
  const [{ jsPDF }, QRCode] = await Promise.all([import("jspdf"), import("qrcode")]);
  const playlistUrls = [...new Set(copy.rounds.flatMap((round) => (round.playlistUrl ? [round.playlistUrl] : [])))];
  const qrByUrl = new Map(
    await Promise.all(
      [copy.questionsUrl, ...playlistUrls].map(async (url) => [url, await QRCode.toDataURL(url, QR_OPTIONS)] as const)
    )
  );
  const questionsQr = qrByUrl.get(copy.questionsUrl);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({ title: `${copy.title} - host copy` });
  doc.setTextColor(0);

  let y = MARGIN;
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const paragraph = (text: string, x: number, width: number, style: "normal" | "bold", size: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text, width);
    ensure(lines.length * LINE);
    doc.text(lines, x, y);
    y += lines.length * LINE;
  };

  const headerWidth = questionsQr ? CONTENT_WIDTH - QR_SIZE - 6 : CONTENT_WIDTH;
  if (questionsQr) {
    const x = PAGE_WIDTH - MARGIN - QR_SIZE;
    doc.addImage(questionsQr, "PNG", x, y, QR_SIZE, QR_SIZE, undefined, "FAST");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("Scan to open the quiz questions", x + QR_SIZE / 2, y + QR_SIZE + 3.5, { align: "center" });
    doc.setTextColor(0);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("HOST COPY - QUESTIONS AND ANSWERS", MARGIN, y);
  doc.setTextColor(0);
  y += 6;
  paragraph(copy.title, MARGIN, headerWidth, "bold", 16);
  doc.setTextColor(...MUTED);
  paragraph(copy.subtitle, MARGIN, headerWidth, "normal", 10);
  doc.setTextColor(0);
  if (questionsQr) y = Math.max(y, MARGIN + QR_SIZE + 6);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  copy.rounds.forEach((round, index) => {
    if (index > 0) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(round.title, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(round.progress, PAGE_WIDTH - MARGIN, y, { align: "right" });
    doc.setTextColor(0);
    y += 2.5;
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 6;

    if (round.playlistUrl) {
      paragraph(`Playlist: ${round.playlistUrl}`, MARGIN, CONTENT_WIDTH, "normal", 9);
      const qr = qrByUrl.get(round.playlistUrl);
      if (qr) {
        ensure(QR_SIZE + 2);
        doc.addImage(qr, "PNG", MARGIN, y, QR_SIZE, QR_SIZE, undefined, "FAST");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        const caption: string[] = doc.splitTextToSize(
          "Scan with a phone camera to open this round's playlist in Spotify.",
          CONTENT_WIDTH - QR_SIZE - 4
        );
        doc.text(caption, MARGIN + QR_SIZE + 4, y + 5);
        doc.setTextColor(0);
        y += QR_SIZE + 2;
      }
    }
    if (round.sharedQuestion) paragraph(`Question: ${round.sharedQuestion}`, MARGIN, CONTENT_WIDTH, "bold", 10);
    if (round.playlistUrl || round.sharedQuestion) y += 2;

    if (round.lines.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text("No questions saved for this round.", MARGIN, y);
      y += LINE;
      return;
    }

    round.lines.forEach((line) => {
      const questionLines: string[] = doc.splitTextToSize(`${line.number}. ${line.question}`, CONTENT_WIDTH);
      const answerLines: string[] = doc.splitTextToSize(`A: ${line.answer}`, CONTENT_WIDTH - 6);
      const noteLines: string[] = line.note ? doc.splitTextToSize(line.note, CONTENT_WIDTH - 6) : [];
      ensure((questionLines.length + answerLines.length + noteLines.length) * LINE + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(questionLines, MARGIN, y);
      y += questionLines.length * LINE;
      doc.setFont("helvetica", "bold");
      doc.text(answerLines, MARGIN + 6, y);
      y += answerLines.length * LINE;
      if (noteLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text(noteLines, MARGIN + 6, y);
        doc.setTextColor(0);
        y += noteLines.length * LINE;
      }
      y += 3;
    });
  });

  doc.autoPrint();
  return doc.output("blob");
}
