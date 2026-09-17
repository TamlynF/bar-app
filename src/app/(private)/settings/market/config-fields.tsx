"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MarketConfig, MarketConfigNumberKey } from "@/lib/market/types";

export type ConfigField = {
  key: MarketConfigNumberKey;
  label: string;
  step: string;
  hint: string;
  help: string;
};

export const CONFIG_FIELDS: ConfigField[] = [
  {
    key: "tickIntervalSec",
    label: "Tick interval (seconds)",
    step: "5",
    hint: "How often prices move",
    help: "How often prices are recalculated. A tick runs when the market page is loaded and at least this many seconds have passed since the last tick. Each tick pulls completed till sales since the previous tick to measure demand and refreshes stock counts.",
  },
  {
    key: "noiseSigma",
    label: "Volatility",
    step: "0.005",
    hint: "Random wobble per tick",
    help: "The random nudge added to every price each tick, as a fraction of the current price. 0.015 means up to 1.5% either way, on top of demand from sales. Set to 0 and prices only move on actual sales.",
  },
  {
    key: "floorPct",
    label: "Price floor (x base)",
    step: "0.05",
    hint: "0.7 = never below 70%",
    help: "The lowest a price can fall, as a multiple of the base price. At 0.7 a £4.00 drink never drops below £2.80. This also limits how far a market crash can push prices down.",
  },
  {
    key: "ceilPct",
    label: "Price ceiling (x base)",
    step: "0.05",
    hint: "1.5 = never above 150%",
    help: "The highest a price can rise, as a multiple of the base price. At 1.5 a £4.00 drink tops out at £6.00 no matter how much demand there is.",
  },
  {
    key: "moveNotifyPct",
    label: "Alert threshold",
    step: "0.01",
    hint: "0.05 = alert on a 5% move",
    help: "How far a price must move before the public feed announces it. Each drink remembers the price it was last announced at; when the price moves this fraction or more away from it, a price drop or surge alert fires and the reference point resets.",
  },
  {
    key: "lowStockThreshold",
    label: "Low stock at",
    step: "1",
    hint: "Units left before 'running low'",
    help: "The Square inventory count at or below which a drink is marked running low and a low-stock alert goes out. Zero units marks it sold out and freezes its price until restocked. Only applies to drinks linked to a Square variation; the Override column bypasses it.",
  },
  {
    key: "leaderboardRows",
    label: "Leaderboard drinks per column",
    step: "1",
    hint: "0 = as many as fit the screen",
    help: "How many drinks the big-screen leaderboard view lists under Best deals and Top shelf. Leave at 0 and the board works out how many fit the screen it is on (a 16:9 TV shows about six, a taller projector more). A number caps the list at that many; it is still trimmed if the screen cannot fit them all, so nothing is cut off.",
  },
];

/* Tier leaderboard dials (docs/market-tier-engine-plan.md, workbook tab 10). */
export const TIER_FIELDS: ConfigField[] = [
  {
    key: "rerankEveryTicks",
    label: "Re-rank every (ticks)",
    step: "1",
    hint: "5 = league table rebuilt every 5 ticks",
    help: "How often the drinks are re-sorted into tiers. Between re-ranks every drink keeps its tier and its price just glides towards the tier target, so one stray sale cannot re-price two drinks every minute.",
  },
  {
    key: "glidePct",
    label: "Glide per tick",
    step: "0.05",
    hint: "0.35 = close 35% of the gap each tick",
    help: "How fast a price walks towards where its tier says it should be. 0.35 gets about 88% of the way there in five ticks. 1 = jump straight there.",
  },
  {
    key: "warmupUnits",
    label: "Warm-up (units sold)",
    step: "5",
    hint: "Tiers off until this many drinks have sold",
    help: "Early in the night most drinks are tied on zero, so any ranking is a coin toss. Until the bar has sold this many units in total every price stays at base and the board shows 'market warming up'.",
  },
  {
    key: "paceFloorUnits",
    label: "Pace floor (units / night)",
    step: "1",
    hint: "Treat every drink as selling at least this many",
    help: "Ranking compares each drink's recent sales to what it normally sells. A drink that normally sells one a night would read as 15x its normal from a single sale; this floor keeps rare drinks honest.",
  },
];

export const TIER_BANDS = ["1–5", "6–10", "11–15"] as const;

export type TierPctField = { key: string; label: string; help: string };

export const TIER_PCT_FIELDS: { down: TierPctField; up: TierPctField } = {
  down: {
    key: "tierDown",
    label: "Slowest sellers get off (%)",
    help: "Discounts for the five slowest-selling drinks, the next five and the five after that, relative to each drink's normal rate.",
  },
  up: {
    key: "tierUp",
    label: "Fastest sellers go up (%)",
    help: "Mark-ups for the five fastest-selling drinks, the next five and the five after that. Try gentler mark-ups than discounts if pint drinkers grumble.",
  },
};

export const PRICING_MODES: { value: MarketConfig["pricingMode"]; label: string; hint: string }[] = [
  { value: "demand", label: "Demand engine", hint: "Each drink moves on its own sales; volatility adds a wobble" },
  { value: "tiers", label: "Tier leaderboard", hint: "Drinks ranked on pace; top and bottom tiers set target prices" },
];

export const PUSH_ALERTS_FIELD = {
  label: "Phone alerts",
  hint: "Notify me button on the public page",
  help: "When on, the public Market Night page offers a Notify me button and subscribed phones are buzzed on price drops, crashes and stock changes. Turn off to hide the button and stop sending alerts for this event; phones that already subscribed are kept for the next night.",
};

export function configSummary(config: MarketConfig): string {
  if (config.pricingMode === "tiers") {
    const pct = (v: number) => `${Math.round(v * 100)}`;
    return [
      "tier leaderboard",
      `${config.tickIntervalSec}s ticks`,
      `re-rank every ${config.rerankEveryTicks}`,
      `glide ${Math.round(config.glidePct * 100)}%`,
      `warm-up ${config.warmupUnits}`,
      `+${config.tierPcts.up.map(pct).join("/")} · −${config.tierPcts.down.map(pct).join("/")}`,
      config.leaderboardRows > 0 ? `board top ${config.leaderboardRows}` : "board fills screen",
      config.pushAlertsEnabled ? "phone alerts on" : "phone alerts off",
    ].join(" · ");
  }
  return [
    `${config.tickIntervalSec}s ticks`,
    `volatility ${config.noiseSigma}`,
    `${config.floorPct}x to ${config.ceilPct}x base`,
    `alert at ${Math.round(config.moveNotifyPct * 100)}%`,
    `low stock at ${config.lowStockThreshold}`,
    config.pushAlertsEnabled ? "phone alerts on" : "phone alerts off",
  ].join(" · ");
}

export function ConfigHelp({ field }: { field: Pick<ConfigField, "label" | "hint" | "help"> }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${field.label}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="space-y-1 p-3">
        <p className="text-[12px] font-semibold leading-snug text-admin-ink">{field.label}</p>
        <p className="text-[11px] leading-snug text-admin-muted">{field.hint}</p>
        <p className="text-[11px] leading-snug text-admin-muted">{field.help}</p>
      </TooltipContent>
    </Tooltip>
  );
}
