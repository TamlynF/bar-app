import type { PictureSheetInput } from "./picture-sheet-pdf";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* The same A4 sheet as the PDF - team name line, the question, a 3x3 grid of
   pictures and an answers block - as a self-contained HTML document, so a
   phone can print it from a hidden frame without leaving the page. */
export function buildPictureSheetHtml(input: PictureSheetInput): string {
  const cells = input.cells
    .map(
      (cell) => `
        <div class="cell">
          <span class="q">Q${cell.no}</span>
          ${
            cell.imageUrl
              ? `<img src="${escapeHtml(cell.imageUrl)}" alt="" />`
              : ""
          }
        </div>`
    )
    .join("");
  const answers = input.cells
    .map((cell) => `<div class="answer"><span>Q${cell.no}:</span><i></i></div>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.title)}</title>
<style>
  /* A zero page margin leaves the browser nowhere to print its own header and
     footer (site URL, date, page number); the sheet carries its margin itself. */
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Helvetica, Arial, sans-serif; }
  body { padding: 10mm; font-size: 11pt; line-height: 1.25; }
  .sheet { break-inside: avoid; page-break-inside: avoid; }
  .team { font-weight: bold; font-size: 12pt; margin: 0 0 4mm; }
  .team i { display: inline-block; width: 90mm; border-bottom: 0.3mm solid #000; margin-left: 3mm; }
  .question { margin: 0 0 3mm; text-align: center; }
  .question b { margin-right: 2mm; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); }
  .cell { position: relative; height: 50mm; border: 0.3mm solid #000; margin: 0 -0.3mm -0.3mm 0; box-sizing: border-box; padding: 7.5mm 2.5mm 2.5mm; }
  .cell .q { position: absolute; top: 1.5mm; left: 2.5mm; font-weight: bold; }
  .cell img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .answers-title { margin: 6mm 0 2mm; text-align: center; font-weight: bold; font-size: 12pt; }
  .answers { display: grid; grid-template-columns: repeat(3, 1fr); row-gap: 3mm; }
  .answer { display: flex; align-items: baseline; gap: 2mm; padding: 0 3mm 0 2mm; }
  .answer i { flex: 1; border-bottom: 0.3mm solid #000; height: 4mm; }
</style>
</head>
<body>
  <div class="sheet">
    <p class="team">Team Name:<i></i></p>
    <p class="question"><b>Question:</b>${escapeHtml(input.question)}</p>
    <div class="grid">${cells}</div>
    <p class="answers-title">Answers:</p>
    <div class="answers">${answers}</div>
  </div>
</body>
</html>`;
}
