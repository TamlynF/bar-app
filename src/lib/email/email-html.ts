import DOMPurify from "dompurify";

export type CleanEmail = { html: string; hasQuoted: boolean; blockedImages: number };

const FORBID_TAGS = [
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "base",
  "link",
  "meta",
  "script",
  "noscript",
];

const QUOTE_SELECTORS = [
  ".gmail_quote",
  ".gmail_extra",
  "blockquote[type='cite']",
  ".moz-cite-prefix",
  ".yahoo_quoted",
  "div[id^='mail-editor-reference-message']",
];

const OUTLOOK_REPLY_HEADERS = ["#divRplyFwdMsg", "#appendonsend"];

const REMOTE_URL = /^(?:https?:)?\/\//i;
const CSS_REMOTE_URL = /url\(\s*(['"]?)(?:https?:)?\/\/[^)]*\1\s*\)/gi;
const HAS_CSS_REMOTE_URL = /url\(\s*['"]?(?:https?:)?\/\//i;

function removeOutlookQuote(body: HTMLElement): boolean {
  const marker = body.querySelector<HTMLElement>(OUTLOOK_REPLY_HEADERS.join(","));
  if (!marker) return false;
  let node: Element | null = marker;
  while (node && node.parentElement && node.parentElement !== body && !node.previousElementSibling) {
    node = node.parentElement;
  }
  const prev = node?.previousElementSibling;
  if (prev?.tagName === "HR") prev.remove();
  while (node) {
    const next: Element | null = node.nextElementSibling;
    node.remove();
    node = next;
  }
  return true;
}

/* Inbound HTML is untrusted. It is cleaned here, then shown in a sandboxed
   iframe with no script permission and a CSP that only allows remote images
   once staff ask for them - so tracking pixels stay quiet by default. */
export function cleanEmailHtml(
  raw: string,
  { blockImages, includeQuoted }: { blockImages: boolean; includeQuoted: boolean }
): CleanEmail | null {
  if (typeof window === "undefined" || !DOMPurify.isSupported) return null;

  let blockedImages = 0;
  const hook = (node: Element) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
    if (!blockImages) return;
    const src = node.getAttribute("src");
    if (node.tagName === "IMG" && src && REMOTE_URL.test(src)) {
      node.removeAttribute("src");
      node.removeAttribute("srcset");
      blockedImages++;
    }
    const background = node.getAttribute("background");
    if (background && REMOTE_URL.test(background)) {
      node.removeAttribute("background");
      blockedImages++;
    }
    const style = node.getAttribute("style");
    if (style && HAS_CSS_REMOTE_URL.test(style)) {
      node.setAttribute("style", style.replace(CSS_REMOTE_URL, "none"));
      blockedImages++;
    }
  };

  DOMPurify.addHook("afterSanitizeAttributes", hook);
  const sanitized = DOMPurify.sanitize(raw, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS,
    FORBID_ATTR: ["srcdoc", "formaction", "ping"],
  });
  DOMPurify.removeHook("afterSanitizeAttributes", hook);

  const doc = new DOMParser().parseFromString(sanitized, "text/html");

  let hasQuoted = false;
  if (!includeQuoted) {
    for (const el of doc.body.querySelectorAll(QUOTE_SELECTORS.join(","))) {
      el.remove();
      hasQuoted = true;
    }
    if (removeOutlookQuote(doc.body)) hasQuoted = true;
  } else {
    hasQuoted =
      doc.body.querySelector(QUOTE_SELECTORS.join(",")) !== null ||
      doc.body.querySelector(OUTLOOK_REPLY_HEADERS.join(",")) !== null;
  }

  const styles = [...doc.querySelectorAll("style")]
    .map((s) => (blockImages ? (s.textContent ?? "").replace(CSS_REMOTE_URL, "none") : (s.textContent ?? "")))
    .join("\n");

  return {
    html: `${styles ? `<style>${styles}</style>` : ""}${doc.body.innerHTML}`,
    hasQuoted,
    blockedImages,
  };
}

const BASE_CSS = `
html,body{margin:0;padding:0;background:transparent;overflow:hidden}
body{font-family:Archivo,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13px;line-height:1.55;color:#20231A;overflow-wrap:anywhere}
img{max-width:100%;height:auto}
img:not([src]){display:none}
table{max-width:100%!important}
a{color:#34451F}
blockquote{margin:0 0 0 .25em;padding-left:.75em;border-left:2px solid #D8D5C8;color:#5E6654}
p{margin:0 0 .75em}
`;

export function emailFrameDocument(html: string, allowImages: boolean): string {
  const imgSrc = allowImages ? "data: https: http:" : "data:";
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src ${imgSrc}; font-src data:`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>${BASE_CSS}</style></head><body>${html}</body></html>`;
}
