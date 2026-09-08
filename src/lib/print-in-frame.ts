/* Browsers only honour print() while a tap is still "fresh", and navigating
   away throws that away - Chrome then shows "blocked from automatically
   printing". Loading the document into a hidden same-origin frame and printing
   the frame keeps the whole thing inside the one tap. The frame stays around
   for a minute so a slow print dialog is never cut off. */

const FRAME_LIFETIME_MS = 60_000;
/* A tap only authorises a print for a few seconds, so images get this long to
   decode before the dialog opens regardless. */
const IMAGE_WAIT_MS = 1_500;

function mountFrame(setSource: (frame: HTMLIFrameElement) => void) {
  const frame = document.createElement("iframe");
  frame.title = "Print preview";
  frame.setAttribute("aria-hidden", "true");
  frame.className = "sr-only";
  frame.onload = async () => {
    const win = frame.contentWindow;
    if (!win) return;
    const images = Array.from(win.document.images);
    await Promise.race([
      Promise.allSettled(images.map((img) => img.decode())),
      new Promise((resolve) => setTimeout(resolve, IMAGE_WAIT_MS)),
    ]);
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), FRAME_LIFETIME_MS);
  };
  setSource(frame);
  document.body.appendChild(frame);
}

export function printUrlInFrame(url: string) {
  mountFrame((frame) => {
    frame.src = url;
  });
}

export function printHtmlInFrame(html: string) {
  mountFrame((frame) => {
    frame.srcdoc = html;
  });
}
