import { formatGbp } from "@/lib/price";
import { normaliseName, type ParsedMenu } from "@/lib/menu-import";
import type { CompetitorItemType, CompetitorPrice } from "./types";
import { stripTrackingParams } from "./http-url";

export const DEFAULT_RADIUS_METERS = Math.round(1.5 * 1609.34);
const MIN_RADIUS_METERS = 200;
const MAX_RADIUS_METERS = 50_000;

export type PlaceHit = {
  placeId: string;
  name: string;
  website: string | null;
  address: string | null;
  types?: string[];
  primaryType?: string | null;
  latestCloseHour?: number | null;
};

export type ExistingRival = {
  id: string;
  place_id: string | null;
  is_pinned: boolean;
  name: string;
};

export type DiscoverInsert = PlaceHit & { is_pinned: true };
export type DiscoverUpdate = {
  id: string;
  name: string;
  website: string | null;
  address: string | null;
};

export type DiscoverPlan = {
  inserts: DiscoverInsert[];
  updates: DiscoverUpdate[];
  skippedOwn: string[];
  skippedIndustry: string[];
  unpins: { id: string; name: string }[];
};

export type CompetitorPriceInsert = {
  competitor_id: string;
  venue_name: string;
  item_name: string;
  item_type: CompetitorItemType;
  price_text: string;
  price_amount: number;
  area: string;
  source_url: string | null;
  source_name: string;
};

export type RivalPin = {
  id: string;
  name: string;
  is_pinned: boolean;
};

export function parseRadiusMeters(raw: string | null | undefined): number {
  const text = (raw ?? "").trim().toLowerCase();
  if (!text) return DEFAULT_RADIUS_METERS;
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(miles?|mi|km|kilometres?|kilometers?|m|metres?|meters?)?$/);
  if (!match) return DEFAULT_RADIUS_METERS;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return DEFAULT_RADIUS_METERS;
  const unit = match[2] ?? "miles";
  let meters = amount;
  if (unit.startsWith("mi")) meters = amount * 1609.34;
  else if (unit.startsWith("km") || unit.startsWith("kilometr")) meters = amount * 1000;
  else if (unit === "m" || unit.startsWith("metre") || unit.startsWith("meter")) meters = amount;
  else meters = amount * 1609.34;
  return Math.min(MAX_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, Math.round(meters)));
}

const HANGOUT_NAME =
  /\b(pubs?|bars?|taverns?|inns?|tap(?:room)?|brewery|brewhouse|alehouse|lounges?|wine\s*bar|cocktail|tapas\s*bar)\b/i;
const NOT_HANGOUT_NAME =
  /\b(coffee\s*houses?|coffee\s*shops?|coffees?|caf[eé]s?|tea\s*rooms?|baker(?:y|ies)|delis?|kitchens?|sandwich|patisserie)\b/i;
const HANGOUT_TYPES = new Set(["bar", "pub", "night_club", "wine_bar", "bar_and_grill"]);
const NOT_HANGOUT_TYPES = new Set([
  "cafe",
  "coffee_shop",
  "bakery",
  "sandwich_shop",
  "tea_house",
  "breakfast_restaurant",
  "cafeteria",
  "meal_takeaway",
  "ice_cream_shop",
  "dessert_shop",
]);

export function isDrinkingHangout(hit: {
  name: string;
  types?: string[] | null;
  primaryType?: string | null;
  latestCloseHour?: number | null;
}): boolean {
  const name = hit.name.trim();
  const hangoutName = HANGOUT_NAME.test(name);
  if (NOT_HANGOUT_NAME.test(name) && !hangoutName) return false;

  const types = [...(hit.types ?? []), hit.primaryType ?? ""]
    .map((t) => t.replace(/^places\//, "").toLowerCase())
    .filter(Boolean);
  if (types.some((t) => NOT_HANGOUT_TYPES.has(t)) && !types.some((t) => HANGOUT_TYPES.has(t)) && !hangoutName) {
    return false;
  }
  if (hit.latestCloseHour != null && hit.latestCloseHour < 19 && !hangoutName) return false;
  if (types.length && !types.some((t) => HANGOUT_TYPES.has(t)) && !hangoutName) return false;
  return true;
}

export function isOwnVenue(name: string, ownNames: string[]): boolean {
  const n = normaliseName(name);
  if (!n) return false;
  return ownNames.some((raw) => {
    const o = normaliseName(raw);
    if (!o) return false;
    if (n === o) return true;
    const ownTokens = o.split(" ").filter(Boolean);
    if (ownTokens.length >= 2 && (n.includes(o) || o.includes(n))) return true;
    return n.startsWith(o) && o.length >= 8;
  });
}

export function planDiscover(
  hits: PlaceHit[],
  existing: ExistingRival[],
  ownNames: string[],
): DiscoverPlan {
  const byPlace = new Map(existing.filter((r) => r.place_id).map((r) => [r.place_id as string, r]));
  const byName = new Map(existing.map((r) => [normaliseName(r.name), r]));
  const inserts: DiscoverInsert[] = [];
  const updates: DiscoverUpdate[] = [];
  const skippedOwn: string[] = [];
  const skippedIndustry: string[] = [];
  const unpins: { id: string; name: string }[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    if (!hit.placeId || !hit.name.trim()) continue;
    if (seen.has(hit.placeId)) continue;
    seen.add(hit.placeId);
    if (isOwnVenue(hit.name, ownNames)) {
      skippedOwn.push(hit.name);
      continue;
    }
    const match = byPlace.get(hit.placeId) ?? byName.get(normaliseName(hit.name));
    if (!isDrinkingHangout(hit)) {
      skippedIndustry.push(hit.name);
      if (match) unpins.push({ id: match.id, name: match.name });
      continue;
    }
    if (match) {
      updates.push({
        id: match.id,
        name: hit.name.trim(),
        website: hit.website,
        address: hit.address,
      });
    } else {
      inserts.push({ ...hit, name: hit.name.trim(), is_pinned: true });
    }
  }

  return { inserts, updates, skippedOwn, skippedIndustry, unpins };
}

export function pricesForPinned(
  prices: CompetitorPrice[],
  rivals: RivalPin[],
): CompetitorPrice[] {
  if (rivals.length === 0) return prices;
  const ids = new Set(rivals.filter((r) => r.is_pinned).map((r) => r.id));
  const names = new Set(
    rivals.filter((r) => r.is_pinned).map((r) => r.name.trim().toLowerCase()),
  );
  return prices.filter((p) => {
    if (p.competitor_id) return ids.has(p.competitor_id);
    return names.has(p.venue_name.trim().toLowerCase());
  });
}

export function itemTypeFromCategory(category: string): CompetitorItemType {
  const n = category.toLowerCase();
  if (/(snack|crisp|nut|scratching|popcorn|pretzel)/.test(n)) return "snack";
  if (/(food|burger|pizza|nacho|meal|kitchen|main|sharing|starter|dessert|breakfast|roast|kids?)/.test(n)) {
    return "food";
  }
  return "drink";
}

export function rivalMenuUrls(rival: {
  menu_urls?: string[] | null;
  menu_url?: string | null;
}): string[] {
  const listed = (rival.menu_urls ?? []).map((u) => stripTrackingParams(u.trim())).filter(Boolean);
  if (listed.length) return listed;
  return rival.menu_url?.trim() ? [stripTrackingParams(rival.menu_url.trim())] : [];
}

export function rivalStartUrls(rival: {
  menu_urls?: string[] | null;
  menu_url?: string | null;
  website?: string | null;
}): string[] {
  const menus = rivalMenuUrls(rival);
  if (menus.length) return menus;
  const site = rival.website?.trim();
  return site ? [stripTrackingParams(site)] : [];
}

function itemNameForServe(name: string, serve: string, serveCount: number): string {
  if (serveCount === 1 && serve === "each") return name;
  const lower = name.toLowerCase();
  if (lower.includes(serve.toLowerCase())) return name;
  return `${name} (${serve})`;
}

function uniqueName(used: Set<string>, base: string): string {
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base} (${n})`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export function rowsFromParsedMenu(
  menu: ParsedMenu,
  meta: {
    competitorId: string;
    venueName: string;
    area: string;
    sourceUrl: string | null;
    sourceName: string;
  },
  drinksOnly = false,
): CompetitorPriceInsert[] {
  const used = new Set<string>();
  const rows: CompetitorPriceInsert[] = [];

  for (const category of menu.categories) {
    const itemType = itemTypeFromCategory(category.name);
    if (drinksOnly && itemType !== "drink") continue;
    for (const item of category.items) {
      const serves = item.serves.filter((s) => Number.isFinite(s.amount) && s.amount > 0);
      if (!serves.length) continue;
      for (const serve of serves) {
        const itemName = uniqueName(used, itemNameForServe(item.name, serve.serve, serves.length));
        rows.push({
          competitor_id: meta.competitorId,
          venue_name: meta.venueName,
          item_name: itemName,
          item_type: itemType,
          price_text: formatGbp(serve.amount),
          price_amount: serve.amount,
          area: meta.area,
          source_url: meta.sourceUrl,
          source_name: meta.sourceName,
        });
      }
    }
  }

  return rows;
}

export function mergeParsedMenus(menus: ParsedMenu[]): ParsedMenu {
  const categories = new Map<string, ParsedMenu["categories"][number]>();
  for (const menu of menus) {
    for (const category of menu.categories) {
      const key = category.name.trim().toLowerCase();
      const current = categories.get(key);
      if (!current) {
        categories.set(key, { ...category, items: [...category.items] });
      } else {
        current.items.push(...category.items);
      }
    }
  }
  return { categories: [...categories.values()] };
}

export function captureSourceForUrl(
  usedUrl: string,
  menuUrls: string[],
  website: string | null,
): "menu_url" | "website" {
  const used = usedUrl.trim();
  if (menuUrls.some((u) => u.trim() === used)) return "menu_url";
  if (website && used === website.trim()) return "website";
  return menuUrls.length ? "menu_url" : "website";
}

export function menuTargetUrl(menuUrl: string | null, website: string | null): string | null {
  const preferred = menuUrl?.trim() || website?.trim() || "";
  return preferred || null;
}
