import { formatGbp } from "./price";

// The measures a bar actually sells in. A round is priced off one of these, so
// a half pint and a bottle can never stand in for the pint or the glass.
export const SERVES = [
  "pint",
  "half pint",
  "single",
  "double",
  "small",
  "large",
  "glass",
  "bottle",
  "each",
] as const;

export type Serve = (typeof SERVES)[number];

export type MenuItemPrice = { serve: string; amount: number };

const SERVE_ALIASES: Record<string, Serve> = {
  pint: "pint",
  half: "half pint",
  "half pint": "half pint",
  "1 2 pint": "half pint",
  single: "single",
  sgl: "single",
  double: "double",
  dbl: "double",
  small: "small",
  sml: "small",
  large: "large",
  lge: "large",
  glass: "glass",
  bottle: "bottle",
  btl: "bottle",
  each: "each",
};

// No words after the amount means the item is sold one way only.
export function normalizeServe(raw: string | null | undefined): Serve | null {
  const cleaned = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!cleaned) return "each";
  return SERVE_ALIASES[cleaned] ?? null;
}

// Reads the display text a menu already carries - "£4.95 pint / £2.95 half pint".
// A segment that does not open with a price is an offer rather than a serve
// ("6 for £20.00"), and a serve nobody recognises is left alone, so both are
// dropped here and reported by the caller instead of being guessed at.
export function parsePriceText(text: string | null | undefined): MenuItemPrice[] {
  if (!text) return [];
  const prices: MenuItemPrice[] = [];
  const seen = new Set<string>();

  text.split("/").forEach((segment) => {
    const match = segment.trim().match(/^£\s*(\d+(?:\.\d+)?)\s*(.*)$/);
    if (!match) return;
    const amount = parseFloat(match[1]);
    if (!Number.isFinite(amount)) return;
    const serve = normalizeServe(match[2]);
    if (!serve || seen.has(serve)) return;
    seen.add(serve);
    prices.push({ serve, amount: Math.round(amount * 100) / 100 });
  });

  return prices;
}

export function formatPriceText(prices: MenuItemPrice[]): string {
  return prices
    .map((p) => (p.serve === "each" ? formatGbp(p.amount) : `${formatGbp(p.amount)} ${p.serve}`))
    .join(" / ");
}

// True when the serves carry everything the text said, so rewriting the display
// string loses nothing. A multibuy tail or an unreadable measure makes it false.
export function isLosslessPriceText(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return formatPriceText(parsePriceText(text)) === text.trim();
}

export function amountForServes(
  prices: MenuItemPrice[] | null | undefined,
  serves: string[],
): number | null {
  if (!prices?.length || !serves.length) return null;
  const match = prices.find((p) => serves.includes(p.serve));
  return match ? match.amount : null;
}

export function parseServes(serves: string | null | undefined): string[] {
  return (serves ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type StoredServe = {
  id: number;
  serve: string;
  amount: number;
  display_order: number;
  show_on_menu: boolean;
};

export type ServeWritePlan = {
  updates: { id: number; amount: number; display_order: number; show_on_menu: true }[];
  inserts: { serve: string; amount: number; display_order: number }[];
  deletes: number[];
};

// Matched on the serve, so a serve the editor keeps keeps its row - and with
// it the Square link and every market board it is on. A serve hidden from the
// menu is left alone unless the editor now lists it, which brings it back.
export function planServeWrites(stored: StoredServe[], serves: MenuItemPrice[]): ServeWritePlan {
  const byServe = new Map(stored.map((row) => [row.serve, row]));
  const plan: ServeWritePlan = { updates: [], inserts: [], deletes: [] };
  const kept = new Set<number>();

  serves.forEach((serve, index) => {
    const display_order = index + 1;
    const row = byServe.get(serve.serve);
    if (!row) {
      plan.inserts.push({ serve: serve.serve, amount: serve.amount, display_order });
      return;
    }
    kept.add(row.id);
    if (Number(row.amount) !== serve.amount || row.display_order !== display_order || !row.show_on_menu) {
      plan.updates.push({ id: row.id, amount: serve.amount, display_order, show_on_menu: true });
    }
  });

  plan.deletes = stored.filter((row) => row.show_on_menu && !kept.has(row.id)).map((row) => row.id);
  return plan;
}
