import { sortServes } from "./event-serves";

export type MappingRow = {
  menuItemPriceId: number;
  itemName: string;
  categoryName: string;
  serve: string;
  amount: number;
  /* Names of the active events this serve trades on; empty when it is on none. */
  onEvents: string[];
  squareVariationId: string | null;
};

export type MappingCategoryRow = {
  name: string;
  menu_items: {
    name: string;
    is_active: boolean;
    menu_item_prices: {
      id: number;
      serve: string;
      amount: number | string;
      display_order: number;
      square_variation_id: string | null;
    }[];
  }[];
};

export type MappingEvent = { name: string; menuItemPriceIds: number[] };

/* One row per priced serve of every active item, in menu order, tagged with
   the events it is on so the Square links page can show what will trade. */
export function buildMappingRows(categories: MappingCategoryRow[], events: MappingEvent[]): MappingRow[] {
  const eventsByPrice = new Map<number, string[]>();
  for (const event of events) {
    for (const id of event.menuItemPriceIds) {
      eventsByPrice.set(id, [...(eventsByPrice.get(id) ?? []), event.name]);
    }
  }
  return categories.flatMap((category) =>
    category.menu_items
      .filter((item) => item.is_active)
      .flatMap((item) =>
        sortServes(item.menu_item_prices).map((price) => ({
          menuItemPriceId: price.id,
          itemName: item.name,
          categoryName: category.name,
          serve: price.serve,
          amount: Number(price.amount),
          onEvents: eventsByPrice.get(price.id) ?? [],
          squareVariationId: price.square_variation_id,
        }))
      )
  );
}
