import { formatPriceText, normalizeServe, type MenuItemPrice } from "@/lib/menu-price";

export type ParsedItem = {
  name: string;
  price_text: string;
  serves: MenuItemPrice[];
};

export type ParsedCategory = {
  name: string;
  note: string | null;
  items: ParsedItem[];
};

export type ParsedMenu = { categories: ParsedCategory[] };

export type CurrentItem = {
  id: number;
  name: string;
  price: string;
  is_active: boolean;
  menu_item_prices: { serve: string; amount: number }[];
};

export type CurrentCategory = {
  id: number;
  name: string;
  note: string | null;
  is_active: boolean;
  menu_items: CurrentItem[];
};

export type ChangeKind =
  | "new-category"
  | "new-item"
  | "price-change"
  | "unchanged"
  | "absent";

export type MenuChange = {
  // Stable across a re-diff of the same stored parse, so the keys a reviewer
  // ticked still mean the same change when the apply step recomputes.
  key: string;
  kind: ChangeKind;
  categoryName: string;
  categoryId: number | null;
  categoryNote: string | null;
  itemName: string | null;
  itemId: number | null;
  before: string | null;
  after: string | null;
  serves: MenuItemPrice[];
};

// Menus are written by people, not systems: "Pipers Sweet Chilli" one year and
// "Pipers  sweet-chilli" the next is the same crisp packet.
export function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanServes(serves: unknown): MenuItemPrice[] {
  if (!Array.isArray(serves)) return [];
  const seen = new Set<string>();
  return serves.flatMap((row) => {
    const raw = (row as { serve?: unknown })?.serve;
    // Aliases the menu might use - "half", "btl", "sgl" - resolve to the real
    // measure rather than being thrown away.
    const serve = normalizeServe(typeof raw === "string" ? raw : null);
    const amount = Number((row as { amount?: unknown })?.amount);
    if (!serve) return [];
    if (!Number.isFinite(amount) || amount <= 0) return [];
    if (seen.has(serve)) return [];
    seen.add(serve);
    return [{ serve, amount: Math.round(amount * 100) / 100 }];
  });
}

// The model is asked for a strict shape, but it is still a model. Anything that
// does not survive this is dropped rather than trusted.
export function cleanParsedMenu(raw: unknown): ParsedMenu {
  const categories = (raw as { categories?: unknown })?.categories;
  if (!Array.isArray(categories)) return { categories: [] };

  const cleaned = categories.flatMap((cat): ParsedCategory[] => {
    const name = typeof (cat as { name?: unknown })?.name === "string"
      ? (cat as { name: string }).name.trim()
      : "";
    if (!name) return [];

    const rawNote = (cat as { note?: unknown })?.note;
    const note = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim() : null;

    const rawItems = (cat as { items?: unknown })?.items;
    const items = Array.isArray(rawItems)
      ? rawItems.flatMap((item): ParsedItem[] => {
          const itemName = typeof (item as { name?: unknown })?.name === "string"
            ? (item as { name: string }).name.trim()
            : "";
          if (!itemName) return [];

          const serves = cleanServes((item as { serves?: unknown })?.serves);
          // Without a serve there is nothing to price against, and saving one
          // is refused anyway - so it never becomes a proposed change.
          if (!serves.length) return [];

          const given = typeof (item as { price_text?: unknown })?.price_text === "string"
            ? (item as { price_text: string }).price_text.trim()
            : "";

          return [{
            name: itemName,
            price_text: given || formatPriceText(serves),
            serves,
          }];
        })
      : [];

    return [{ name, note, items }];
  });

  // A menu that lists the same heading twice is one category to us.
  const byName = new Map<string, ParsedCategory>();
  cleaned.forEach((cat) => {
    const key = normaliseName(cat.name);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, cat);
      return;
    }
    existing.note = existing.note ?? cat.note;
    cat.items.forEach((item) => {
      if (!existing.items.some((i) => normaliseName(i.name) === normaliseName(item.name))) {
        existing.items.push(item);
      }
    });
  });

  return { categories: [...byName.values()] };
}

function servesEqual(a: MenuItemPrice[], b: { serve: string; amount: number }[]): boolean {
  if (a.length !== b.length) return false;
  const sortKey = (s: { serve: string }) => s.serve;
  const left = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  const right = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  return left.every(
    (s, i) =>
      s.serve === right[i].serve &&
      Math.round(s.amount * 100) === Math.round(Number(right[i].amount) * 100),
  );
}

export function describeServes(serves: { serve: string; amount: number }[]): string {
  if (!serves.length) return "no serves";
  return serves.map((s) => `£${Number(s.amount).toFixed(2)} ${s.serve}`).join(" / ");
}

/* Every proposed change, including the ones that turn out to be nothing. The
   caller decides what to show and what to offer - this only decides what is
   true. Nothing here deletes: an item the PDF does not mention is reported as
   `absent`, which the apply step can only ever turn into a deactivation. */
export function diffMenu(current: CurrentCategory[], parsed: ParsedMenu): MenuChange[] {
  const currentByName = new Map(current.map((c) => [normaliseName(c.name), c] as const));
  const seenItemIds = new Set<number>();
  const changes: MenuChange[] = [];

  parsed.categories.forEach((cat) => {
    const catKey = normaliseName(cat.name);
    const existing = currentByName.get(catKey);

    if (!existing) {
      changes.push({
        key: `new-category:${catKey}`,
        kind: "new-category",
        categoryName: cat.name,
        categoryId: null,
        categoryNote: cat.note,
        itemName: null,
        itemId: null,
        before: null,
        after: `${cat.items.length} ${cat.items.length === 1 ? "item" : "items"}`,
        serves: [],
      });
    }

    const itemsByName = new Map(
      (existing?.menu_items ?? []).map((i) => [normaliseName(i.name), i] as const),
    );

    cat.items.forEach((item) => {
      const itemKey = normaliseName(item.name);
      const match = itemsByName.get(itemKey);

      if (!match) {
        changes.push({
          key: `new-item:${catKey}:${itemKey}`,
          kind: "new-item",
          categoryName: cat.name,
          categoryId: existing?.id ?? null,
          categoryNote: cat.note,
          itemName: item.name,
          itemId: null,
          before: null,
          after: describeServes(item.serves),
          serves: item.serves,
        });
        return;
      }

      seenItemIds.add(match.id);
      const same =
        servesEqual(item.serves, match.menu_item_prices) &&
        item.price_text.trim() === match.price.trim();

      changes.push({
        key: `${same ? "unchanged" : "price-change"}:${catKey}:${itemKey}`,
        kind: same ? "unchanged" : "price-change",
        categoryName: cat.name,
        categoryId: existing?.id ?? null,
        categoryNote: cat.note,
        itemName: item.name,
        itemId: match.id,
        before: describeServes(match.menu_item_prices),
        after: describeServes(item.serves),
        serves: item.serves,
      });
    });
  });

  // Only categories the PDF actually covered - a heading missing from the
  // upload means it was not on this menu, not that its items are delisted.
  const coveredCategoryIds = new Set(
    parsed.categories
      .map((cat) => currentByName.get(normaliseName(cat.name))?.id)
      .filter((id): id is number => id != null),
  );

  current.forEach((cat) => {
    if (!coveredCategoryIds.has(cat.id)) return;
    cat.menu_items.forEach((item) => {
      if (seenItemIds.has(item.id) || !item.is_active) return;
      changes.push({
        key: `absent:${normaliseName(cat.name)}:${normaliseName(item.name)}`,
        kind: "absent",
        categoryName: cat.name,
        categoryId: cat.id,
        categoryNote: cat.note,
        itemName: item.name,
        itemId: item.id,
        before: describeServes(item.menu_item_prices),
        after: null,
        serves: [],
      });
    });
  });

  return changes;
}

export type ImportSummary = Record<ChangeKind, number>;

export function summarise(changes: MenuChange[]): ImportSummary {
  const summary: ImportSummary = {
    "new-category": 0,
    "new-item": 0,
    "price-change": 0,
    unchanged: 0,
    absent: 0,
  };
  changes.forEach((change) => {
    summary[change.kind] += 1;
  });
  return summary;
}

// What a reviewer can act on. `unchanged` is shown for confidence but there is
// nothing to apply, and it is never pre-ticked alongside the rest.
export function isActionable(change: MenuChange): boolean {
  return change.kind !== "unchanged";
}

export function defaultSelection(changes: MenuChange[]): string[] {
  return changes
    .filter((c) => c.kind === "new-category" || c.kind === "new-item" || c.kind === "price-change")
    .map((c) => c.key);
}
