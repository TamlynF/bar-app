import { createClient } from "@/lib/supabase/server";
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

  const [{ data: categories, error: catError }, { data: employees }] =
    await Promise.all([
      supabase.from("menu_categories").select("*, menu_items(*)"),
      supabase
        .from("employees")
        .select("id, full_name")
        .order("full_name", { ascending: true }),
    ]);

  if (catError) console.error("Error fetching menu:", catError);

  const raw = (categories || []) as unknown as MenuCategory[];
  const sorted = [...raw].sort(byDisplayOrder).map((cat) => ({
    ...cat,
    menu_items: [...(cat.menu_items || [])].sort(byDisplayOrder),
  }));

  return <MenuClient initialCategories={sorted} employees={employees ?? []} />;
}
