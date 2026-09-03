export type PictureSheetCell = {
  no: number;
  imageUrl: string | null;
};

export type PictureSheetInput = {
  title: string;
  question: string;
  cells: PictureSheetCell[];
};

type Box = { x: number; y: number; width: number; height: number };

const PAGE_WIDTH = 210;
const MARGIN = 12;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLS = 3;
const PICTURE_CELL_HEIGHT = 58;
const ANSWER_ROW_HEIGHT = 13;
const LINE_HEIGHT = 5.5;
const MAX_IMAGE_EDGE_PX = 1000;

export function fitContain(
  imageWidth: number,
  imageHeight: number,
  box: Box
): Box {
  if (imageWidth <= 0 || imageHeight <= 0) return { ...box, width: 0, height: 0 };
  const scale = Math.min(box.width / imageWidth, box.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

export function pictureSheetUsesShareSheet(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  const probe = new File([new Blob()], "probe.pdf", { type: "application/pdf" });
  return navigator.canShare({ files: [probe] });
}

export type ShareOutcome = "shared" | "dismissed" | "blocked";

export async function sharePictureSheet(file: File, title: string): Promise<ShareOutcome> {
  try {
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "dismissed";
    return "blocked";
  }
}

export function pictureSheetFileName(title: string): string {
  return `${title.replace(/[\\/:*?"<>|]+/g, "-").trim()}.pdf`;
}

type LoadedImage = { data: string; width: number; height: number };

async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, MAX_IMAGE_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return { data: canvas.toDataURL("image/jpeg", 0.85), width, height };
  } catch {
    return null;
  }
}

export async function buildPictureSheetPdf(input: PictureSheetInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const images = await Promise.all(
    input.cells.map((cell) => (cell.imageUrl ? loadImage(cell.imageUrl) : Promise.resolve(null)))
  );

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({ title: input.title });
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.setTextColor(0);

  let y = 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Team Name:", MARGIN, y);
  const teamLabelWidth = doc.getTextWidth("Team Name:");
  doc.line(MARGIN + teamLabelWidth + 3, y + 0.5, MARGIN + teamLabelWidth + 3 + 90, y + 0.5);

  y += 10;
  const questionLabel = "Question:";
  const questionLabelWidth = doc.getTextWidth(questionLabel);
  doc.setFont("helvetica", "normal");
  const questionLines: string[] = doc.splitTextToSize(
    input.question,
    CONTENT_WIDTH - questionLabelWidth - 2
  );
  const firstLineWidth = questionLines[0] ? doc.getTextWidth(questionLines[0]) : 0;
  const questionX =
    questionLines.length > 1
      ? MARGIN
      : (PAGE_WIDTH - (questionLabelWidth + 2 + firstLineWidth)) / 2;
  doc.setFont("helvetica", "bold");
  doc.text(questionLabel, questionX, y);
  doc.setFont("helvetica", "normal");
  questionLines.forEach((line, index) => {
    doc.text(line, questionX + questionLabelWidth + 2, y + index * LINE_HEIGHT);
  });
  y += Math.max(1, questionLines.length) * LINE_HEIGHT;

  const cellWidth = CONTENT_WIDTH / COLS;
  doc.setFontSize(11);
  input.cells.forEach((cell, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = MARGIN + col * cellWidth;
    const top = y + row * PICTURE_CELL_HEIGHT;
    doc.rect(x, top, cellWidth, PICTURE_CELL_HEIGHT);
    doc.setFont("helvetica", "bold");
    doc.text(`Q${cell.no}`, x + 2.5, top + 6);

    const imageBox: Box = {
      x: x + 3,
      y: top + 8.5,
      width: cellWidth - 6,
      height: PICTURE_CELL_HEIGHT - 11.5,
    };
    const image = images[index];
    if (image) {
      const placed = fitContain(image.width, image.height, imageBox);
      doc.addImage(image.data, "JPEG", placed.x, placed.y, placed.width, placed.height);
    } else if (cell.imageUrl) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text("Image unavailable", x + cellWidth / 2, top + PICTURE_CELL_HEIGHT / 2, {
        align: "center",
      });
      doc.setTextColor(0);
    }
  });
  y += Math.ceil(input.cells.length / COLS) * PICTURE_CELL_HEIGHT;

  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Answers:", PAGE_WIDTH / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(11);
  input.cells.forEach((cell, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = MARGIN + col * cellWidth;
    const baseline = y + row * ANSWER_ROW_HEIGHT + 8;
    const label = `Q${cell.no}:`;
    doc.text(label, x + 2, baseline);
    const labelWidth = doc.getTextWidth(label);
    doc.line(x + 2 + labelWidth + 2, baseline + 0.5, x + cellWidth - 3, baseline + 0.5);
  });

  doc.autoPrint();
  return doc.output("blob");
}
