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
              ? `<img src="${escapeHtml(cell.imageUrl)}" alt="" crossorigin="anonymous" />`
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
  @page { size: A4 portrait; margin: 12mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Helvetica, Arial, sans-serif; }
  body { font-size: 11pt; line-height: 1.3; }
  .team { font-weight: bold; font-size: 12pt; margin: 10mm 0 6mm; }
  .team i { display: inline-block; width: 90mm; border-bottom: 0.3mm solid #000; margin-left: 3mm; }
  .question { margin-bottom: 4mm; text-align: center; }
  .question b { margin-right: 2mm; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); }
  .cell { position: relative; height: 58mm; border: 0.3mm solid #000; margin: 0 -0.3mm -0.3mm 0; box-sizing: border-box; padding: 8.5mm 3mm 3mm; }
  .cell .q { position: absolute; top: 2mm; left: 2.5mm; font-weight: bold; }
  .cell img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .answers-title { margin: 9mm 0 3mm; text-align: center; font-weight: bold; font-size: 12pt; }
  .answers { display: grid; grid-template-columns: repeat(3, 1fr); row-gap: 5mm; }
  .answer { display: flex; align-items: baseline; gap: 2mm; padding: 0 3mm 0 2mm; }
  .answer i { flex: 1; border-bottom: 0.3mm solid #000; height: 4mm; }
</style>
</head>
<body>
  <p class="team">Team Name:<i></i></p>
  <p class="question"><b>Question:</b>${escapeHtml(input.question)}</p>
  <div class="grid">${cells}</div>
  <p class="answers-title">Answers:</p>
  <div class="answers">${answers}</div>
</body>
</html>`;
}
