"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MarketConfig } from "@/lib/market/types";

export type ConfigField = {
  key: keyof MarketConfig;
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
];

export function configSummary(config: MarketConfig): string {
  return [
    `${config.tickIntervalSec}s ticks`,
    `volatility ${config.noiseSigma}`,
    `${config.floorPct}x to ${config.ceilPct}x base`,
    `alert at ${Math.round(config.moveNotifyPct * 100)}%`,
    `low stock at ${config.lowStockThreshold}`,
  ].join(" · ");
}

export function ConfigHelp({ field }: { field: ConfigField }) {
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
