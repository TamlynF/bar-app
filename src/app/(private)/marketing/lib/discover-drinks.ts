import { isSafeHttpUrl, stripTrackingParams } from "./http-url";

export type MenuAnchor = {
  href: string;
  text: string;
  sameHost: boolean;
};

const FOOD_ONLY =
  /\b(kids?|child|breakfast|brunch|sunday\s*roast|gluten|starters?|mains?|dessert|pudding|lunch|dinner|food\s*menu|main\s*menu)\b/i;

const SKIP_DOWNLOAD = /allergen|nutrition|calorie/i;

const DRINKS =
  /\b(drinks?|drink\s*menu|wines?|wine\s*list|cocktails?|beer|lager|cider|spirits?|bar\s*menu|alcohol|soft\s*drinks?|draught)\b/i;

const MENU_WORD = /\bmenus?\b/i;
const PDF_HINT = /\.pdf\b|download|\bpdf\b/i;
const FILE_HREF = /\.pdf(\?|$)|\/api\/public\/content\/|sitecorecontenthub/i;

function decodeHref(raw: string): string {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, "/");
}

function hostsMatch(a: string, b: string): boolean {
  return a.replace(/^www\./, "") === b.replace(/^www\./, "");
}

function resolveAnchor(href: string, pageUrl: string, originHost: string, text: string): MenuAnchor | null {
  let next: URL;
  try {
    next = new URL(decodeHref(href).trim(), pageUrl);
  } catch {
    return null;
  }
  if (next.protocol !== "http:" && next.protocol !== "https:") return null;
  const clean = stripTrackingParams(next.toString());
  if (!isSafeHttpUrl(clean)) return null;
  return {
    href: clean,
    text: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    sameHost: hostsMatch(next.hostname, originHost),
  };
}

function looksLikeFile(anchor: MenuAnchor): boolean {
  const hay = `${anchor.text} ${anchor.href}`;
  return FILE_HREF.test(anchor.href) || PDF_HINT.test(hay);
}

const GENERIC_SLUGS = new Set([
  "menu",
  "menus",
  "about",
  "contact",
  "locations",
  "book",
  "booking",
  "find-us",
  "our-menu",
  "whats-on",
  "christmas",
  "offers",
]);

export function venueSlug(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const slug = parts[0]?.toLowerCase() ?? "";
    if (!slug || GENERIC_SLUGS.has(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}

export function venuePathBonus(href: string, startUrl?: string | null): number {
  if (!startUrl) return 0;
  const slug = venueSlug(startUrl);
  if (!slug) return 0;
  try {
    const path = new URL(href).pathname.replace(/\/+$/, "").toLowerCase() || "/";
    if (path === "/menu" || path === "/menus") return -14;
    if (path === `/${slug}` || path.startsWith(`/${slug}/`)) return 8;
    return 0;
  } catch {
    return 0;
  }
}

export function extraDrinkUrlsFromPage(pageUrl: string): string[] {
  try {
    const url = new URL(pageUrl);
    const origin = url.origin;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const extras: string[] = [];
    if (/\/menus?$/i.test(path)) {
      if (!/drinks/i.test(url.search)) {
        extras.push(`${origin}${path}?type=drinks+menu`, `${origin}${path}?type=drinks`);
      }
    } else if (path !== "/" && !/menu/i.test(path)) {
      extras.push(
        `${origin}${path}/menu?type=drinks+menu`,
        `${origin}${path}/menus`,
        `${origin}${path}/menu`,
        `${origin}${path}/menus?type=drinks+menu`,
      );
    }
    return uniqueUrls(extras);
  } catch {
    return [];
  }
}

export function parseAnchors(html: string, pageUrl: string): MenuAnchor[] {
  let originHost = "";
  try {
    originHost = new URL(pageUrl).hostname;
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: MenuAnchor[] = [];

  const add = (href: string, text: string) => {
    const anchor = resolveAnchor(href, pageUrl, originHost, text);
    if (!anchor || seen.has(anchor.href)) return;
    seen.add(anchor.href);
    out.push(anchor);
  };

  const tags = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  for (const tag of tags) {
    const attrs = tag[1] ?? "";
    const text = tag[2] ?? "";
    const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
    const href = hrefMatch?.[1]?.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }
    add(href, text);
  }

  for (const tag of html.matchAll(/<(?:iframe|embed|object|source)\b([^>]*)>/gi)) {
    const attrs = tag[1] ?? "";
    const src = attrs.match(/(?:src|data|href)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) add(src, attrs);
  }

  for (const pair of html.matchAll(/"text"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"href"\s*:\s*"((?:\\.|[^"\\])*)"/gi)) {
    add(pair[2] ?? "", decodeHref(pair[1] ?? ""));
  }
  for (const pair of html.matchAll(/"href"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/gi)) {
    add(pair[1] ?? "", decodeHref(pair[2] ?? ""));
  }

  for (const embed of html.matchAll(/data-ten-kites\s*=\s*["']([^"']+)["']/gi)) {
    add(embed[1] ?? "", "Drinks menu");
  }
  for (const embed of html.matchAll(/data-(?:menu-url|menu-src|menu)\s*=\s*["'](https?:[^"']+)["']/gi)) {
    add(embed[1] ?? "", "Drinks menu");
  }

  return out;
}

export function drinkLinkScore(anchor: MenuAnchor, startUrl?: string | null): number {
  const path = (() => {
    try {
      return `${new URL(anchor.href).pathname} ${new URL(anchor.href).search}`;
    } catch {
      return anchor.href;
    }
  })();
  const hay = `${anchor.text} ${path} ${anchor.href}`.toLowerCase();
  const isFile = looksLikeFile(anchor);

  if (SKIP_DOWNLOAD.test(hay)) return -2;
  if (FOOD_ONLY.test(hay) && !DRINKS.test(hay)) return isFile ? 0 : -2;
  let score = 0;
  if (DRINKS.test(hay)) score += 8;
  if (MENU_WORD.test(hay)) score += 3;
  if (isFile) score += DRINKS.test(hay) || MENU_WORD.test(hay) ? 6 : 2;
  if (/\bdownload\b|\bview\b/i.test(anchor.text) && (DRINKS.test(hay) || MENU_WORD.test(hay) || isFile)) {
    score += 3;
  }
  if (anchor.sameHost) score += 1;
  if (/tenkites|embedded menu/i.test(hay)) score += 10;
  score += venuePathBonus(anchor.href, startUrl);
  return score;
}

export function pickDrinkPages(anchors: MenuAnchor[], limit = 6, startUrl?: string | null): string[] {
  return [...anchors]
    .map((a) => ({ a, score: drinkLinkScore(a, startUrl) }))
    .filter((x) => x.score >= 3 && !looksLikeFile(x.a))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.a.href)
    .filter((url, i, all) => all.indexOf(url) === i)
    .slice(0, limit);
}

export function pickDrinkPdfs(anchors: MenuAnchor[], limit = 6, startUrl?: string | null): string[] {
  return [...anchors]
    .map((a) => ({ a, score: drinkLinkScore(a, startUrl) }))
    .filter((x) => looksLikeFile(x.a) && x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.a.href)
    .filter((url, i, all) => all.indexOf(url) === i)
    .slice(0, limit);
}

export function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const clean = stripTrackingParams(raw.trim());
    if (!clean || seen.has(clean) || !isSafeHttpUrl(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}
