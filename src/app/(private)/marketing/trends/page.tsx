import { createClient } from "@/lib/supabase/server";
import TrendsClient from "./trends-client";
import {
  readMarketingSettings,
  readCompanyAddress,
  resolveComparisonArea,
} from "../lib/settings";
import { readMenuItems, readPriceBenchmarks } from "../lib/menu-data";
import { buildComparison } from "../lib/compare";
import type { CompetitorPrice, MarketingTrend } from "../lib/types";

export const dynamic = "force-dynamic";

export default async function MarketingTrendsPage() {
  const supabase = await createClient();

  const [{ data: trends }, menuItems, benchmarks, settings, address] = await Promise.all([
    supabase
      .from("marketing_trends")
      .select("*")
      .order("fetched_at", { ascending: false }),
    readMenuItems(supabase),
    readPriceBenchmarks(supabase),
    readMarketingSettings(supabase),
    readCompanyAddress(supabase),
  ]);

  const area = resolveComparisonArea(settings, address);

  const { data: prices } = await supabase
    .from("competitor_prices")
    .select("*")
    .eq("area", area)
    .order("item_type", { ascending: true });

  const competitorPrices = (prices as CompetitorPrice[] | null) ?? [];
  const comparison = buildComparison(competitorPrices, menuItems, benchmarks);

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
      benchmarks={benchmarks}
    />
  );
}
