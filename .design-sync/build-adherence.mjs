// Rebuilds _adherence.oxlintrc.json for the Claude Design project from the
// tokens the sync actually ships (tokens/tokens.css), on top of the rules the
// app last generated (cached at .design-sync/.cache/adherence-remote.json).
// Run from the REPO ROOT after the driver has written ds-bundle/:
//   node .design-sync/build-adherence.mjs
//
// Token rule 3 (NOTES.md "Token rules"): the token list and tokenKinds carry
// no --tw-* entries at all; --animate-* / --ease-* / --default-* / --aspect-*
// are "other"; everything else keeps the kind the app assigned, or gets one
// from the name/value when the app never saw it.
import { readFileSync, writeFileSync } from "node:fs";

const BASE = ".design-sync/.cache/adherence-remote.json";
const TOKENS = "ds-bundle/tokens/tokens.css";
const OUT = "ds-bundle/_adherence.oxlintrc.json";
const OTHER_KIND = /^--(animate|ease|default|aspect)-/;

const guessKind = (name, value) => {
  if (OTHER_KIND.test(name)) return "other";
  if (/^--(font|text|tracking|leading)-/.test(name) || /^--font-weight/.test(name)) return "font";
  if (/^--radius/.test(name)) return "radius";
  if (/shadow/.test(name)) return "shadow";
  if (/^--(spacing|container|blur)/.test(name)) return "spacing";
  if (/^--color-|color|^--(canvas|ink|hairline|gold|on-gold|wordmark|neon|burgundy|admin-)/.test(name)) return "color";
  if (/^(#[0-9a-f]{3,8}|oklch\(|rgb\(|hsl\(|color-mix\()/i.test(value)) return "color";
  if (/^-?\d*\.?\d+(px|rem|em|%|vw|vh)$/.test(value) || /^calc\(/.test(value)) return "spacing";
  return "other";
};

const base = JSON.parse(readFileSync(BASE, "utf8"));
const css = readFileSync(TOKENS, "utf8");
const seen = new Map();
for (const m of css.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]*);(?:\s*\/\*\s*@kind\s+(\w+)\s*\*\/)?/gm)) {
  const [, name, value, kind] = m;
  if (name.startsWith("--tw-")) continue;
  if (!seen.has(name)) seen.set(name, { value: value.trim(), kind: kind ?? null });
}

const prior = base["x-omelette"]?.tokenKinds ?? {};
const tokens = [...seen.keys()].sort();
const tokenKinds = {};
for (const name of tokens) {
  const { value, kind } = seen.get(name);
  tokenKinds[name] = kind ?? (OTHER_KIND.test(name) ? "other" : prior[name] ?? guessKind(name, value));
}

const next = {
  ...base,
  "x-omelette": {
    ...(base["x-omelette"] ?? {}),
    tokens,
    tokenKinds,
  },
};
writeFileSync(OUT, JSON.stringify(next, null, 2) + "\n");
const dropped = Object.keys(prior).filter((n) => n.startsWith("--tw-")).length;
console.log(`adherence: ${tokens.length} tokens, ${dropped} --tw-* kinds dropped -> ${OUT}`);
