// Minimal CSS block walker shared by the design-sync build scripts. It tracks
// the chain of enclosing preludes (selectors and at-rules) and reports every
// declaration and every block with its byte offsets in the ORIGINAL text, so
// callers can both extract and annotate in place. Comments are skipped, and
// quotes and backslash escapes are honoured (Tailwind selectors carry escaped
// quotes and brackets, which otherwise swallow the rest of the file).
export function walkCss(text, { onDecl, onBlock } = {}) {
  const stack = [];
  let buf = "";
  let bufStart = 0;
  let quote = null;
  const flushDecl = (end) => {
    const decl = buf.trim();
    if (decl) {
      const idx = decl.indexOf(":");
      if (idx > 0) {
        const name = decl.slice(0, idx).trim();
        const value = decl.slice(idx + 1).trim();
        onDecl?.({ chain: [...stack], name, value, start: bufStart, end });
      }
    }
    buf = "";
    bufStart = end + 1;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      buf += ch;
      if (ch === "\\") { buf += text[++i] ?? ""; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close < 0 ? text.length : close + 1;
      continue;
    }
    if (ch === "\\") { buf += ch + (text[++i] ?? ""); continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "{") {
      const prelude = buf.trim();
      stack.push({ prelude, start: bufStart, open: i });
      buf = "";
      bufStart = i + 1;
      continue;
    }
    if (ch === ";") { flushDecl(i); continue; }
    if (ch === "}") {
      flushDecl(i);
      const block = stack.pop();
      if (block) onBlock?.({ chain: stack.map((b) => b.prelude), prelude: block.prelude, start: block.start, open: block.open, end: i });
      bufStart = i + 1;
      continue;
    }
    if (!buf && /\s/.test(ch)) { bufStart = i + 1; continue; }
    buf += ch;
  }
}

export const isTokenScope = (prelude) =>
  prelude
    .split(",")
    .map((s) => s.trim())
    .every((s) =>
      s === ":root" || s === ":host" || s === "html" || s === ".dark" ||
      /^\[data-[\w-]+(?:=[^\]]*)?\]$/.test(s) ||
      /^:root\[data-[\w-]+(?:=[^\]]*)?\]$/.test(s));

export const chainOf = (d) => d.chain.map((b) => (typeof b === "string" ? b : b.prelude));
