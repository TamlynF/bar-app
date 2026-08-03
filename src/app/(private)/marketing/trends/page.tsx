import { createClient } from "@/lib/supabase/server";
import TrendsClient from "./trends-client";
import {
  readMarketingSettings,
  readCompanyAddress,
  resolveComparisonArea,
} from "../lib/settings";
import { buildComparison } from "../lib/compare";
import type { CompetitorPrice, MarketingTrend, MenuItemLite } from "../lib/types";

export const dynamic = "force-dynamic";

export default async function MarketingTrendsPage() {
  const supabase = await createClient();

  const [{ data: trends }, { data: menuCats }, settings, address] = await Promise.all([
    supabase
      .from("marketing_trends")
      .select("*")
      .order("fetched_at", { ascending: false }),
    supabase
      .from("menu_categories")
      .select("name, mixer_surcharge, menu_items(id, name, price, is_active)")
      .eq("is_active", true),
    readMarketingSettings(supabase),
    readCompanyAddress(supabase),
  ]);

  const area = resolveComparisonArea(settings, address);

  const { data: prices } = await supabase
    .from("competitor_prices")
    .select("*")
    .eq("area", area)
    .order("item_type", { ascending: true });

  const menuItems: MenuItemLite[] = [];
  (menuCats ?? []).forEach(
    (cat: {
      name: string;
      mixer_surcharge: number | null;
      menu_items?: { id: number; name: string; price: string; is_active: boolean }[];
    }) => {
      (cat.menu_items ?? [])
        .filter((it) => it.is_active)
        .forEach((it) =>
          menuItems.push({
            id: it.id,
            name: it.name,
            price: it.price,
            category: cat.name,
            mixer_surcharge: cat.mixer_surcharge,
          }),
        );
    },
  );

  const competitorPrices = (prices as CompetitorPrice[] | null) ?? [];
  const comparison = buildComparison(competitorPrices, menuItems);

  return (
    <TrendsClient
      initialTrends={(trends as MarketingTrend[] | null) ?? []}
      area={area}
      lastRefresh={settings?.last_trends_refresh_at ?? null}
      pricesRadius={settings?.comparison_radius ?? null}
      pricesLastRefresh={settings?.last_prices_refresh_at ?? null}
      comparison={comparison}
      competitorPrices={competitorPrices}
      menuItems={menuItems}
    />
  );
}
