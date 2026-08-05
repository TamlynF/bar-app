import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_BENCHMARKS } from "./compare";
import type { MenuItemLite, PriceBenchmark } from "./types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type MenuItemRow = {
  id: number;
  name: string;
  price: string;
  is_active: boolean;
  benchmark_key: string | null;
  menu_item_prices?: { serve: string; amount: number; display_order: number }[];
};

type MenuCategoryRow = {
  name: string;
  mixer_surcharge?: number | null;
  menu_items?: MenuItemRow[];
};

export const MENU_ITEM_SELECT =
  "name, mixer_surcharge, menu_items(id, name, price, is_active, benchmark_key, menu_item_prices(serve, amount, display_order))";

// An unseeded or unreachable table falls back to the rounds the comparison has
// always had, so a missing row never blanks the price page.
export async function readPriceBenchmarks(supabase: ServerClient): Promise<PriceBenchmark[]> {
  const { data } = await supabase
    .from("price_benchmarks")
    .select("id, key, label, serves, display_order, is_active")
    .order("display_order", { ascending: true });
  const rows = (data as PriceBenchmark[] | null) ?? [];
  return rows.length ? rows : DEFAULT_BENCHMARKS;
}

export async function readMenuItems(supabase: ServerClient): Promise<MenuItemLite[]> {
  const { data } = await supabase
    .from("menu_categories")
    .select(MENU_ITEM_SELECT)
    .eq("is_active", true);

  const items: MenuItemLite[] = [];
  ((data as MenuCategoryRow[] | null) ?? []).forEach((cat) => {
    (cat.menu_items ?? [])
      .filter((it) => it.is_active)
      .forEach((it) =>
        items.push({
          id: it.id,
          name: it.name,
          price: it.price,
          category: cat.name,
          mixer_surcharge: cat.mixer_surcharge ?? null,
          benchmark_key: it.benchmark_key,
          prices: [...(it.menu_item_prices ?? [])]
            .sort((a, z) => a.display_order - z.display_order)
            .map((p) => ({ serve: p.serve, amount: Number(p.amount) })),
        }),
      );
  });
  return items;
}
