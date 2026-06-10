import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const CSS = join(SRC, "app", "globals.css");

// ---- 1. Collect source files ----
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, acc);
    } else if ([".tsx", ".ts", ".jsx", ".js"].includes(extname(name))) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(SRC);
const used = new Map(); // token -> Set(files)

function addToken(tok, file) {
  tok = tok.trim();
  if (!tok) return;
  if (tok.includes("${") || tok.includes("{") || tok.includes("}")) return;
  if (!used.has(tok)) used.set(tok, new Set());
  used.get(tok).add(file);
}

// Extract class-bearing regions: className=..., class=..., cn(...), clsx(...),
// cva(...), tv(...), twMerge(...), variant maps. We grab the region text then
// pull *string literals* out of it and split on whitespace.
function extractRegions(txt) {
  const regions = [];
  // className="..." or className='...' or className={`...`} or className={cn(...)}
  // We do a balanced-ish capture for className={ ... } and the call helpers.
  const attrRe = /\bclass(?:Name)?\s*=\s*/g;
  let m;
  while ((m = attrRe.exec(txt))) {
    let i = m.index + m[0].length;
    const ch = txt[i];
    if (ch === '"' || ch === "'") {
      const end = txt.indexOf(ch, i + 1);
      if (end > i) regions.push(txt.slice(i + 1, end));
    } else if (ch === "{") {
      // balance braces
      let depth = 0, j = i;
      for (; j < txt.length; j++) {
        if (txt[j] === "{") depth++;
        else if (txt[j] === "}") { depth--; if (depth === 0) break; }
      }
      regions.push(txt.slice(i + 1, j));
    }
  }
  // helper calls: cn(...), clsx(...), cva(...), tv(...), twMerge(...), cx(...)
  const callRe = /\b(?:cn|clsx|cva|tv|twMerge|cx|classNames)\s*\(/g;
  while ((m = callRe.exec(txt))) {
    let depth = 0, j = m.index + m[0].length - 1;
    const start = j + 1;
    for (; j < txt.length; j++) {
      if (txt[j] === "(") depth++;
      else if (txt[j] === ")") { depth--; if (depth === 0) break; }
    }
    regions.push(txt.slice(start, j));
  }
  return regions;
}

// pull string literals from a region and tokenise
const litRe = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
for (const f of files) {
  const txt = readFileSync(f, "utf8");
  for (const region of extractRegions(txt)) {
    let lm;
    litRe.lastIndex = 0;
    while ((lm = litRe.exec(region))) {
      for (const tok of lm[2].split(/\s+/)) addToken(tok, f);
    }
  }
}

// ---- 2. Collect defined class selectors in globals.css ----
const css = readFileSync(CSS, "utf8");
const defined = new Set();
const selRe = /\.((?:\\.|[-a-zA-Z0-9\/\[\]().#%,:*+!&'"<>=._])+)(?=[\s,{>~+]|::|$)/gm;
let sm;
// classFromRaw: take chars until first UNESCAPED ":" or "(" (pseudo boundary).
// Class-internal colons/parens are always backslash-escaped in this file.
function classFromRaw(raw) {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "\\") { out += raw[i + 1]; i++; continue; }
    if (raw[i] === ":" || raw[i] === "(") break;
    out += raw[i];
  }
  return out;
}
while ((sm = selRe.exec(css))) {
  defined.add(sm[1].replace(/\\(.)/g, "$1")); // full (nested-form classes)
  defined.add(classFromRaw(sm[1]));           // class only (flat pseudo form)
}

// ---- 3. Strip variant prefixes from used tokens ----
function baseClass(tok) {
  let depth = 0, lastColon = -1;
  for (let i = 0; i < tok.length; i++) {
    const c = tok[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === ":" && depth === 0) lastColon = i;
  }
  let base = lastColon >= 0 ? tok.slice(lastColon + 1) : tok;
  if (base.startsWith("!")) base = base.slice(1);
  return base;
}

// A token must look like a real tailwind utility to count.
function looksUtility(base) {
  if (!base) return false;
  // arbitrary value / property
  if (/[-\[]/.test(base) && /[\[\]]/.test(base)) return true;
  // standard util: starts with optional -, lowercase letter, has at least one dash OR is bare known
  if (/^-?[a-z][a-z0-9]*(-[a-z0-9.\/%]+)+$/.test(base)) return true;
  // bare utilities (single word)
  const bareKnown = new Set([
    "flex","grid","block","hidden","inline","table","contents","relative","absolute",
    "fixed","sticky","static","container","truncate","italic","underline","uppercase",
    "lowercase","capitalize","border","rounded","shadow","ring","outline","group","peer",
    "isolate","grow","shrink","invisible","visible","sr-only","antialiased","transition",
    "overflow-hidden","appearance-none","resize","sr",
  ]);
  return bareKnown.has(base);
}

const missing = new Map();
for (const [tok, fileset] of used) {
  const base = baseClass(tok);
  if (!looksUtility(base)) continue;
  if (defined.has(base) || defined.has(tok)) continue;
  if (!missing.has(base)) missing.set(base, { toks: new Set(), files: new Set() });
  const e = missing.get(base);
  e.toks.add(tok);
  for (const fl of fileset) e.files.add(fl);
}

// Re-do: report the FULL tokens (with variants) that are missing, since variant
// forms need their own compiled selector.
const IGNORE_BASES = new Set(["ev-text", "icon-xs", "icon-sm", "icon-lg", "group", "sr", "peer"]);
const missingTokens = new Map(); // full token -> Set(files)
for (const [tok, fileset] of used) {
  const base = baseClass(tok);
  if (!looksUtility(base)) continue;
  if (IGNORE_BASES.has(base)) continue;
  if (defined.has(tok)) continue;       // exact selector already present
  if (defined.has(base) && tok === base) continue; // bare & defined
  // strip stray surrounding quotes captured from JSX
  const clean = tok.replace(/^["']+|["']+$/g, "");
  if (defined.has(clean)) continue;
  if (!missingTokens.has(clean)) missingTokens.set(clean, new Set());
  for (const fl of fileset) missingTokens.get(clean).add(fl);
}

const report = [...missingTokens.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`Source files: ${files.length}`);
console.log(`Defined selectors: ${defined.size}`);
console.log(`Missing tokens (with variants): ${report.length}`);
console.log("====");
for (const [tok, fs] of report) {
  console.log(`${tok}\t\t[${[...fs].length} file(s)]`);
}
