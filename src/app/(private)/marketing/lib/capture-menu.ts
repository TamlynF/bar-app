import { parseJsonLoose } from "@/lib/gemini";
import { aiReadFile, aiText } from "@/lib/ai/client";
import { cleanParsedMenu, type ParsedMenu } from "@/lib/menu-import";
import { DRINKS_EXTRACT_PROMPT, MENU_EXTRACT_PROMPT, MENU_EXTRACT_SCHEMA } from "@/lib/menu-extract";
import {
  extraDrinkUrlsFromPage,
  pickDrinkPages,
  pickDrinkPdfs,
  parseAnchors,
  uniqueUrls,
  drinkLinkScore,
  type MenuAnchor,
} from "./discover-drinks";
import { fetchLiveDrinkMenu } from "./live-menu";
import { isSafeHttpUrl, stripTrackingParams } from "./http-url";

export { isSafeHttpUrl, stripTrackingParams };

const MAX_BYTES = 15 * 1024 * 1024;
const FILE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_PAGES = 8;
const MAX_PDFS = 4;

export function menuLinksFromHtml(html: string, pageUrl: string): string[] {
  return pickDrinkPages(parseAnchors(html, pageUrl), 3, pageUrl);
}

function htmlToText(html: string): string {
  const jsonBits: string[] = [];
  const jsonRe =
    /<script[^>]*type=["']application\/(?:ld\+json|json)["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch: RegExpExecArray | null;
  while ((jsonMatch = jsonRe.exec(html))) {
    const body = jsonMatch[1]?.trim() ?? "";
    if (/price|menuItem|offers|drinks?/i.test(body)) jsonBits.push(body.slice(0, 20_000));
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&pound;/gi, "£")
    .replace(/&#163;/g, "£")
    .replace(/\s+/g, " ")
    .trim();
  return [text, ...jsonBits].filter(Boolean).join("\n");
}

function drinksFocusedText(html: string): string {
  const text = htmlToText(html);
  const drinkAt = text.search(/\b(drinks? menu|drinks?|wines?|cocktails?)\b/i);
  const start = drinkAt >= 0 ? Math.max(0, drinkAt - 40) : 0;
  return text.slice(start, start + 40_000);
}

export type FetchedMenu =
  | { kind: "file"; bytes: Buffer; mimeType: string; url: string }
  | { kind: "text"; text: string; url: string }
  | { error: string };

export type DiscoveredDrinks = {
  pageUrls: string[];
  pages: { url: string; text: string }[];
  files: { url: string; bytes: Buffer; mimeType: string }[];
  // Every address that was tried and could not be read, with the reason, so a
  // rival that ends up with nothing can say which doors were shut rather than
  // just that they all were.
  failures: { url: string; error: string }[];
};

type FetchedPage =
  | { kind: "file"; bytes: Buffer; mimeType: string; url: string }
  | { kind: "html"; html: string; text: string; url: string }
  | { error: string };

function looksLikePdf(url: string, mime: string, buf: Buffer): boolean {
  if (mime === "application/pdf") return true;
  if (/\.pdf(\?|$)/i.test(url)) return true;
  return buf.slice(0, 5).toString("utf8") === "%PDF-";
}

async function fetchPage(url: string): Promise<FetchedPage> {
  if (!isSafeHttpUrl(url)) return { error: "That does not look like a public http(s) menu address." };
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/pdf,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return { error: `Could not open that page (${res.status}). Try a direct menu URL or a board photo.` };
    }
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return { error: "That file is too large to read." };
    const finalUrl = res.url || url;
    if (looksLikePdf(finalUrl, mime, buf) || mime.startsWith("image/")) {
      const kind = looksLikePdf(finalUrl, mime, buf) ? "application/pdf" : mime;
      return { kind: "file", bytes: buf, mimeType: kind, url: finalUrl };
    }
    const html = buf.toString("utf8");
    const text = drinksFocusedText(html);
    if (text.length < 40 && !html.includes("href") && !/data-ten-kites/i.test(html)) {
      return { error: "That page did not contain a readable menu." };
    }
    return { kind: "html", html, text, url: finalUrl };
  } catch (err) {
    return { error: fetchFailureMessage(err) };
  }
}

export function fetchFailureMessage(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < 4 && current; i += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  const msg = parts.join(" ");
  if (/ENOTFOUND|getaddrinfo|EAI_AGAIN|ERR_NAME_NOT_RESOLVED/i.test(msg)) {
    return "That website address does not exist. Paste a working menu URL, or upload a photo of the board.";
  }
  if (/timeout|AbortError|UND_ERR_CONNECT_TIMEOUT/i.test(msg)) {
    return "That page took too long to open. Try a direct menu URL or a board photo.";
  }
  return "Could not open that website. Paste a working menu URL, or upload a photo of the board.";
}

const LINK_PICK_SCHEMA = {
  type: "OBJECT",
  properties: {
    urls: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["urls"],
};

export async function chooseDrinkMenuUrls(opts: {
  venueName?: string;
  startUrl: string;
  anchors: MenuAnchor[];
}): Promise<string[]> {
  const ranked = [...opts.anchors]
    .map((a) => ({ a, score: drinkLinkScore(a, opts.startUrl) }))
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a)
    .filter((a, i, all) => all.findIndex((b) => b.href === a.href) === i)
    .slice(0, 30);
  if (!ranked.length) return [];
  const listed = ranked
    .map((a, i) => `${i + 1}. ${a.text || "(no label)"} → ${a.href}`)
    .join("\n");
  const result = await aiText("menu_import", {
    prompt: `Pick drinks-menu URLs for one specific venue.

Venue: ${opts.venueName || "unknown"}
Started on: ${opts.startUrl}

Rules:
- Prefer the drinks menu for THIS venue, not a chain-wide finder.
- If the start URL has a venue slug (e.g. /tarro/), keep that slug (/tarro/menus). Never pick a site-wide /menus page that asks for a postcode or town.
- Then prefer a drinks, wine, cocktail or bar section, an embedded menu host, or a drinks PDF.
- Skip food-only, kids, breakfast, allergen lists, and location search pages.
- Return at most 4 http(s) URLs from the list. Do not invent prices.

LINKS:
${listed}`,
    responseSchema: LINK_PICK_SCHEMA,
    temperature: 0,
  });
  if ("error" in result) return [];
  const parsed = parseJsonLoose<{ urls?: unknown }>(result.text);
  const urls = Array.isArray(parsed?.urls) ? parsed.urls.filter((u): u is string => typeof u === "string") : [];
  return uniqueUrls(urls);
}

export async function discoverDrinkMenus(
  startUrls: string[],
  venueName?: string,
): Promise<DiscoveredDrinks> {
  const seeded = uniqueUrls([...startUrls.flatMap((url) => extraDrinkUrlsFromPage(url)), ...startUrls]);
  const queue = seeded;
  const startUrl = uniqueUrls(startUrls)[0] ?? queue[0] ?? "";
  const visited = new Set<string>();
  const pageUrls: string[] = [];
  const pages: { url: string; text: string }[] = [];
  const files: { url: string; bytes: Buffer; mimeType: string }[] = [];
  const failures: { url: string; error: string }[] = [];
  const fileSeen = new Set<string>();
  let askedAi = false;

  while (queue.length && visited.size < MAX_PAGES) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    const page = await fetchPage(next);
    if ("error" in page) {
      failures.push({ url: next, error: page.error });
      continue;
    }
    if (page.kind === "file") {
      if (!fileSeen.has(page.url) && files.length < MAX_PDFS) {
        fileSeen.add(page.url);
        files.push({ url: page.url, bytes: page.bytes, mimeType: page.mimeType });
        pageUrls.push(page.url);
      }
      continue;
    }
    pageUrls.push(page.url);
    if (page.text.length > 40) pages.push({ url: page.url, text: page.text });
    const live = await fetchLiveDrinkMenu(page.html, page.url);
    if (live && live.text.length > 40) {
      pages.push({ url: live.url, text: live.text });
    }
    const anchors = parseAnchors(page.html, page.url);
    if (!askedAi) {
      askedAi = true;
      const picked = await chooseDrinkMenuUrls({
        venueName,
        startUrl: startUrl || page.url,
        anchors,
      });
      for (const href of picked.reverse()) {
        if (!visited.has(href) && !queue.includes(href)) queue.unshift(href);
      }
    }
    for (const pdf of pickDrinkPdfs(anchors, MAX_PDFS, startUrl || page.url)) {
      if (fileSeen.has(pdf) || files.length >= MAX_PDFS) continue;
      const fetched = await fetchPage(pdf);
      if ("error" in fetched) {
        failures.push({ url: pdf, error: fetched.error });
        continue;
      }
      if (fetched.kind !== "file") continue;
      fileSeen.add(fetched.url);
      files.push({ url: fetched.url, bytes: fetched.bytes, mimeType: fetched.mimeType });
      pageUrls.push(fetched.url);
    }
    const nextPages = uniqueUrls([
      ...extraDrinkUrlsFromPage(page.url),
      ...pickDrinkPages(anchors, 4, startUrl || page.url),
      ...anchors.flatMap((a) => extraDrinkUrlsFromPage(a.href)),
    ]);
    for (const href of nextPages) {
      if (!visited.has(href) && !queue.includes(href) && visited.size + queue.length < MAX_PAGES) {
        queue.push(href);
      }
    }
  }

  return { pageUrls: uniqueUrls(pageUrls), pages, files, failures };
}

export async function fetchPublicMenu(url: string): Promise<FetchedMenu> {
  const found = await discoverDrinkMenus([url]);
  if (found.files[0]) {
    const file = found.files[0];
    return { kind: "file", bytes: file.bytes, mimeType: file.mimeType, url: file.url };
  }
  const text = found.pages.map((p) => p.text).join("\n\n").slice(0, 80_000);
  if (text.length < 40) return { error: "That page did not contain a readable drinks menu." };
  return { kind: "text", text, url: found.pages[0]?.url ?? url };
}

export async function extractMenuFromFile(opts: {
  bytes: Buffer;
  mimeType: string;
  drinksOnly?: boolean;
}): Promise<{ menu: ParsedMenu } | { error: string }> {
  if (!FILE_TYPES.has(opts.mimeType) && opts.mimeType !== "image/jpg") {
    return { error: "That file type is not supported - use a PDF, PNG or JPEG." };
  }
  if (opts.bytes.length > MAX_BYTES) return { error: "That file is too large - keep it under 15MB." };
  const prompt = opts.drinksOnly ? DRINKS_EXTRACT_PROMPT : MENU_EXTRACT_PROMPT;
  const result = await aiReadFile("menu_import", {
    file: { base64: opts.bytes.toString("base64"), mimeType: opts.mimeType === "image/jpg" ? "image/jpeg" : opts.mimeType },
    prompt,
    responseSchema: MENU_EXTRACT_SCHEMA,
  });
  if ("error" in result) return { error: result.error };
  return parseExtracted(result.text);
}

export async function extractMenuFromText(
  text: string,
  drinksOnly = false,
): Promise<{ menu: ParsedMenu } | { error: string }> {
  const prompt = drinksOnly ? DRINKS_EXTRACT_PROMPT : MENU_EXTRACT_PROMPT;
  const result = await aiText("menu_import", {
    prompt: `${prompt}\n\nMENU TEXT:\n${text}`,
    responseSchema: MENU_EXTRACT_SCHEMA,
  });
  if ("error" in result) return { error: result.error };
  return parseExtracted(result.text);
}

function parseExtracted(text: string): { menu: ParsedMenu } | { error: string } {
  const parsed = parseJsonLoose<unknown>(text);
  if (!parsed) return { error: "The menu could not be read from that source." };
  const menu = cleanParsedMenu(parsed);
  const itemCount = menu.categories.reduce((sum, c) => sum + c.items.length, 0);
  if (itemCount === 0) {
    return {
      error: "No drink prices on that page. Open the site, paste a drinks menu URL, or upload a board photo.",
    };
  }
  return { menu };
}

export const MENU_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export const MENU_UPLOAD_MAX_BYTES = MAX_BYTES;
