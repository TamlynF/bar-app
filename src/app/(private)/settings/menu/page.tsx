import { createClient } from "@/lib/supabase/server";
import MenuClient from "./menu-client";

export default async function MenuSettingsPage() {
  const supabase = await createClient();

  const { data: categories, error: catError } = await supabase
    .from("menu_categories")
    .select("*, menu_items(*)")
    .order("display_order", { ascending: true });

  if (catError) console.error("Error fetching menu:", catError);

  type RawCategory = {
    id: number;
    name: string;
    note: string | null;
    display_order: number;
    is_active: boolean;
    menu_items: { id: number; category_id: number; name: string; price: string; display_order: number; is_active: boolean }[];
  };

  const raw = (categories || []) as unknown as RawCategory[];
  const sorted = raw.map((cat) => ({
    ...cat,
    menu_items: (cat.menu_items || []).sort(
      (a, b) => a.display_order - b.display_order
    ),
  }));

  return <MenuClient initialCategories={sorted} />;
}
