import { isSafeHttpUrl, stripTrackingParams } from "./http-url";

export type LiveMenuHints = {
  apiUrl: string;
  venueId: string;
  key: string;
};

const DRINK =
  /\b(drinks?|wine|wines|cocktail|beer|lager|cider|spirit|draught|soft drink|pint|coffee|tea|mocktail|prosecco|gin|vodka|whisky|whiskey)\b/i;
const FOOD_ONLY =
  /\b(burger|starter|dessert|breakfast|kids?|roast|pizza|steak|fish and chips|sunday|main course|sides?)\b/i;

export function parseLiveMenuHints(html: string): LiveMenuHints | null {
  const decoded = html.replace(/\\u002f/gi, "/");
  const apiMatch = decoded.match(/https:\/\/[a-z0-9.-]+\/[^\s"'\\]*menu-service\/api\/[^\s"'\\]*\/menu(?=[^\w]|$)/i);
  if (!apiMatch) return null;
  const apiUrl = stripTrackingParams(apiMatch[0]);
  if (!isSafeHttpUrl(apiUrl)) return null;
  const idx = decoded.indexOf(apiMatch[0]);
  const window = decoded.slice(Math.max(0, idx - 2500), idx + 2500);
  const venue =
    window.match(/"venueId"\s*:\s*\{\s*"value"\s*:\s*"(\d+)"/) ??
    decoded.match(/"venueId"\s*:\s*\{\s*"value"\s*:\s*"(\d+)"/);
  const key = window.match(/"subscriptionKey"\s*:\s*\{\s*"value"\s*:\s*"([^"]+)"/);
  if (!venue?.[1] || !key?.[1]) return null;
  return { apiUrl, venueId: venue[1], key: key[1] };
}

function labelOf(rec: Record<string, unknown>): string {
  for (const key of ["name", "title", "displayName", "description", "productName", "itemName"]) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function money(value: unknown): number | null {
  if (typeof value === "object" && value && "amount" in value) return money((value as { amount: unknown }).amount);
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 200 && n === Math.round(n)) return Math.round(n) / 100;
  return Math.round(n * 100) / 100;
}

function pricesFrom(rec: Record<string, unknown>): { serve: string; amount: number }[] {
  const out: { serve: string; amount: number }[] = [];
  for (const key of ["price", "amount", "value", "salePrice", "portionPrice"]) {
    const amount = money(rec[key]);
    if (amount != null) out.push({ serve: typeof rec.serve === "string" ? rec.serve : "each", amount });
  }
  if (rec.prices && typeof rec.prices === "object" && !Array.isArray(rec.prices)) {
    for (const [serve, raw] of Object.entries(rec.prices as Record<string, unknown>)) {
      const amount = money(raw);
      if (amount != null) out.push({ serve, amount });
    }
  }
  if (Array.isArray(rec.portions)) {
    for (const portion of rec.portions) {
      if (!portion || typeof portion !== "object") continue;
      const row = portion as Record<string, unknown>;
      const serve = labelOf(row) || (typeof row.size === "string" ? row.size : "each");
      const amount = money(row.price) ?? money(row.amount) ?? money(row.value);
      if (amount != null) out.push({ serve, amount });
    }
  }
  return out;
}

function isDrinkContext(trail: string[], label: string): boolean {
  const hay = [...trail, label].join(" ");
  if (FOOD_ONLY.test(hay) && !DRINK.test(hay)) return false;
  return DRINK.test(hay);
}

export function liveMenuToDrinkText(data: unknown): string {
  const lines: string[] = [];

  const walk = (node: unknown, trail: string[]) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, trail);
      return;
    }
    const rec = node as Record<string, unknown>;
    const label = labelOf(rec);
    const next = label ? [...trail, label] : trail;
    const prices = pricesFrom(rec);
    if (label && prices.length && isDrinkContext(trail, label)) {
      for (const price of prices) {
        const serve = price.serve && price.serve !== "each" ? ` (${price.serve})` : "";
        lines.push(`${label}${serve} £${price.amount.toFixed(2)}`);
      }
    }
    for (const value of Object.values(rec)) walk(value, next);
  };

  walk(data, []);
  return [...new Set(lines)].join("\n");
}

export async function fetchLiveDrinkMenu(
  html: string,
  pageUrl: string,
): Promise<{ url: string; text: string } | null> {
  const hints = parseLiveMenuHints(html);
  if (!hints) return null;
  const url = `${hints.apiUrl.replace(/\/$/, "")}/${hints.venueId}`;
  if (!isSafeHttpUrl(url)) return null;
  let origin = "";
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return null;
  }
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": hints.key,
        Origin: origin,
        Referer: pageUrl,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    const text = liveMenuToDrinkText(data);
    if (text.length < 20) return null;
    return { url: pageUrl, text: text.slice(0, 40_000) };
  } catch {
    return null;
  }
}
