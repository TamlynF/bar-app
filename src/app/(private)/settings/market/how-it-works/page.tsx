import { createClient } from "@/lib/supabase/server";
import { optionalNumber } from "@/lib/market/drink-overrides";
import { resolveMarketConfig } from "@/lib/market/types";
import LeaderboardExplainer, {
  type ExplainerDrink,
  type ExplainerSession,
} from "./leaderboard-explainer";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: number;
  status: string;
  tick_no: number;
  units_sold_total: number | null;
  warmed_up_tick: number | null;
  config: unknown;
  stock_market_events: { name: string } | { name: string }[] | null;
};

function eventName(row: SessionRow | null): string | null {
  if (!row) return null;
  const joined = Array.isArray(row.stock_market_events)
    ? row.stock_market_events[0]
    : row.stock_market_events;
  return joined?.name ?? null;
}

export default async function MarketHowItWorksPage() {
  const supabase = await createClient();

  const { data: sessionRows } = await supabase
    .from("market_sessions")
    .select(
      "id, status, tick_no, units_sold_total, warmed_up_tick, config, stock_market_events(name)"
    )
    .order("started_at", { ascending: false })
    .limit(5);

  const rows = (sessionRows ?? []) as SessionRow[];
  const liveRow = rows.find((row) => row.status === "live") ?? null;
  const configRow = liveRow ?? rows[0] ?? null;
  const config = resolveMarketConfig(configRow?.config);

  let drinks: ExplainerDrink[] = [];
  if (liveRow) {
    const { data: instrumentRows } = await supabase
      .from("market_instruments")
      .select(
        "id, display_name, serve, base_price, current_price, demand_units, normal_units_per_night, pace, rank_pos, tier_pct, target_price"
      )
      .eq("session_id", liveRow.id);
    drinks = (instrumentRows ?? []).map((row) => ({
      id: row.id as number,
      name: row.display_name as string,
      serve: row.serve as string,
      basePrice: Number(row.base_price),
      currentPrice: Number(row.current_price),
      normalUnitsPerNight: optionalNumber(row.normal_units_per_night),
      heat: Number(row.demand_units ?? 0),
      pace: optionalNumber(row.pace),
      rankPos: (row.rank_pos as number | null) ?? null,
      tierPct: optionalNumber(row.tier_pct),
      targetPrice: optionalNumber(row.target_price),
    }));
  }

  const session: ExplainerSession | null = liveRow
    ? {
        eventName: eventName(liveRow),
        tickNo: liveRow.tick_no,
        unitsSoldTotal: liveRow.units_sold_total ?? 0,
        warmedUp: liveRow.warmed_up_tick != null,
        drinkCount: drinks.length,
      }
    : null;

  return (
    <LeaderboardExplainer
      config={config}
      session={session}
      drinks={drinks}
      live={Boolean(liveRow)}
      tiersOn={config.pricingMode === "tiers"}
    />
  );
}
