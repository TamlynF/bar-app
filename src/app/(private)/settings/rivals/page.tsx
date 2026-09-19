import { createClient } from "@/lib/supabase/server";
import {
  deriveAreaFromAddress,
  ensureMarketingSettings,
  readCompanyAddress,
  resolveComparisonArea,
} from "@/app/(private)/marketing/lib/settings";
import type { MarketingCompetitor } from "@/app/(private)/marketing/lib/types";
import RivalsClient from "./rivals-client";

export const maxDuration = 300;

export default async function RivalsSettingsPage() {
  const supabase = await createClient();
  const address = await readCompanyAddress(supabase);
  const settings = await ensureMarketingSettings(supabase, deriveAreaFromAddress(address));
  const area = resolveComparisonArea(settings, address);

  const { data, error } = await supabase
    .from("marketing_competitors")
    .select("*")
    .eq("area", area)
    .order("is_pinned", { ascending: false })
    .order("name", { ascending: true });

  if (error) console.error("Error fetching rivals:", error);

  const rivals = ((data as MarketingCompetitor[] | null) ?? []).map((rival) => ({
    ...rival,
    menu_urls: rival.menu_urls ?? [],
  }));

  const { data: priceRows } = await supabase
    .from("competitor_prices")
    .select("competitor_id, venue_name")
    .eq("area", area);

  const priceCounts: Record<string, number> = {};
  for (const row of priceRows ?? []) {
    const key = row.competitor_id || `name:${row.venue_name}`;
    priceCounts[key] = (priceCounts[key] ?? 0) + 1;
  }

  return (
    <RivalsClient
      area={area}
      radius={settings?.comparison_radius ?? null}
      initialRivals={rivals}
      priceCounts={priceCounts}
      lastRivalRun={settings?.last_rival_run ?? null}
    />
  );
}
