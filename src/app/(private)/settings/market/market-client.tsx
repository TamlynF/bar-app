"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Beaker,
  CandlestickChart,
  Check,
  ChevronDown,
  ChevronRight,
  Eraser,
  ExternalLink,
  FastForward,
  Info,
  Link2,
  Loader2,
  MonitorPlay,
  MoreHorizontal,
  PackagePlus,
  Play,
  PowerOff,
  Receipt,
  RotateCcw,
  SearchX,
  Square,
  TrendingDown,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DetailCard,
  EmptyState,
  ErrorBox,
  FilterChip,
  FormRow,
  ListRow,
  ListSearchInput,
  RecordList,
  RecordSheet,
  StatusPill,
  useRecordSheet,
} from "@/components/admin";
import { formatGbp } from "@/lib/price";
import { DEFAULT_MARKET_CONFIG, type MarketConfig, type StockState } from "@/lib/market/types";
import type { CatalogVariation } from "@/lib/market/mapping";
import { formatTimeWindow, type StockMarketEventSummary } from "@/lib/market/stock-market-events";
import { WEEKDAY_NAMES } from "@/lib/market/normal-units";
import { groupServesForPicker, serveLabel, type ServeOption } from "@/lib/market/event-serves";
import {
  addStockAction,
  autoMatchMappingsAction,
  clearSimulatedSalesAction,
  crashMarketAction,
  deactivateStockMarketEventAction,
  endMarketAction,
  loadCatalogVariationsAction,
  openStockMarketEventAction,
  pushMenuToSquareAction,
  restoreTillPricesAction,
  runTickNowAction,
  saveMappingAction,
  saveStockMarketEventAction,
  seedSandboxCatalogAction,
  setSquareSyncEnabledAction,
  setStockOverrideAction,
  simulateBusyRoundAction,
  simulateSaleAction,
  type RoundTenderMode,
  type SeedMode,
  type SimMode,
} from "./actions";
import { squareSandboxDashboardUrl, squareTransactionUrl } from "@/lib/market/simulate";
import type { MarketStatePayload } from "@/lib/market/tick";
import {
  CONFIG_FIELDS,
  ConfigHelp,
  PRICING_MODES,
  PUSH_ALERTS_FIELD,
  TIER_BANDS,
  TIER_FIELDS,
  TIER_PCT_FIELDS,
  configSummary,
} from "./config-fields";

export type SessionSummary = {
  id: number;
  tickNo: number;
  startedAt: string;
  crashUntilTick: number | null;
  config: MarketConfig;
  stockMarketEventId: number | null;
  squareSyncEnabled: boolean;
};

/* A session (live or ended) whose linked drinks still carry market prices
   in Square. Null means the till already shows the normal menu. */
export type TillRestoreSummary = {
  sessionId: number;
  status: "live" | "ended";
  endedAt: string | null;
  count: number;
};

export type InstrumentSummary = {
  id: number;
  name: string;
  serve: string;
  basePrice: number;
  openingPrice: number;
  currentPrice: number;
  demandUnits: number;
  stockState: StockState;
  stockOverride: StockState | null;
  mapped: boolean;
  /* Square's IN_STOCK count at the last tick; null when unlinked or unknown. */
  stockQty: number | null;
  /* Simulated units queued for the next tick (0 when nothing is waiting). */
  simPending: number;
  /* Tier leaderboard figures written by the engine each tick; all null or 0
     under demand pricing and before the market has warmed up. */
  normalUnitsPerNight: number | null;
  normalUnitsSource: string | null;
  pace: number | null;
  rankPos: number | null;
  tierPct: number | null;
  targetPrice: number | null;
};

export type SquareSimOrder = {
  id: number;
  name: string;
  serve: string;
  units: number;
  amount: number | null;
  tender: "card" | "cash" | null;
  orderId: string | null;
  paymentId: string | null;
  at: string;
};

export type SquareSimSummary = {
  environment: "sandbox" | "production";
  locationId: string | null;
  sandboxSeededAt: string | null;
  recentOrders: SquareSimOrder[];
};

export type CategoryOption = {
  id: number;
  name: string;
  tradeableCount: number;
};

export type EmployeeOption = {
  id: number;
  full_name: string;
};

export type MappingRow = {
  menuItemPriceId: number;
  itemName: string;
  categoryName: string;
  serve: string;
  amount: number;
  onEvent: boolean;
  squareVariationId: string | null;
};

type EventFilter = "all" | "live" | "run" | "never";

const CARD = "rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5";
const PRIMARY_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:h-9";
const OUTLINE_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft disabled:opacity-50 sm:h-9";
const NEUTRAL_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-line px-4 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface disabled:opacity-50 sm:h-9";
/* Row actions are icon-only on phones, so they sit as round 44px targets
   rather than wide pills with their label hidden. */
const ROW_ICON_BUTTON = "max-sm:w-11 max-sm:rounded-full max-sm:px-0";
const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
/* Every settings value sits in the same fixed column, with the browser's
   number spinners hidden so the digits line up down the card. */
const CONFIG_VALUE =
  "w-20 flex-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function WeekdayPicker({ selected }: { selected: number[] }) {
  const [days, setDays] = useState<number[]>(selected);
  function toggle(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }
  return (
    <span className="flex flex-1 flex-wrap justify-end gap-1.5">
      {days.map((day) => (
        <input key={day} type="hidden" name="weekdays" value={day} />
      ))}
      {WEEKDAY_NAMES.map((name, day) => {
        const on = days.includes(day);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            aria-label={name}
            onClick={() => toggle(day)}
            className={cn(
              "h-9 min-w-11 rounded-full border px-3 text-[12px] font-semibold transition-colors sm:h-8",
              on
                ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
                : "border-admin-line text-admin-muted hover:bg-admin-surface"
            )}
          >
            {name.slice(0, 3)}
          </button>
        );
      })}
    </span>
  );
}

function historySummary(event: StockMarketEventSummary | null): string {
  const from = event?.historyFrom ?? null;
  const to = event?.historyTo ?? null;
  const range = from || to ? `${from ?? "start"} to ${to ?? "today"}` : "last 12 weeks";
  const skip = (event?.excludeMarketNights ?? true) ? "market nights skipped" : "market nights included";
  return `${range} · ${skip}`;
}

function TierPctInputs({ field, values }: { field: { key: string; label: string; help: string }; values: number[] }) {
  return (
    <span className="flex flex-1 items-center justify-end gap-1.5">
      {TIER_BANDS.map((band, index) => (
        <label key={band} className="flex items-center gap-1 text-[11px] font-semibold text-admin-muted">
          <span className="sr-only">{`${field.label} ranks ${band}`}</span>
          <span aria-hidden="true">{band}</span>
          <input
            type="number"
            name={`${field.key}${index}`}
            aria-label={`${field.label} ranks ${band}`}
            defaultValue={Math.round((values[index] ?? 0) * 100)}
            step="1"
            min="0"
            max="90"
            required
            className={cn(FIELD_INPUT, "w-12 flex-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
          />
        </label>
      ))}
    </span>
  );
}

function ConfigFormRows({ config }: { config: MarketConfig }) {
  const [mode, setMode] = useState<MarketConfig["pricingMode"]>(config.pricingMode);
  const numberFields = CONFIG_FIELDS.filter((field) => mode === "demand" || field.key !== "noiseSigma");
  return (
    <TooltipProvider>
      <FormRow label="Pricing" align="start" dense>
        <input type="hidden" name="pricingMode" value={mode} />
        <span className="flex flex-1 flex-col items-end gap-1.5">
          <span className="inline-flex rounded-lg border border-admin-line p-0.5" role="radiogroup" aria-label="Pricing mode">
            {PRICING_MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  "h-9 rounded-md px-3 text-[12px] font-semibold transition-colors sm:h-8",
                  mode === option.value ? "bg-admin-primary-soft text-admin-primary" : "text-admin-muted hover:bg-admin-surface"
                )}
              >
                {option.label}
              </button>
            ))}
          </span>
          <span className="text-[11px] text-admin-muted">{PRICING_MODES.find((o) => o.value === mode)?.hint}</span>
        </span>
      </FormRow>
      {mode === "tiers" && (
        <>
          {TIER_FIELDS.map((field) => (
            <FormRow key={field.key} label={field.label} dense>
              <ConfigHelp field={field} />
              <span className="flex flex-1 justify-end">
                <input
                  type="number"
                  name={field.key}
                  aria-label={field.label}
                  defaultValue={config[field.key]}
                  step={field.step}
                  min="0"
                  required
                  className={cn(FIELD_INPUT, CONFIG_VALUE)}
                />
              </span>
            </FormRow>
          ))}
          <FormRow label={TIER_PCT_FIELDS.up.label} dense>
            <ConfigHelp field={{ ...TIER_PCT_FIELDS.up, hint: "Ranks 1–5, 6–10, 11–15 from the top" }} />
            <TierPctInputs field={TIER_PCT_FIELDS.up} values={config.tierPcts.up} />
          </FormRow>
          <FormRow label={TIER_PCT_FIELDS.down.label} dense>
            <ConfigHelp field={{ ...TIER_PCT_FIELDS.down, hint: "Ranks 1–5, 6–10, 11–15 from the bottom" }} />
            <TierPctInputs field={TIER_PCT_FIELDS.down} values={config.tierPcts.down} />
          </FormRow>
        </>
      )}
      {mode === "tiers" && <input type="hidden" name="noiseSigma" value={config.noiseSigma} />}
      {numberFields.map((field) => (
        <FormRow key={field.key} label={field.label} dense>
          <ConfigHelp field={field} />
          <span className="flex flex-1 justify-end">
            <input
              type="number"
              name={field.key}
              aria-label={field.label}
              defaultValue={config[field.key]}
              step={field.step}
              min="0"
              required
              className={cn(FIELD_INPUT, CONFIG_VALUE)}
            />
          </span>
        </FormRow>
      ))}
      <FormRow label={PUSH_ALERTS_FIELD.label} dense>
        <ConfigHelp field={PUSH_ALERTS_FIELD} />
        <span className="flex flex-1 justify-end">
          <span className={cn(CONFIG_VALUE, "flex justify-end")}>
            <input
              type="checkbox"
              name="pushAlertsEnabled"
              aria-label={PUSH_ALERTS_FIELD.label}
              defaultChecked={config.pushAlertsEnabled}
              className="h-4 w-4 cursor-pointer accent-admin-primary"
            />
          </span>
        </span>
      </FormRow>
    </TooltipProvider>
  );
}

/* Each serve is its own checkbox: "Guinness · pint" and "Guinness · half"
   are different instruments with different Square links. */
function DrinkPicker({
  drinks,
  selected,
  onChange,
}: {
  drinks: ServeOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const groups = useMemo(() => groupServesForPicker(drinks), [drinks]);

  const selectedSet = new Set(selected);

  function toggleServe(id: number) {
    onChange(selectedSet.has(id) ? selected.filter((d) => d !== id) : [...selected, id]);
  }

  function toggleGroup(ids: number[], allOn: boolean) {
    if (allOn) onChange(selected.filter((id) => !ids.includes(id)));
    else onChange([...new Set([...selected, ...ids])]);
  }

  if (groups.length === 0) {
    return (
      <p className="px-4 py-3 text-[13px] text-admin-muted sm:px-5">
        No priced drinks on the menu yet. Add menu items with a price first.
      </p>
    );
  }

  return (
    <div className="divide-y divide-admin-line/50">
      {groups.map((group) => {
        const ids = group.items.flatMap((item) => item.serves.map((serve) => serve.id));
        const onCount = ids.filter((id) => selectedSet.has(id)).length;
        const allOn = onCount === ids.length;
        return (
          <details key={group.id} className="group/cat">
            {/* The group checkbox lives in the summary but must not toggle it:
                its clicks stop before they reach the summary. */}
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-admin-bg px-4 py-1 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
              <label
                className="flex min-h-9 cursor-pointer items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={() => toggleGroup(ids, allOn)}
                  aria-label={`Select all ${group.name}`}
                  className="h-4 w-4 cursor-pointer accent-admin-primary"
                />
                <span className="text-[13px] font-bold text-admin-ink sm:text-sm">{group.name}</span>
              </label>
              <span className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-admin-muted tabular-nums">
                  {onCount}/{ids.length}
                </span>
                <ChevronDown
                  className="h-4 w-4 text-admin-muted transition-transform duration-200 group-open/cat:rotate-180"
                  aria-hidden="true"
                />
              </span>
            </summary>
            <div className="grid grid-cols-1 gap-x-4 bg-admin-card px-4 py-2 sm:grid-cols-2 sm:px-5">
              {group.items.flatMap((item) =>
                item.serves.map((serve) => (
                  <label
                    key={serve.id}
                    className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-admin-ink"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(serve.id)}
                      onChange={() => toggleServe(serve.id)}
                      aria-label={`Trade ${serveLabel(serve.name, serve.serve)}`}
                      className="h-4 w-4 cursor-pointer accent-admin-primary"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                      {item.serves.length > 1 || serve.serve.toLowerCase() !== "each" ? (
                        <span className="text-admin-muted"> · {serve.serve}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[11px] text-admin-muted tabular-nums">
                      {formatGbp(serve.amount)}
                      {!serve.linked && " · not linked"}
                    </span>
                  </label>
                ))
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function EventForm({
  event,
  drinks,
  live,
  formError,
  onSubmit,
}: {
  event: StockMarketEventSummary | null;
  drinks: ServeOption[];
  live: boolean;
  formError: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  const [selectedDrinks, setSelectedDrinks] = useState<number[]>(event?.menuItemPriceIds ?? []);
  const config = event?.config ?? DEFAULT_MARKET_CONFIG;

  return (
    <form
      id="stock-market-event-form"
      action={onSubmit}
      className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
    >
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="menu_item_price_ids" value={JSON.stringify(selectedDrinks)} />

      <DetailCard className="divide-y divide-admin-line/50">
        <FormRow label="Name" required dense>
          <input
            name="name"
            required
            maxLength={80}
            aria-label="Name"
            placeholder="e.g. Friday floor"
            defaultValue={event?.name ?? ""}
            className={FIELD_INPUT}
          />
        </FormRow>
        <FormRow label="Hours" required dense>
          <span className="flex flex-1 items-center justify-end gap-2">
            <input
              type="time"
              name="open_time"
              required
              aria-label="Opening time"
              defaultValue={event?.openTime || "19:00"}
              className={cn(FIELD_INPUT, "w-24 flex-none")}
            />
            <span className="text-[11px] font-semibold text-admin-muted">to</span>
            <input
              type="time"
              name="close_time"
              required
              aria-label="Closing time"
              defaultValue={event?.closeTime || "23:30"}
              className={cn(FIELD_INPUT, "w-24 flex-none")}
            />
          </span>
        </FormRow>
        <FormRow label="Runs on" align="start" dense>
          <WeekdayPicker selected={event?.weekdays ?? []} />
        </FormRow>
        <FormRow label="Bank holiday eve" dense>
          <select
            name="bank_holiday_profile"
            aria-label="Weekday profile to use on the eve of a bank holiday"
            defaultValue={event?.bankHolidayProfile ?? "6"}
            className={cn(FIELD_INPUT, "w-40 flex-none appearance-none")}
          >
            <option value="">Same as the actual day</option>
            {WEEKDAY_NAMES.map((name, index) => (
              <option key={name} value={index}>
                Trades like a {name}
              </option>
            ))}
          </select>
        </FormRow>
      </DetailCard>

      <DetailCard>
        <details className="group/history">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wide text-admin-muted">
                Sales history used for &ldquo;normal&rdquo;
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-admin-ink group-open/history:hidden">
                {historySummary(event)}
              </span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200 group-open/history:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="divide-y divide-admin-line/50 border-t border-admin-line">
            <FormRow label="From" dense>
              <input
                type="date"
                name="history_from"
                aria-label="Earliest date of sales history to use"
                defaultValue={event?.historyFrom ?? ""}
                className={cn(FIELD_INPUT, "w-40 flex-none")}
              />
            </FormRow>
            <FormRow label="To" dense>
              <input
                type="date"
                name="history_to"
                aria-label="Latest date of sales history to use"
                defaultValue={event?.historyTo ?? ""}
                className={cn(FIELD_INPUT, "w-40 flex-none")}
              />
            </FormRow>
            <FormRow label="Skip market nights" dense>
              <span className="flex flex-1 items-center justify-end">
                <input type="hidden" name="exclude_market_nights" value="off" />
                <input
                  type="checkbox"
                  name="exclude_market_nights"
                  value="on"
                  aria-label="Leave previous market nights out of the sales history"
                  defaultChecked={event?.excludeMarketNights ?? true}
                  className="h-4 w-4 cursor-pointer accent-admin-primary"
                />
              </span>
            </FormRow>
            <p className="px-4 py-2.5 text-[11px] text-admin-muted sm:px-5">
              Blank dates mean the last 12 weeks. Each drink&rsquo;s &ldquo;normal&rdquo; is the average of its last six nights on the
              chosen weekday, counted over the event&rsquo;s hours from Square orders. Bank holidays and their eves are left out.
            </p>
          </div>
        </details>
      </DetailCard>

      {/* The seven tuning numbers are rarely touched, so they start folded
          behind a one-line summary of what they currently say. */}
      <DetailCard>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wide text-admin-muted">
                Market settings
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-admin-ink group-open:hidden">
                {configSummary(config)}
              </span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="divide-y divide-admin-line/50 border-t border-admin-line">
            <ConfigFormRows config={config} />
          </div>
          {live && (
            <p className="border-t border-admin-line px-4 py-2.5 text-[11px] text-admin-muted sm:px-5">
              The market is live now. These changes apply the next time it opens.
            </p>
          )}
        </details>
      </DetailCard>

      <DetailCard>
        <details open className="group/drinks">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-admin-surface px-4 py-2.5 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="text-[11px] font-semibold tracking-wide text-admin-muted sm:text-xs">Drinks on the board</span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-admin-muted tabular-nums">
                {selectedDrinks.length} selected
              </span>
              <ChevronDown
                className="h-4 w-4 text-admin-muted transition-transform duration-200 group-open/drinks:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>
          <div className="border-t border-admin-line">
            <DrinkPicker drinks={drinks} selected={selectedDrinks} onChange={setSelectedDrinks} />
          </div>
        </details>
      </DetailCard>

      {formError && <ErrorBox message={formError} />}
    </form>
  );
}

function StockSelect({
  instrument,
  disabled,
  onChange,
}: {
  instrument: InstrumentSummary;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={`Stock override for ${instrument.name}`}
      value={instrument.stockOverride ?? "auto"}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 cursor-pointer rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none"
    >
      <option value="auto">Auto</option>
      <option value="ok">In stock</option>
      <option value="low">Running low</option>
      <option value="out">Sold out</option>
    </select>
  );
}

function stockLabel(state: StockState, qty: number | null): { label: string; className: string } {
  const count = qty == null ? "" : ` · ${Math.max(0, Math.round(qty))} left`;
  if (state === "out") return { label: `Sold out${count}`, className: "bg-admin-error-bg text-admin-error" };
  if (state === "low") return { label: `Running low${count}`, className: "bg-admin-warning-bg text-admin-warning" };
  return { label: `In stock${count}`, className: "bg-admin-success-bg text-admin-success" };
}

/* The seven raw config numbers, read as a person would say them. */
function settingTiles(config: MarketConfig): { label: string; value: string }[] {
  return [
    {
      label: "Pricing",
      value: PRICING_MODES.find((option) => option.value === config.pricingMode)?.label ?? config.pricingMode,
    },
    { label: "Prices move", value: `every ${config.tickIntervalSec}s` },
    { label: "Volatility", value: String(config.noiseSigma) },
    { label: "Price range", value: `${config.floorPct}× to ${config.ceilPct}× base` },
    { label: "Alert on a move of", value: `${Math.round(config.moveNotifyPct * 100)}%` },
    { label: "Low stock at", value: `${config.lowStockThreshold} left` },
    { label: "Leaderboard shows", value: config.leaderboardRows > 0 ? `top ${config.leaderboardRows}` : "as many as fit" },
    { label: "Phone alerts", value: config.pushAlertsEnabled ? "On" : "Off" },
  ];
}

const LIVE_POLL_MS = 5000;

function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function useCountdown(remainingSec: number | null | undefined): string {
  const endsAtRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState("0:00");

  useEffect(() => {
    if (remainingSec != null) endsAtRef.current = Date.now() + remainingSec * 1000;
  }, [remainingSec]);

  useEffect(() => {
    const update = () => {
      const endsAt = endsAtRef.current ?? Date.now();
      setCountdown(formatCountdown(endsAt - Date.now()));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return countdown;
}

/* Mirrors the public board: poll the state endpoint every few seconds and,
   once the engine has ticked, pull fresh server props so the floor moves
   without a manual reload. */
function useLiveTick(enabled: boolean, initialTickNo: number | null, onTick: () => void): MarketStatePayload | null {
  const [state, setState] = useState<MarketStatePayload | null>(null);
  const lastTickRef = useRef<number | null>(initialTickNo);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/market/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as MarketStatePayload;
        if (cancelled) return;
        setState(data);
        const tickNo = data.status === "live" ? (data.tickNo ?? null) : null;
        if (tickNo !== lastTickRef.current) {
          lastTickRef.current = tickNo;
          onTickRef.current();
        }
      } catch {
        /* transient network failure - next poll retries */
      }
    }

    poll();
    const interval = setInterval(poll, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return state;
}

function tierLabel(pct: number | null): string | null {
  if (pct == null || pct === 0) return null;
  return `${pct > 0 ? "+" : "−"}${Math.round(Math.abs(pct) * 100)}%`;
}

type FloorField = {
  key: string;
  label: string;
  help: string;
  align?: "right";
  tiersOnly?: boolean;
  /* Shown in the row's expanded panel rather than as a table column. */
  detail?: boolean;
};

/* The row keeps what changes tick to tick; the expanded panel holds the
   inputs that explain it, in the order a tier price is built: what the drink
   usually sells → how it is selling tonight → the tier that earns. */
const FLOOR_FIELDS: FloorField[] = [
  {
    key: "drink",
    label: "Drink",
    help: "The serve trading on the board. Each size is its own row, so a pint and a half of the same beer move separately. Click a row for the numbers behind its price.",
  },
  {
    key: "opening",
    label: "Opening",
    align: "right",
    help: "The price this drink started the night at when the market opened. The board's change percentage is measured from here.",
  },
  {
    key: "rank",
    label: "Rank",
    align: "right",
    tiersOnly: true,
    help: "Leaderboard position at the last re-rank. 1 is the fastest pace on the board. Ranks near the top earn a mark-up, ranks near the bottom a discount, and the middle stays at base price.",
  },
  {
    key: "target",
    label: "Target",
    align: "right",
    tiersOnly: true,
    help: "Where the price is heading: base price plus the tier. The board price glides part of the way there each tick instead of jumping, so Now catches up with Target over a few ticks. During a crash the target is the crash price instead.",
  },
  {
    key: "now",
    label: "Now",
    align: "right",
    help: "The price on the board and the till at the last tick. Green when above base, red when below.",
  },
  {
    key: "stock",
    label: "Stock",
    help: "Stock as Square last reported it. Running low and Sold out follow the event's thresholds, and Sold out freezes the price until stock comes back.",
  },
  {
    key: "override",
    label: "Override",
    help: "Force the stock state by hand. Auto follows Square; any other choice holds until you set it back to Auto.",
  },
  {
    key: "base",
    label: "Base price",
    detail: true,
    help: "The normal menu price. Every move is measured from here, and the till goes back to it when the market closes.",
  },
  {
    key: "normal",
    label: "Normal / night",
    detail: true,
    tiersOnly: true,
    help: "How many of this serve the bar usually sells on a night like tonight, averaged from past Square sales over the event's hours. Every other tier number is measured against it.",
  },
  {
    key: "demand",
    label: "Demand",
    detail: true,
    help: "Recent sales heat. Every unit sold adds one, and the total fades a little each tick, so it shows what is selling right now rather than all night.",
  },
  {
    key: "pace",
    label: "Pace",
    detail: true,
    tiersOnly: true,
    help: "Demand compared with this drink's own normal. 1.00× means it is selling as fast as usual for this point in the night, 2.00× twice as fast, 0.50× half as fast. Drinks are ranked on pace, so a small seller can still rank high if it is busier than its own normal.",
  },
  {
    key: "tier",
    label: "Tier",
    detail: true,
    tiersOnly: true,
    help: "The price move this drink's rank has earned. +10% means it is heading for 10% above its base price, −20% for 20% below. Blank means no tier yet, either because the market is still warming up or because the rank sits in the middle band.",
  },
  {
    key: "change",
    label: "Since open",
    detail: true,
    help: "How far the price has moved from its opening price tonight, as a percentage. This is the figure guests see next to the drink on the board.",
  },
  {
    key: "link",
    label: "Square link",
    detail: true,
    help: "Whether this serve is linked to a Square catalog item. Only linked serves pick up real till sales and push their market price back to the till.",
  },
];

function FieldTip({ field, align }: { field: FloorField; align: "start" | "end" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded underline decoration-dotted underline-offset-4 whitespace-nowrap transition-colors hover:text-admin-ink focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none"
        >
          {field.label}
          <Info className="h-3 w-3" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align={align} className="space-y-1 p-3">
        <p className="text-[12px] leading-snug font-semibold text-admin-ink">{field.label}</p>
        <p className="text-[11px] leading-snug text-admin-muted">{field.help}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function FloorHeading({ field, className }: { field: FloorField; className?: string }) {
  return (
    <th scope="col" className={cn("py-2 pr-3", field.align === "right" && "text-right", className)}>
      <FieldTip field={field} align={field.align === "right" ? "end" : "start"} />
    </th>
  );
}

function changeSinceOpen(instrument: InstrumentSummary): string {
  if (instrument.openingPrice <= 0) return "—";
  const pct = ((instrument.currentPrice - instrument.openingPrice) / instrument.openingPrice) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

function detailValue(field: FloorField, instrument: InstrumentSummary, warmedUp: boolean): ReactNode {
  const tier = tierLabel(instrument.tierPct);
  switch (field.key) {
    case "base":
      return formatGbp(instrument.basePrice);
    case "normal":
      return (
        <>
          {instrument.normalUnitsPerNight == null ? "—" : instrument.normalUnitsPerNight.toFixed(1)}
          {instrument.normalUnitsSource && (
            <span className="block text-[11px] font-normal text-admin-muted">{instrument.normalUnitsSource}</span>
          )}
        </>
      );
    case "demand":
      return instrument.demandUnits.toFixed(1);
    case "pace":
      return instrument.pace == null ? "—" : `${instrument.pace.toFixed(2)}×`;
    case "tier":
      if (!warmedUp || !tier) return <span className="text-admin-muted">—</span>;
      return (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            (instrument.tierPct ?? 0) > 0 ? "bg-admin-error-bg text-admin-error" : "bg-admin-success-bg text-admin-success"
          )}
        >
          {tier}
        </span>
      );
    case "change":
      return changeSinceOpen(instrument);
    case "link":
      return instrument.mapped ? "Linked" : <span className="text-admin-warning">Not linked</span>;
    default:
      return null;
  }
}

function formatRunDate(iso: string | null): string {
  if (!iso) return "Never run";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function MarketClient({
  session,
  instruments,
  categories,
  drinks,
  events,
  employees,
  mappingRows,
  tillRestore,
  squareSim,
  initialEditId,
  initialOpenId,
}: {
  session: SessionSummary | null;
  instruments: InstrumentSummary[];
  categories: CategoryOption[];
  drinks: ServeOption[];
  events: StockMarketEventSummary[];
  employees: EmployeeOption[];
  mappingRows: MappingRow[];
  tillRestore: TillRestoreSummary | null;
  squareSim: SquareSimSummary;
  initialEditId: number | null;
  initialOpenId: number | null;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [mappingOpen, setMappingOpen] = useState(false);
  const [variations, setVariations] = useState<CatalogVariation[] | null>(null);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EventFilter>("all");
  const [simOpen, setSimOpen] = useState(false);
  const [roundSize, setRoundSize] = useState(10);
  const [favouriteId, setFavouriteId] = useState<number | null>(null);
  const [simMode, setSimMode] = useState<SimMode>("queue");
  const [roundTender, setRoundTender] = useState<RoundTenderMode>("mix");
  const [seedStock, setSeedStock] = useState(40);
  const [seedMode, setSeedMode] = useState<SeedMode>("reuse");
  const [stockToAdd, setStockToAdd] = useState(12);
  const [floorOpen, setFloorOpen] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  const sheet = useRecordSheet<StockMarketEventSummary>({
    records: events,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const showForm = mode === "add" || mode === "edit";

  const openedFromUrl = useRef(false);
  const { openView, startEdit } = sheet;
  useEffect(() => {
    if (openedFromUrl.current || initialEditId == null) return;
    const target = events.find((event) => event.id === initialEditId);
    if (!target) return;
    openedFromUrl.current = true;
    openView(target);
    startEdit();
    router.replace("/settings/market");
  }, [initialEditId, events, openView, startEdit, router]);

  /* The open sheet is mirrored into the URL (?open=id) so the event's own
     page can send the back button, and the browser's back, straight into it. */
  useEffect(() => {
    if (openedFromUrl.current || initialOpenId == null) return;
    const target = events.find((event) => event.id === initialOpenId);
    if (!target) return;
    openedFromUrl.current = true;
    openView(target);
  }, [initialOpenId, events, openView]);

  function openEventSheet(event: StockMarketEventSummary) {
    sheet.openView(event);
    router.replace(`/settings/market?open=${event.id}`, { scroll: false });
  }

  function closeEventSheet() {
    sheet.close();
    router.replace("/settings/market", { scroll: false });
  }

  const live = session !== null;
  const liveState = useLiveTick(live, session?.tickNo ?? null, router.refresh);
  const nextTickCountdown = useCountdown(liveState?.nextTickInSec);
  const tiersLive = session?.config.pricingMode === "tiers";
  const warmedUp = liveState?.warmedUp ?? true;
  const floorFields = FLOOR_FIELDS.filter((field) => tiersLive || !field.tiersOnly);
  const floorColumns = floorFields.filter((field) => !field.detail);
  const detailFields = floorFields.filter((field) => field.detail);
  function toggleExpanded(id: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const liveEventId = session?.stockMarketEventId ?? null;
  const liveEventName = events.find((event) => event.id === liveEventId)?.name ?? null;
  const tradeableCount = categories.reduce((sum, cat) => sum + cat.tradeableCount, 0);

  const mappedCount = useMemo(
    () => mappingRows.filter((row) => row.onEvent && row.squareVariationId).length,
    [mappingRows]
  );
  const primaryCount = useMemo(
    () => mappingRows.filter((row) => row.onEvent).length,
    [mappingRows]
  );

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  const drinkNames = useMemo(() => new Map(drinks.map((drink) => [drink.id, drink])), [drinks]);

  const shownEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (needle && !event.name.toLowerCase().includes(needle)) return false;
      if (filter === "live") return event.id === liveEventId;
      if (filter === "run") return event.lastRunAt !== null;
      if (filter === "never") return event.lastRunAt === null;
      return true;
    });
  }, [events, query, filter, liveEventId]);

  function run(action: () => Promise<{ error?: string } | void>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  }

  function handleOpen(event: StockMarketEventSummary) {
    startTransition(async () => {
      const result = await openStockMarketEventAction(event.id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const count = "count" in result ? result.count : 0;
      toast.success(`${event.name} open - ${count} drinks trading.`);
      router.refresh();
    });
  }

  async function handleEnd() {
    const confirmed = await confirm({
      title: "Close the market?",
      description:
        "Trading stops, the board shows closed, and every linked drink goes back to its normal price on the till.",
      confirmLabel: "Close market",
    });
    if (confirmed) run(endMarketAction, "Market closed - till prices restored.");
  }

  async function handleRestoreTill() {
    if (!tillRestore) return;
    const confirmed = await confirm({
      title: "Restore till prices?",
      description:
        tillRestore.status === "live"
          ? `${tillRestore.count} linked drinks go back to their normal price on the till now. The market stays open and the next tick will move them again.`
          : `${tillRestore.count} linked drinks still show market-night prices on the till. This puts the normal menu prices back.`,
      confirmLabel: "Restore prices",
    });
    if (confirmed) {
      run(() => restoreTillPricesAction(tillRestore.sessionId), "Till prices restored.");
    }
  }

  async function handleCrash() {
    const confirmed = await confirm({
      title: "Crash the market?",
      description: "Every price tumbles toward the crash floor for the next few ticks.",
      confirmLabel: "Crash it",
    });
    if (confirmed) run(crashMarketAction, "Crash triggered - watch the board.");
  }

  /* ── Simulated sales ─────────────────────────────────────────────────────
     Queued units land on the next tick; "Tick now" runs the engine at once so
     the effect is visible without waiting out the interval. */
  const simPendingTotal = instruments.reduce((sum, instrument) => sum + instrument.simPending, 0);

  const sandboxAvailable = squareSim.environment === "sandbox";
  const sandboxSeeded = squareSim.sandboxSeededAt !== null;
  const viaSquare = simMode === "square" && sandboxAvailable;
  const tillSyncOn = session?.squareSyncEnabled ?? false;
  /* Queue-only sales still move prices, and with sync on those prices land on
     the real till when Square is production. Offer to pause sync first. */
  const queueTouchesRealTill = !viaSquare && !sandboxAvailable && tillSyncOn;

  async function confirmQueueSale(): Promise<boolean> {
    if (!queueTouchesRealTill) return true;
    const confirmed = await confirm({
      title: "Square is set to production",
      description:
        "Simulated sales move prices on the board, and till sync is on, so the real Square till would change price too. Pause till sync for this market before selling?",
      confirmLabel: "Pause till sync and sell",
    });
    if (!confirmed) return false;
    const result = await setSquareSyncEnabledAction(false);
    if (result?.error) {
      toast.error(result.error);
      return false;
    }
    return true;
  }

  /* Confirm dialogs run before the transition starts: a state update raised
     inside startTransition waits for the transition itself to finish, so a
     dialog opened in there never appears. */
  async function handleSimSale(instrument: InstrumentSummary, units: number) {
    if (!(await confirmQueueSale())) return;
    startTransition(async () => {
      const result = await simulateSaleAction(instrument.id, units, viaSquare ? "square" : "queue");
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("amount" in result && typeof result.amount === "number") {
        toast.success(
          `${units} × ${instrument.name} rung through Square sandbox - ${formatGbp(result.amount)} paid. The next tick picks it up.`
        );
      } else {
        toast.success(`${units} × ${instrument.name} queued for the next tick.`);
      }
      router.refresh();
    });
  }

  async function handleAddStock(instrument: InstrumentSummary) {
    const quantity = Math.floor(stockToAdd);
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error("Enter how much stock to add.");
      return;
    }
    if (!sandboxAvailable) {
      const confirmed = await confirm({
        title: `Add ${quantity} to Square inventory for ${instrument.name}?`,
        description: "This is a real stock change on the production Square account.",
        confirmLabel: "Add stock",
      });
      if (!confirmed) return;
    }
    startTransition(async () => {
      const result = await addStockAction(instrument.id, quantity);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${quantity} added to ${instrument.name} in Square.`);
      router.refresh();
    });
  }

  async function handleBusyRound() {
    if (!(await confirmQueueSale())) return;
    startTransition(async () => {
      const result = await simulateBusyRoundAction(
        roundSize,
        favouriteId,
        viaSquare ? "square" : "queue",
        roundTender
      );
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const sales = "sales" in result ? result.sales : 0;
      const units = "units" in result ? result.units : 0;
      if ("takings" in result && typeof result.takings === "number") {
        const split =
          "cash" in result && "card" in result ? ` (${result.card} card, ${result.cash} cash)` : "";
        toast.success(
          `${sales} sandbox orders paid${split} - ${units} drinks, ${formatGbp(result.takings)} in the Square sandbox.`
        );
        if ("partialError" in result && result.partialError) toast.error(`Round stopped early: ${result.partialError}`);
      } else {
        toast.success(`Busy round rung up - ${sales} sales, ${units} drinks queued.`);
      }
      router.refresh();
    });
  }

  async function handleSeedSandbox() {
    const confirmed = await confirm({
      title: seedMode === "reuse" ? "Stock the mapped sandbox items?" : "Seed temporary sandbox items?",
      description:
        seedMode === "reuse"
          ? `Points this market's drinks at the sandbox items their menu prices are already mapped to and sets each to ${seedStock} in stock. Nothing is created, so the catalog stays as it is. Drinks with no mapping get a temporary item.`
          : `Deletes the temporary items a previous seed created, then makes a fresh one per drink at the menu price with ${seedStock} in stock. Mapped catalog items are never touched.`,
      confirmLabel: seedMode === "reuse" ? "Stock items" : "Seed sandbox",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await seedSandboxCatalogAction(seedStock, seedMode);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const reused = "reused" in result ? result.reused : 0;
      const created = "created" in result ? result.created : 0;
      const deleted = "deleted" in result ? result.deleted : 0;
      const parts = [
        reused > 0 ? `${reused} existing` : null,
        created > 0 ? `${created} new` : null,
        deleted > 0 ? `${deleted} replaced` : null,
      ].filter(Boolean);
      toast.success(
        parts.length > 0
          ? `Sandbox ready - ${parts.join(", ")}.`
          : "Nothing to seed on this market."
      );
      setSimMode("square");
      router.refresh();
    });
  }

  function handleTickNow() {
    startTransition(async () => {
      const result = await runTickNowAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const tickNo = "tickNo" in result ? result.tickNo : null;
      toast.success(tickNo != null ? `Tick ${tickNo} run - board updated.` : "Tick run - board updated.");
      router.refresh();
    });
  }

  function handleClearSim() {
    startTransition(async () => {
      const result = await clearSimulatedSalesAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Queued simulated sales cleared.");
      router.refresh();
    });
  }

  function handleDeactivate() {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Deactivate event",
      description: `"${selected.name}" will disappear from this list. Past market nights run under it stay in the history.`,
      confirmLabel: "Deactivate",
      action: async () => {
        const result = await deactivateStockMarketEventAction(selected.id);
        if (!result.error) router.refresh();
        return result;
      },
    });
  }

  const submitEvent = sheet.submit(async (formData) => {
    const result = await saveStockMarketEventAction(formData);
    if (!result.error) router.refresh();
    return result;
  });

  async function openMappings() {
    setMappingOpen((open) => !open);
    if (variations || loadingVariations) return;
    setLoadingVariations(true);
    const result = await loadCatalogVariationsAction();
    setLoadingVariations(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    setVariations(result.variations ?? []);
  }

  async function handlePushToSquare() {
    const confirmed = await confirm({
      title: "Send the menu to Square?",
      description:
        "Creates a Square catalog item per menu item (one variation per serve, priced from the menu) and links them here automatically. Items whose name already exists in Square are skipped, never duplicated.",
      confirmLabel: "Send menu",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await pushMenuToSquareAction();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Square catalog updated - ${result?.created ?? 0} items created, ${result?.linked ?? 0} serves linked${result?.skipped ? `, ${result.skipped} already existed` : ""}.`
      );
      setVariations(null);
      router.refresh();
    });
  }

  function handleAutoMatch() {
    startTransition(async () => {
      const result = await autoMatchMappingsAction();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Matched ${result?.matched ?? 0} serves${result?.unmatched ? `, ${result.unmatched} still unmatched` : ""}.`
      );
      setVariations(null);
      router.refresh();
    });
  }

  const sheetTitle =
    mode === "add" ? "New stock market event" : mode === "edit" ? "Edit event" : "View event";
  const selectedIsLive = selected != null && selected.id === liveEventId;

  const selectedDrinksByCategory = useMemo(() => {
    if (!selected) return [];
    const groups = new Map<string, string[]>();
    for (const id of selected.menuItemPriceIds) {
      const drink = drinkNames.get(id);
      if (!drink) continue;
      groups.set(drink.categoryName, [
        ...(groups.get(drink.categoryName) ?? []),
        serveLabel(drink.name, drink.serve),
      ]);
    }
    return [...groups.entries()];
  }, [selected, drinkNames]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-3 sm:px-4 sm:py-0 md:px-6">
      {ConfirmDialogUI}


      <RecordList
        variant="panel"
        title="Stock market events"
        count={shownEvents.length}
        collapsible={false}
        onAdd={sheet.openAdd}
        addLabel="New event"
        activeFilterCount={filter === "all" ? 0 : 1}
        toolbar={
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search events"
            placeholder="Search by name"
          />
        }
        filters={
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            <FilterChip active={filter === "live"} onClick={() => setFilter("live")}>
              Live now
            </FilterChip>
            <FilterChip active={filter === "run"} onClick={() => setFilter("run")}>
              Has been run
            </FilterChip>
            <FilterChip active={filter === "never"} onClick={() => setFilter("never")}>
              Never run
            </FilterChip>
          </div>
        }
      >
        {events.length === 0 ? (
          <EmptyState
            icon={CandlestickChart}
            title="No stock market events yet"
            description={
              tradeableCount === 0
                ? "Add priced menu items first, then create an event to trade them."
                : "Create an event to choose the drinks and settings for a market night."
            }
          />
        ) : shownEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <SearchX className="h-6 w-6 text-admin-muted" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-admin-ink">No events match</p>
            <p className="text-[11px] text-admin-muted">Try a different search or filter.</p>
          </div>
        ) : (
          shownEvents.map((event) => {
            const isLive = event.id === liveEventId;
            return (
              <ListRow
                key={event.id}
                onClick={() => openEventSheet(event)}
                selected={selected?.id === event.id}
                status={
                  <StatusPill
                    tone={isLive ? "success" : "neutral"}
                    icon={isLive ? <Check className="h-3 w-3" /> : undefined}
                    className="max-sm:hidden sm:w-20 sm:justify-center"
                  >
                    {isLive ? "Live" : "Ready"}
                  </StatusPill>
                }
                actions={
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isLive ? (
                      <button
                        type="button"
                        onClick={handleEnd}
                        disabled={isPending}
                        aria-label="Close market"
                        title="Close market"
                        className={cn(
                          PRIMARY_BUTTON,
                          ROW_ICON_BUTTON,
                          "bg-admin-error hover:bg-admin-error/90"
                        )}
                      >
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        <span className="hidden sm:inline">Close market</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpen(event)}
                        disabled={isPending || live}
                        aria-label="Open market"
                        title={live ? "Close the live market first" : "Open market"}
                        className={cn(
                          PRIMARY_BUTTON,
                          ROW_ICON_BUTTON,
                          "bg-admin-success hover:bg-admin-success/90"
                        )}
                      >
                        <Play className="h-4 w-4 fill-current max-sm:ml-0.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Open market</span>
                      </button>
                    )}
                  </div>
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-admin-ink">{event.name}</p>
                  <p className="text-[11px] text-admin-muted">
                    {formatTimeWindow(event.openTime, event.closeTime)} · {event.menuItemPriceIds.length}{" "}
                    {event.menuItemPriceIds.length === 1 ? "serve" : "serves"}
                    <span className="hidden sm:inline"> · </span>
                    <span className="block sm:inline">
                      {event.lastRunAt ? `Last run ${formatRunDate(event.lastRunAt)}` : "Never run"}
                    </span>
                  </p>
                </div>
              </ListRow>
            );
          })
        )}
      </RecordList>

      <RecordSheet
        open={sheet.open}
        onClose={closeEventSheet}
        mode={mode}
        title={sheetTitle}
        recordId={selected?.id}
        formId="stock-market-event-form"
        isPending={sheet.isPending}
        onEdit={sheet.startEdit}
        onCancel={mode === "add" || !selected ? closeEventSheet : () => sheet.openView(selected)}
        confirmUI={sheet.ConfirmDialogUI}
        openHref={selected ? { href: `/settings/market/${selected.id}`, label: "Drinks, prices and history" } : undefined}
        status={
          selected && (
            <StatusPill tone={selectedIsLive ? "success" : "neutral"} showLabelOnMobile>
              {selectedIsLive ? "Live now" : "Ready to open"}
            </StatusPill>
          )
        }
        actions={
          mode === "view" && selected && !selectedIsLive
            ? [
                {
                  label: "Deactivate",
                  icon: <PowerOff className="h-4 w-4" />,
                  onSelect: handleDeactivate,
                  disabled: sheet.isPending,
                  destructive: true,
                },
              ]
            : undefined
        }
        systemInfo={
          selected == null
            ? undefined
            : {
                createdAt: selected.createdAt,
                createdBy: employeeName(selected.createdBy),
                updatedAt: selected.updatedAt,
                updatedBy: employeeName(selected.updatedBy),
              }
        }
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard className="p-4 sm:p-5">
              <p className="text-lg leading-tight font-bold text-admin-ink sm:text-xl">{selected.name}</p>
              <p className="mt-1.5 text-[13px] text-admin-muted sm:text-sm">
                {formatTimeWindow(selected.openTime, selected.closeTime)} · {selected.menuItemPriceIds.length}{" "}
                {selected.menuItemPriceIds.length === 1 ? "serve" : "serves"}
              </p>
              <p className="mt-0.5 text-[13px] text-admin-muted sm:text-sm">
                {selected.lastRunAt ? `Last run ${formatRunDate(selected.lastRunAt)}` : "Never run"}
              </p>
            </DetailCard>

            <DetailCard className="p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-semibold tracking-wide text-admin-muted sm:text-xs">Settings</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 sm:gap-y-4">
                {settingTiles(selected.config).map((tile) => (
                  <div key={tile.label} className="min-w-0">
                    <dt className="text-[11px] text-admin-muted sm:text-xs">{tile.label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-admin-ink tabular-nums sm:text-base">{tile.value}</dd>
                  </div>
                ))}
              </dl>
            </DetailCard>

            <DetailCard>
              <details open className="group/drinks">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-admin-surface px-4 py-2.5 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="text-[11px] font-semibold tracking-wide text-admin-muted sm:text-xs">Drinks on the board</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-admin-muted tabular-nums sm:text-xs">
                      {selected.menuItemPriceIds.length}
                    </span>
                    <ChevronDown
                      className="h-4 w-4 text-admin-muted transition-transform duration-200 group-open/drinks:rotate-180"
                      aria-hidden="true"
                    />
                  </span>
                </summary>
                <div className="border-t border-admin-line">
                  {selectedDrinksByCategory.length === 0 ? (
                    <p className="px-4 py-3 text-[13px] text-admin-muted sm:px-5">None selected</p>
                  ) : (
                    <div className="divide-y divide-admin-line/50">
                      {selectedDrinksByCategory.map(([category, names]) => (
                        <details key={category} className="group/cat">
                          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-admin-bg px-4 py-2 select-none sm:px-5 [&::-webkit-details-marker]:hidden">
                            <span className="text-[13px] font-bold text-admin-ink sm:text-sm">{category}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-admin-muted tabular-nums sm:text-xs">{names.length}</span>
                              <ChevronDown
                                className="h-4 w-4 text-admin-muted transition-transform duration-200 group-open/cat:rotate-180"
                                aria-hidden="true"
                              />
                            </span>
                          </summary>
                          <ul className="m-0 flex list-none flex-wrap gap-1.5 bg-admin-card px-4 py-3 sm:px-5">
                            {names.map((name) => (
                              <li
                                key={name}
                                className="rounded-lg border border-admin-line bg-admin-card px-2 py-1 text-[12px] font-medium text-admin-ink sm:text-[13px]"
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </DetailCard>
            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <EventForm
            key={`${mode}-${selected?.id ?? "new"}`}
            event={mode === "edit" ? selected : null}
            drinks={drinks}
            live={selectedIsLive}
            formError={sheet.formError}
            onSubmit={submitEvent}
          />
        )}
      </RecordSheet>

      {live && (
        <section className={cn(CARD, !floorOpen && "py-2 sm:py-2")}>
          <div className={cn("flex items-center justify-between gap-3", floorOpen && "mb-3")}>
            <button
              type="button"
              onClick={() => setFloorOpen((open) => !open)}
              aria-expanded={floorOpen}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200",
                  !floorOpen && "-rotate-90"
                )}
                aria-hidden="true"
              />
              <span className="text-sm font-bold text-admin-ink">Trading floor</span>
              {session && (
                <span className="hidden text-[11px] text-admin-muted tabular-nums sm:inline">
                  · Tick {liveState?.tickNo ?? session.tickNo} · next in {nextTickCountdown}
                </span>
              )}
            </button>
            {liveEventName && liveEventId != null && (
              <Link
                href={`/settings/market/${liveEventId}`}
                title="Open this market night"
                className="flex min-h-11 min-w-0 items-center rounded-full transition-opacity hover:opacity-80"
              >
                <StatusPill tone="success" showLabelOnMobile className="min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-admin-success opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-admin-success" />
                  </span>
                  <span className="truncate">Live · {liveEventName}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </StatusPill>
              </Link>
            )}
          </div>
          {floorOpen && (
          <>
          {/* The event row only carries Stop; the live market's other two
              actions live here, beside the prices they affect. */}
          <div className="mb-4 flex items-center gap-2 sm:max-w-md">
            <a
              href="/market/board"
              target="_blank"
              rel="noreferrer"
              className={cn(
                NEUTRAL_BUTTON,
                "flex-1 border-admin-info/40 bg-admin-info-bg whitespace-nowrap text-admin-info hover:bg-admin-info/15"
              )}
            >
              <MonitorPlay className="h-4 w-4" aria-hidden="true" />
              Big screen
            </a>
            <button
              type="button"
              onClick={handleCrash}
              disabled={isPending}
              className={cn(
                NEUTRAL_BUTTON,
                "flex-1 border-admin-warning/40 bg-admin-warning-bg whitespace-nowrap text-admin-warning hover:bg-admin-warning/15"
              )}
            >
              <TrendingDown className="h-4 w-4" aria-hidden="true" />
              Crash market
            </button>
          </div>

          {/* Test tool: fakes till sales so the market can be exercised
              without customers. Collapsed by default so a busy Saturday's
              control panel is not cluttered with +1 buttons. */}
          <div className="mb-4 rounded-xl border border-dashed border-admin-line bg-admin-surface">
            <button
              type="button"
              onClick={() => setSimOpen((open) => !open)}
              aria-expanded={simOpen}
              className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left sm:px-4"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Beaker className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden="true" />
                <span className="text-[13px] font-semibold text-admin-ink">Simulate sales</span>
                <span className="hidden text-[11px] text-admin-muted sm:inline">
                  · fake till sales feed the next tick like real ones
                </span>
              </span>
              <span className="flex items-center gap-2">
                {simPendingTotal > 0 && (
                  <StatusPill tone="warning" showLabelOnMobile>
                    {simPendingTotal} queued
                  </StatusPill>
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-admin-muted transition-transform duration-200",
                    simOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </span>
            </button>
            {simOpen && (
              <div className="space-y-3 border-t border-admin-line px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="radiogroup"
                    aria-label="How simulated sales are recorded"
                    className="flex rounded-lg border border-admin-line bg-admin-card p-0.5"
                  >
                    {(
                      [
                        { value: "queue", label: "Queue only" },
                        { value: "square", label: "Ring through Square" },
                      ] as { value: SimMode; label: string }[]
                    ).map((option) => {
                      const disabled = option.value === "square" && !sandboxAvailable;
                      const active = simMode === option.value && !disabled;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={disabled}
                          onClick={() => setSimMode(option.value)}
                          className={cn(
                            "flex h-9 items-center rounded-md px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                            active ? "bg-admin-primary text-white" : "text-admin-muted hover:bg-admin-surface"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <StatusPill tone={sandboxAvailable ? "info" : "warning"} showLabelOnMobile>
                    Square: {squareSim.environment}
                    {squareSim.locationId ? ` · ${squareSim.locationId}` : ""}
                  </StatusPill>
                </div>

                {viaSquare ? (
                  <p className="text-[12px] text-admin-muted">
                    Every sale becomes a real order and payment in the Square{" "}
                    <span className="font-semibold text-admin-ink">sandbox</span>. The market finds it the same
                    way it finds a till sale, moves the price, and writes the new price back into the sandbox
                    catalog - open the sandbox dashboard alongside the board to show the loop end to end.
                    Square takes stock off as sales ring through; Add stock puts it back so you can show the
                    restock alert. Selling a single drink always rings as card; a busy round follows the
                    round tender below.
                  </p>
                ) : (
                  <p className="text-[12px] text-admin-muted">
                    Sales go straight into the tick queue without touching Square. Use{" "}
                    <span className="font-semibold text-admin-ink">Ring through Square</span> when the app is
                    pointed at the sandbox to show the real integration.
                    {!sandboxAvailable && " Square is set to production here, so sandbox sales are locked."}
                  </p>
                )}

                {viaSquare && (
                  <div className="rounded-lg border border-admin-info/40 bg-admin-info-bg px-3 py-2.5">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-admin-ink">
                          {sandboxSeeded ? "Sandbox catalog seeded" : "Seed the sandbox catalog first"}
                        </p>
                        <p className="text-[11px] text-admin-muted">
                          {seedMode === "reuse"
                            ? "Uses the sandbox items your menu prices already point at and only sets their stock."
                            : "Replaces the temporary items from the last seed with fresh ones, so nothing duplicates."}
                        </p>
                      </div>
                      <div className="flex items-end gap-2">
                        <div
                          role="radiogroup"
                          aria-label="How the sandbox catalog is seeded"
                          className="flex rounded-lg border border-admin-line bg-admin-card p-0.5"
                        >
                          {(
                            [
                              { value: "reuse", label: "Use mapped items" },
                              { value: "temp", label: "Temp items" },
                            ] as { value: SeedMode; label: string }[]
                          ).map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={seedMode === option.value}
                              onClick={() => setSeedMode(option.value)}
                              className={cn(
                                "flex h-11 items-center rounded-md px-3 text-[12px] font-semibold transition-colors sm:h-9",
                                seedMode === option.value
                                  ? "bg-admin-primary text-white"
                                  : "text-admin-muted hover:bg-admin-surface"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <label className="flex flex-col gap-1 text-[11px] font-semibold text-admin-muted">
                          Stock each
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={seedStock}
                            onChange={(event) => setSeedStock(Number(event.target.value))}
                            className="h-11 w-20 rounded-lg border border-admin-line bg-admin-card px-3 text-base font-semibold text-admin-ink tabular-nums outline-none focus:border-admin-primary sm:h-9 sm:text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleSeedSandbox}
                          disabled={isPending}
                          className={cn(sandboxSeeded ? NEUTRAL_BUTTON : PRIMARY_BUTTON, "whitespace-nowrap")}
                        >
                          <Upload className="h-4 w-4" aria-hidden="true" />
                          {seedMode === "reuse" ? "Stock items" : sandboxSeeded ? "Re-seed" : "Seed sandbox"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {(
                        [
                          { key: "orders", label: "Sandbox orders" },
                          { key: "items", label: "Sandbox items & prices" },
                        ] as const
                      ).map((link) => (
                        <a
                          key={link.key}
                          href={squareSandboxDashboardUrl(link.key)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-11 items-center gap-1 text-[12px] font-semibold text-admin-info hover:underline sm:min-h-0"
                        >
                          {link.label}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-admin-muted">
                    Sales in a round
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={roundSize}
                      onChange={(event) => setRoundSize(Number(event.target.value))}
                      className="h-11 w-24 rounded-lg border border-admin-line bg-admin-card px-3 text-base font-semibold text-admin-ink tabular-nums outline-none focus:border-admin-primary sm:h-9 sm:text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-admin-muted">
                    Stock per add
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={stockToAdd}
                      onChange={(event) => setStockToAdd(Number(event.target.value))}
                      className="h-11 w-24 rounded-lg border border-admin-line bg-admin-card px-3 text-base font-semibold text-admin-ink tabular-nums outline-none focus:border-admin-primary sm:h-9 sm:text-sm"
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold text-admin-muted sm:max-w-xs">
                    Favourite (sells 3× as often)
                    <select
                      value={favouriteId ?? ""}
                      onChange={(event) =>
                        setFavouriteId(event.target.value === "" ? null : Number(event.target.value))
                      }
                      className="h-11 rounded-lg border border-admin-line bg-admin-card px-3 text-base font-medium text-admin-ink outline-none focus:border-admin-primary sm:h-9 sm:text-sm"
                    >
                      <option value="">No favourite</option>
                      {instruments.map((instrument) => (
                        <option key={instrument.id} value={instrument.id}>
                          {instrument.name} ({instrument.serve})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {viaSquare && (
                  <div className="flex flex-col gap-1 text-[11px] font-semibold text-admin-muted">
                    Round tender
                    <div
                      role="radiogroup"
                      aria-label="How busy-round sales are paid in Square"
                      className="flex rounded-lg border border-admin-line bg-admin-card p-0.5"
                    >
                      {(
                        [
                          { value: "mix", label: "Mixed" },
                          { value: "card", label: "Card" },
                          { value: "cash", label: "Cash" },
                        ] as { value: RoundTenderMode; label: string }[]
                      ).map((option) => {
                        const active = roundTender === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setRoundTender(option.value)}
                            className={cn(
                              "flex h-10 items-center rounded-md px-3 text-[12px] font-semibold transition-colors sm:h-8",
                              active ? "bg-admin-primary text-white" : "text-admin-muted hover:bg-admin-surface"
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleBusyRound}
                    disabled={
                      isPending || !Number.isFinite(roundSize) || roundSize < 1 || (viaSquare && !sandboxSeeded)
                    }
                    className={cn(PRIMARY_BUTTON, "flex-1 whitespace-nowrap sm:flex-none")}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Zap className="h-4 w-4" aria-hidden="true" />
                    )}
                    {viaSquare ? "Busy round via Square" : "Busy round"}
                  </button>
                  <button
                    type="button"
                    onClick={handleTickNow}
                    disabled={isPending}
                    className={cn(OUTLINE_BUTTON, "flex-1 whitespace-nowrap sm:flex-none")}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <FastForward className="h-4 w-4" aria-hidden="true" />
                    )}
                    Tick now
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSim}
                    disabled={isPending || simPendingTotal === 0}
                    className={cn(NEUTRAL_BUTTON, "whitespace-nowrap")}
                  >
                    <Eraser className="h-4 w-4" aria-hidden="true" />
                    Clear queue
                  </button>
                </div>

                {squareSim.recentOrders.length > 0 && (
                  <div className="rounded-lg border border-admin-line bg-admin-card">
                    <button
                      type="button"
                      onClick={() => setOrdersOpen((open) => !open)}
                      aria-expanded={ordersOpen}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left",
                        ordersOpen && "border-b border-admin-line"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Receipt className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden="true" />
                        <span className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                          Latest sandbox orders
                        </span>
                        <span className="hidden text-[11px] text-admin-muted sm:inline">
                          · tap an order to open it in Square
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-admin-muted tabular-nums">
                          {squareSim.recentOrders.length}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-admin-muted transition-transform duration-200",
                            ordersOpen && "rotate-180"
                          )}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    {ordersOpen && (
                      <ul className="m-0 list-none divide-y divide-admin-line/60">
                        {squareSim.recentOrders.map((order) => {
                          const body = (
                            <>
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold text-admin-ink">
                                  {order.units} × {order.name}
                                  <span className="font-normal text-admin-muted"> · {order.serve}</span>
                                </p>
                                <p className="truncate text-[11px] text-admin-muted">
                                  {new Date(order.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                  {order.tender ? ` · ${order.tender}` : ""}
                                  {order.orderId ? ` · order ${order.orderId.slice(0, 8)}…` : ""}
                                </p>
                              </div>
                              <span className="flex shrink-0 items-center gap-2">
                                {order.amount != null && (
                                  <span className="text-[13px] font-semibold text-admin-ink tabular-nums">
                                    {formatGbp(order.amount)}
                                  </span>
                                )}
                                {order.paymentId && (
                                  <ExternalLink className="h-3.5 w-3.5 text-admin-muted" aria-hidden="true" />
                                )}
                              </span>
                            </>
                          );
                          return (
                            <li key={order.id}>
                              {order.paymentId ? (
                                <a
                                  href={squareTransactionUrl(squareSim.environment, order.paymentId, squareSim.locationId)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open this transaction in Square"
                                  className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-admin-surface"
                                >
                                  {body}
                                </a>
                              ) : (
                                <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">{body}</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {tiersLive && !warmedUp && (
            <p className="mb-2 text-[11px] text-admin-muted">
              Warming up · {liveState?.unitsSoldTotal ?? 0} of {session?.config.warmupUnits} drinks sold before tiers start.
              Rank, tier and target fill in once the bar reaches that number.
            </p>
          )}
          <div className="overflow-x-auto">
            <TooltipProvider>
            <table className={cn("w-full text-left", tiersLive ? "min-w-160" : "min-w-125")}>
              <thead>
                <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                  {floorColumns.map((field) => (
                    <FloorHeading
                      key={field.key}
                      field={field}
                      className={field.key === "override" && !simOpen ? "pr-0" : undefined}
                    />
                  ))}
                  {simOpen && <th className="py-2">Sell / stock</th>}
                </tr>
              </thead>
              <tbody>
                {instruments.map((instrument) => {
                  const stock = stockLabel(instrument.stockState, instrument.stockQty);
                  const up = instrument.currentPrice > instrument.basePrice;
                  const down = instrument.currentPrice < instrument.basePrice;
                  const total = instruments.length;
                  const expanded = expandedIds.has(instrument.id);
                  const columnCount = floorColumns.length + (simOpen ? 1 : 0);
                  return (
                    <Fragment key={instrument.id}>
                    <tr
                      onClick={(event) => {
                        const control = (event.target as HTMLElement).closest("button, select, a, input, label");
                        if (!control) toggleExpanded(instrument.id);
                      }}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-admin-surface/60",
                        expanded ? "bg-admin-surface/40" : "border-b border-admin-line/60"
                      )}
                    >
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} details for ${instrument.name} (${instrument.serve})`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpanded(instrument.id);
                          }}
                          className="flex min-h-9 items-start gap-1.5 text-left"
                        >
                          <ChevronRight
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200",
                              expanded && "rotate-90"
                            )}
                            aria-hidden="true"
                          />
                          <span>
                            <span className="block text-[13px] font-semibold text-admin-ink">{instrument.name}</span>
                            <span className="block text-[11px] text-admin-muted">
                              {instrument.serve}
                              {!instrument.mapped && " · not linked to Square"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="py-2 pr-3 text-right text-[13px] text-admin-muted tabular-nums">
                        {formatGbp(instrument.openingPrice)}
                      </td>
                      {tiersLive && (
                        <>
                          <td className="py-2 pr-3 text-right text-[13px] text-admin-ink tabular-nums">
                            {!warmedUp || instrument.rankPos == null ? (
                              <span className="text-admin-muted">—</span>
                            ) : (
                              <>
                                {instrument.rankPos}
                                <span className="text-admin-muted"> / {total}</span>
                              </>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right text-[13px] text-admin-ink tabular-nums">
                            {!warmedUp || instrument.targetPrice == null ? (
                              <span className="text-admin-muted">—</span>
                            ) : (
                              formatGbp(instrument.targetPrice)
                            )}
                          </td>
                        </>
                      )}
                      <td
                        className={cn(
                          "py-2 pr-3 text-right text-[13px] font-semibold tabular-nums",
                          up ? "text-admin-success" : down ? "text-admin-error" : "text-admin-ink"
                        )}
                      >
                        {formatGbp(instrument.currentPrice)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                            stock.className
                          )}
                        >
                          {stock.label}
                        </span>
                      </td>
                      <td className={cn("py-2", simOpen && "pr-3")} onClick={(event) => event.stopPropagation()}>
                        <StockSelect
                          instrument={instrument}
                          disabled={isPending}
                          onChange={(value) =>
                            run(() => setStockOverrideAction(instrument.id, value))
                          }
                        />
                      </td>
                      {simOpen && (
                        <td className="py-2" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {[1, 5].map((units) => (
                              <button
                                key={units}
                                type="button"
                                onClick={() => handleSimSale(instrument, units)}
                                disabled={
                                  isPending ||
                                  instrument.stockState === "out" ||
                                  (viaSquare && (!sandboxSeeded || !instrument.mapped))
                                }
                                title={
                                  viaSquare
                                    ? `Ring ${units} × ${instrument.name} through the Square sandbox`
                                    : `Sell ${units} × ${instrument.name}`
                                }
                                className="flex h-9 min-w-11 items-center justify-center rounded-lg border border-admin-line bg-admin-card px-2 text-[12px] font-semibold text-admin-ink tabular-nums transition-colors hover:bg-admin-surface disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                +{units}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleAddStock(instrument)}
                              disabled={
                                isPending || !instrument.mapped || (sandboxAvailable && !sandboxSeeded)
                              }
                              aria-label={`Add ${stockToAdd} stock for ${instrument.name}`}
                              title={
                                !instrument.mapped
                                  ? "Link this drink to Square first"
                                  : sandboxAvailable && !sandboxSeeded
                                    ? "Seed the sandbox catalog first"
                                    : `Add ${stockToAdd} to Square inventory for ${instrument.name}`
                              }
                              className="flex h-9 min-w-11 items-center justify-center gap-1 rounded-lg border border-admin-line bg-admin-card px-2 text-[12px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <PackagePlus className="h-4 w-4" aria-hidden="true" />
                              <span className="hidden lg:inline">Stock</span>
                            </button>
                            {instrument.simPending > 0 && (
                              <span
                                className="rounded-full bg-admin-warning-bg px-2 py-0.5 text-[11px] font-semibold text-admin-warning tabular-nums"
                                title="Queued for the next tick"
                              >
                                {instrument.simPending} queued
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr className="border-b border-admin-line/60 bg-admin-surface/40">
                        <td colSpan={columnCount} className="px-3 pt-1 pb-3">
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-admin-line bg-admin-card p-3 sm:grid-cols-4 lg:grid-cols-7">
                            {detailFields.map((field) => (
                              <div key={field.key} className="min-w-0">
                                <dt className="text-[11px] font-semibold text-admin-muted">
                                  <FieldTip field={field} align="start" />
                                </dt>
                                <dd className="mt-0.5 text-[13px] font-semibold text-admin-ink tabular-nums">
                                  {detailValue(field, instrument, warmedUp)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </TooltipProvider>
          </div>
          </>
          )}
        </section>
      )}

      <section className={cn(CARD, mappingOpen ? "max-sm:bg-admin-line/60" : "max-sm:bg-admin-surface")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Link2 className="h-5 w-5 shrink-0 text-admin-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-admin-ink">Square links</h3>
                <StatusPill
                  tone={primaryCount > 0 && mappedCount >= primaryCount ? "success" : "warning"}
                  icon={primaryCount > 0 && mappedCount >= primaryCount ? <Check className="h-3 w-3" /> : undefined}
                  showLabelOnMobile
                  className="sm:hidden"
                >
                  {mappedCount}/{primaryCount} linked
                </StatusPill>
              </div>
              <p className="hidden text-[11px] text-admin-muted sm:block">
                Till sales drive demand for linked serves; inventory drives sold-out alerts ·{" "}
                {mappedCount}/{primaryCount} lead serves linked
              </p>
            </div>
          </div>
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={handlePushToSquare}
              disabled={isPending}
              className={OUTLINE_BUTTON}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              Send menu to Square
            </button>
            <button
              type="button"
              onClick={handleAutoMatch}
              disabled={isPending}
              className={OUTLINE_BUTTON}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Wand2 className="h-4 w-4" aria-hidden="true" />
              )}
              Auto-match
            </button>
            <button type="button" onClick={openMappings} className={NEUTRAL_BUTTON}>
              {mappingOpen ? "Hide serves" : "Edit links"}
            </button>
          </div>
          <div className="flex w-full items-center gap-2 sm:hidden">
            <button type="button" onClick={openMappings} className={cn(NEUTRAL_BUTTON, "flex-1 bg-admin-card")}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {mappingOpen ? "Hide serves" : "Edit links"}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More Square actions"
                  title="More Square actions"
                  className={cn(NEUTRAL_BUTTON, "w-11 shrink-0 bg-admin-card px-0")}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled={isPending} onSelect={handlePushToSquare} className="min-h-11">
                  <Upload className="h-4 w-4" />
                  Send menu to Square
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isPending} onSelect={handleAutoMatch} className="min-h-11">
                  <Wand2 className="h-4 w-4" />
                  Auto-match serves
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Only rendered while Square still holds market prices, so after a
            clean close it disappears on its own. Amber because it is a
            pending decision, per the Requests/Bookings colour semantics. */}
        {tillRestore && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-admin-warning/40 bg-admin-warning-bg px-3 py-2.5">
            <p className="text-[13px] text-admin-ink">
              <span className="font-semibold">
                {tillRestore.count} drink{tillRestore.count === 1 ? "" : "s"} still at market price on the till
              </span>
              <span className="text-admin-muted">
                {tillRestore.status === "live"
                  ? " · market is live"
                  : ` · market ended ${formatRunDate(tillRestore.endedAt)}`}
              </span>
            </p>
            <button
              type="button"
              onClick={handleRestoreTill}
              disabled={isPending}
              className={OUTLINE_BUTTON}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              )}
              Restore till prices
            </button>
          </div>
        )}

        {mappingOpen && (
          <div className="mt-4 max-sm:-mx-4 max-sm:-mb-4 max-sm:rounded-b-2xl max-sm:border-t max-sm:border-admin-line max-sm:bg-admin-card max-sm:px-4 max-sm:pt-1 max-sm:pb-3">
            {loadingVariations && (
              <p className="flex items-center gap-2 py-4 text-[13px] text-admin-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading the Square catalog…
              </p>
            )}
            {!loadingVariations && (
              <ul className="divide-y divide-admin-line/60">
                {mappingRows.map((row) => (
                  <li
                    key={row.menuItemPriceId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-admin-ink">
                        {row.itemName}
                        {row.onEvent && (
                          <span className="ml-1.5 rounded-full bg-admin-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-admin-primary">
                            on the board
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-admin-muted">
                        {row.categoryName} · {row.serve} · {formatGbp(row.amount)}
                      </p>
                    </div>
                    <select
                      aria-label={`Square variation for ${row.itemName} (${row.serve})`}
                      value={row.squareVariationId ?? ""}
                      disabled={isPending || !variations}
                      onChange={(event) =>
                        run(
                          () =>
                            saveMappingAction(
                              row.menuItemPriceId,
                              event.target.value || null
                            ),
                          "Link saved."
                        )
                      }
                      className="h-9 max-w-60 cursor-pointer rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none"
                    >
                      <option value="">Not linked</option>
                      {row.squareVariationId &&
                        !variations?.some((v) => v.variationId === row.squareVariationId) && (
                          <option value={row.squareVariationId}>Linked (current)</option>
                        )}
                      {(variations ?? []).map((variation) => (
                        <option key={variation.variationId} value={variation.variationId}>
                          {variation.itemName}
                          {variation.variationName ? ` - ${variation.variationName}` : ""}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
