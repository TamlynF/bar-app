import {
  clamp,
  instrumentLimits,
  moveAlert,
  nextStockState,
  roundToStep,
  stockEvent,
} from "./engine";
import type {
  EngineEvent,
  InstrumentState,
  InstrumentTickResult,
  MarketConfig,
  TickInputs,
  TierPcts,
} from "./types";

/* Tier leaderboard pricing (docs/market-tier-engine-plan.md §3, workbook tab 10).

   Every tick each drink gets a "heat" (recent sales, decaying) and a "pace"
   (heat relative to what that drink normally sells). Every N ticks the drinks
   are ranked on pace; the fastest movers get a mark-up tier, the slowest a
   discount tier. The tier sets a TARGET price and the board price glides a
   fixed share of the remaining gap each tick, so nothing teleports. Tiers are
   off until the bar has sold warmupUnits in total. CRASH replaces every
   target with the crash price for its duration. */

export const NEVER_SOLD_MINUTES = 99;

export type TierSessionState = {
  tickNo: number;
  unitsSoldTotal: number;
  warmedUpTick: number | null;
  lastRerankTick: number | null;
};

export type TierTickInputs = TickInputs & { session: TierSessionState };

export type TierInstrumentTickResult = InstrumentTickResult & {
  pace: number;
  lastSaleTick: number | null;
  minsSinceSale: number;
  rankValue: number;
  rankPos: number;
  tierPct: number;
  targetPrice: number;
};

export type TierTickOutcome = {
  results: TierInstrumentTickResult[];
  session: TierSessionState;
  reranked: boolean;
  warmedUpThisTick: boolean;
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function paceOf(
  heat: number,
  normalUnitsPerNight: number | null | undefined,
  config: MarketConfig
): number {
  const normalPerNight = Math.max(normalUnitsPerNight ?? 0, config.paceFloorUnits);
  return round3(heat / (normalPerNight / config.sessionTicksHint));
}

export function minutesSinceSale(lastSaleTick: number | null | undefined, tickNo: number): number {
  if (lastSaleTick == null) return NEVER_SOLD_MINUTES;
  return Math.min(NEVER_SOLD_MINUTES, tickNo - lastSaleTick);
}

/* Pace plus two nudges too small to overturn a real difference: recency first
   (a drink that sold more recently wins a dead heat), then a dearer base price.
   Exact ties after that fall back to instrument id in rankInstruments. */
export function rankValue(pace: number, minsSinceSale: number, basePrice: number): number {
  return pace + 0.0001 / (1 + minsSinceSale) + 0.0000001 * basePrice;
}

export function rankInstruments(values: { id: number; value: number }[]): Map<number, number> {
  const order = [...values].sort((a, b) => b.value - a.value || a.id - b.id);
  return new Map(order.map((entry, index) => [entry.id, index + 1]));
}

function bandIndex(rank: number, bands: number[]): number {
  return bands.findIndex((upper) => rank <= upper);
}

/* Rank 1 from the top is the fastest seller; rank 1 from the bottom the
   slowest. When a market is small enough for a drink to sit in both lists the
   discount wins, matching the workbook. */
export function tierPctFor(rankFromTop: number, total: number, tiers: TierPcts): number {
  const rankFromBottom = total + 1 - rankFromTop;
  const down = bandIndex(rankFromBottom, tiers.bands);
  if (down >= 0) return -Math.abs(tiers.down[down]);
  const up = bandIndex(rankFromTop, tiers.bands);
  if (up >= 0) return Math.abs(tiers.up[up]);
  return 0;
}

export function shouldRerank(
  tickNo: number,
  warmedUpTick: number | null,
  rerankEveryTicks: number
): boolean {
  if (warmedUpTick == null) return false;
  if (warmedUpTick === tickNo) return true;
  return tickNo % Math.max(1, Math.round(rerankEveryTicks)) === 0;
}

export function glideTowards(current: number, target: number, glidePct: number): number {
  return current + glidePct * (target - current);
}

export function runTierTick(instruments: InstrumentState[], inputs: TierTickInputs): TierTickOutcome {
  const { config, session } = inputs;
  const tickNo = session.tickNo;

  const unitsThisTick = instruments.reduce(
    (sum, instrument) => sum + (inputs.newUnitsByInstrument.get(instrument.id) ?? 0),
    0
  );
  const unitsSoldTotal = session.unitsSoldTotal + unitsThisTick;
  const warmedUpThisTick = session.warmedUpTick == null && unitsSoldTotal >= config.warmupUnits;
  const warmedUpTick = warmedUpThisTick ? tickNo : session.warmedUpTick;
  const reranked = shouldRerank(tickNo, warmedUpTick, config.rerankEveryTicks);

  const prepared = instruments.map((instrument) => {
    const units = inputs.newUnitsByInstrument.get(instrument.id) ?? 0;
    const heat = round3(instrument.demandUnits * config.decayK + units);
    const lastSaleTick = units > 0 ? tickNo : (instrument.lastSaleTick ?? null);
    const pace = paceOf(heat, instrument.normalUnitsPerNight, config);
    const mins = minutesSinceSale(lastSaleTick, tickNo);
    const value = rankValue(pace, mins, instrument.basePrice);
    return { instrument, units, heat, lastSaleTick, pace, mins, value };
  });

  const ranks = rankInstruments(prepared.map((p) => ({ id: p.instrument.id, value: p.value })));
  const total = prepared.length;

  const results = prepared.map(({ instrument, units, heat, lastSaleTick, pace, mins, value }) => {
    const events: EngineEvent[] = [];
    const rankPos = ranks.get(instrument.id) ?? total;

    const stockState = nextStockState(instrument, config, inputs.stockQtyByVariation);
    const stockKind = stockEvent(instrument.stockState, stockState);
    if (stockKind) events.push({ instrumentId: instrument.id, kind: stockKind, payload: {} });

    const previousTier = instrument.tierPct ?? 0;
    let tierPct = previousTier;
    if (warmedUpTick == null) tierPct = 0;
    else if (reranked) tierPct = tierPctFor(rankPos, total, config.tierPcts);
    if (reranked && tierPct !== previousTier) {
      events.push({
        instrumentId: instrument.id,
        kind: tierPct > previousTier ? "tier_up" : "tier_down",
        payload: { from: previousTier, to: tierPct, pct: Math.round(tierPct * 1000) / 10 },
      });
    }

    const limits = instrumentLimits(instrument, config);
    const crashing = inputs.crashActive || instrument.crashActive === true;
    const targetPrice = crashing ? limits.crashTarget : instrument.basePrice * (1 + tierPct);

    const frozen = stockState === "out" || instrument.stockOverride === "out";
    const price = frozen
      ? instrument.currentPrice
      : roundToStep(
          clamp(glideTowards(instrument.currentPrice, targetPrice, config.glidePct), limits.floor, limits.ceil),
          config.roundStep
        );

    const alert = moveAlert(instrument, price, limits.moveNotifyPct);
    if (alert.event) events.push(alert.event);

    return {
      id: instrument.id,
      price,
      units,
      demandUnits: heat,
      stockState,
      lastNotifiedPrice: alert.lastNotifiedPrice,
      events,
      pace,
      lastSaleTick,
      minsSinceSale: mins,
      rankValue: value,
      rankPos,
      tierPct,
      targetPrice,
    };
  });

  return {
    results,
    session: {
      tickNo,
      unitsSoldTotal,
      warmedUpTick,
      lastRerankTick: reranked ? tickNo : session.lastRerankTick,
    },
    reranked,
    warmedUpThisTick,
  };
}
