import { clamp, instrumentLimits, roundToStep } from "./engine";
import { paceOf, rankValue, tierPctFor } from "./tier-engine";
import type { MarketConfig } from "./types";

/* Numbers behind the "How the leaderboard works" page. Everything here calls
   the engine's own functions rather than restating the arithmetic, so the
   walkthrough can never describe a rule the engine no longer follows. */

export type HeatStep = { tick: number; units: number; heat: number };

export function heatDecaySeries(units: number[], decayK: number): HeatStep[] {
  const steps: HeatStep[] = [];
  let heat = 0;
  units.forEach((sold, index) => {
    heat = Math.round((heat * decayK + sold) * 1000) / 1000;
    steps.push({ tick: index + 1, units: sold, heat });
  });
  return steps;
}

export type PaceBreakdown = {
  heat: number;
  normalPerNight: number;
  usedPerNight: number;
  floorApplied: boolean;
  ticksPerNight: number;
  normalPerTick: number;
  pace: number;
};

export function paceBreakdown(
  heat: number,
  normalUnitsPerNight: number | null | undefined,
  config: MarketConfig
): PaceBreakdown {
  const normalPerNight = normalUnitsPerNight ?? 0;
  const usedPerNight = Math.max(normalPerNight, config.paceFloorUnits);
  return {
    heat,
    normalPerNight,
    usedPerNight,
    floorApplied: usedPerNight > normalPerNight,
    ticksPerNight: config.sessionTicksHint,
    normalPerTick: usedPerNight / config.sessionTicksHint,
    pace: paceOf(heat, normalUnitsPerNight, config),
  };
}

export type TierBandRow = {
  band: string;
  fromTop: string;
  fromBottom: string;
  up: number;
  down: number;
};

export function tierBandRows(config: MarketConfig): TierBandRow[] {
  const { bands, up, down } = config.tierPcts;
  return bands.map((upper, index) => {
    const lower = index === 0 ? 1 : bands[index - 1] + 1;
    const band = lower === upper ? `${lower}` : `${lower}–${upper}`;
    return {
      band,
      fromTop: `Rank ${band} from the top`,
      fromBottom: `Rank ${band} from the bottom`,
      up: up[index] ?? 0,
      down: down[index] ?? 0,
    };
  });
}

export function tierPctForRank(rank: number, total: number, config: MarketConfig): number {
  return tierPctFor(rank, total, config.tierPcts);
}

/* The price the engine puts on the board at an update: the target, held
   inside the floor and ceiling and rounded to a payable amount. */
export function updatePrice(basePrice: number, targetPrice: number, config: MarketConfig): number {
  const limits = instrumentLimits({ basePrice }, config);
  return roundToStep(clamp(targetPrice, limits.floor, limits.ceil), config.roundStep);
}

export function ticksUntilRerank(tickNo: number, rerankEveryTicks: number): number {
  const every = Math.max(1, Math.round(rerankEveryTicks));
  return every - (tickNo % every);
}

export type RankExample = {
  name: string;
  units: number;
  pace: PaceBreakdown;
  tieBreakValue: number;
};

/* Two drinks, the same single sale, opposite verdicts - the point of ranking
   on pace instead of units. */
export function rankExample(
  name: string,
  units: number,
  normalUnitsPerNight: number | null,
  basePrice: number,
  config: MarketConfig
): RankExample {
  const pace = paceBreakdown(units, normalUnitsPerNight, config);
  return {
    name,
    units,
    pace,
    tieBreakValue: rankValue(pace.pace, 0, basePrice),
  };
}
