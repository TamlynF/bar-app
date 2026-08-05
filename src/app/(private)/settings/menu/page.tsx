import { createClient } from "@/lib/supabase/server";
import { readPriceBenchmarks } from "@/app/(private)/marketing/lib/menu-data";
import MenuClient, { type MenuCategory } from "./menu-client";

function byDisplayOrder(
  a: { display_order: number; is_active: boolean; id: number },
  b: { display_order: number; is_active: boolean; id: number }
) {
  if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
  return a.display_order - b.display_order || a.id - b.id;
}

export default async function MenuSettingsPage() {
  const supabase = await createClient();

  const [{ data: categories, error: catError }, { data: employees }, benchmarks] =
    await Promise.all([
      supabase
        .from("menu_categories")
        .select("*, menu_items(*, menu_item_prices(id, serve, amount, display_order))"),
      supabase
        .from("employees")
        .select("id, full_name")
        .order("full_name", { ascending: true }),
      readPriceBenchmarks(supabase),
    ]);

  if (catError) console.error("Error fetching menu:", catError);

  const raw = (categories || []) as unknown as MenuCategory[];
  const sorted = [...raw].sort(byDisplayOrder).map((cat) => ({
    ...cat,
    menu_items: [...(cat.menu_items || [])].sort(byDisplayOrder).map((item) => ({
      ...item,
      menu_item_prices: [...(item.menu_item_prices || [])]
        .sort((a, z) => a.display_order - z.display_order)
        .map((p) => ({ ...p, amount: Number(p.amount) })),
    })),
  }));

  return (
    <MenuClient
      initialCategories={sorted}
      employees={employees ?? []}
      benchmarks={benchmarks}
    />
  );
}
