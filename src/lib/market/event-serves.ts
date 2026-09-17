/* A market trades serves, not menu items: "Guinness · pint" and "Guinness ·
   half" are separate instruments with their own Square variation. These
   helpers turn the menu into the serve-level options the event pickers show. */

export type ServePriceRow = {
  id: number;
  serve: string;
  amount: number | string;
  display_order: number;
  square_variation_id: string | null;
};

export type ServeItemRow = {
  id: number;
  name: string;
  is_active: boolean;
  menu_item_prices: ServePriceRow[];
};

export type ServeCategoryRow = {
  id: number;
  name: string;
  menu_items: ServeItemRow[];
};

export type ServeOption = {
  id: number;
  menuItemId: number;
  name: string;
  serve: string;
  amount: number;
  linked: boolean;
  categoryId: number;
  categoryName: string;
};

export type PickerItem = { id: number; name: string; serves: ServeOption[] };
export type PickerGroup = { id: number; name: string; items: PickerItem[] };

export function serveLabel(name: string, serve: string | null | undefined): string {
  const trimmed = (serve ?? "").trim();
  return trimmed && trimmed.toLowerCase() !== "each" ? `${name} · ${trimmed}` : name;
}

/* Serves the market never trades: halves would double up every draught
   line, and wine moves by the glass, so bottles and small glasses stay off
   the board. Matching is on the serve name, case-insensitive. */
const UNTRADEABLE_SERVES = new Set(["half pint", "half", "bottle", "small"]);

export function isTradeableServe(serve: string | null | undefined): boolean {
  return !UNTRADEABLE_SERVES.has((serve ?? "").trim().toLowerCase());
}

export function sortServes<T extends { display_order: number; id: number }>(prices: T[]): T[] {
  return [...prices].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
}

/* One option per priced serve of every active item, in menu order: the
   categories as given, items by name, serves by display order. */
export function serveOptionsFromCategories(categories: ServeCategoryRow[]): ServeOption[] {
  return categories.flatMap((category) =>
    [...category.menu_items]
      .filter((item) => item.is_active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((item) =>
        sortServes(item.menu_item_prices)
          .filter((price) => Number(price.amount) > 0 && isTradeableServe(price.serve))
          .map((price) => ({
            id: price.id,
            menuItemId: item.id,
            name: item.name,
            serve: price.serve,
            amount: Number(price.amount),
            linked: Boolean(price.square_variation_id),
            categoryId: category.id,
            categoryName: category.name,
          }))
      )
  );
}

export function groupServesForPicker(options: ServeOption[]): PickerGroup[] {
  const groups: PickerGroup[] = [];
  for (const option of options) {
    let group = groups[groups.length - 1];
    if (!group || group.id !== option.categoryId) {
      group = { id: option.categoryId, name: option.categoryName, items: [] };
      groups.push(group);
    }
    let item = group.items[group.items.length - 1];
    if (!item || item.id !== option.menuItemId) {
      item = { id: option.menuItemId, name: option.name, serves: [] };
      group.items.push(item);
    }
    item.serves.push(option);
  }
  return groups;
}
