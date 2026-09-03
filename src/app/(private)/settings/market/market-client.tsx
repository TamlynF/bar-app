"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CandlestickChart,
  Info,
  Link2,
  Loader2,
  MonitorPlay,
  TrendingDown,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatGbp } from "@/lib/price";
import { DEFAULT_MARKET_CONFIG, type MarketConfig, type StockState } from "@/lib/market/types";
import type { CatalogVariation } from "@/lib/market/mapping";
import {
  autoMatchMappingsAction,
  crashMarketAction,
  endMarketAction,
  loadCatalogVariationsAction,
  pushMenuToSquareAction,
  saveMappingAction,
  setStockOverrideAction,
  startMarketAction,
  updateConfigAction,
} from "./actions";

export type SessionSummary = {
  id: number;
  tickNo: number;
  startedAt: string;
  crashUntilTick: number | null;
  config: MarketConfig;
};

export type InstrumentSummary = {
  id: number;
  name: string;
  serve: string;
  basePrice: number;
  currentPrice: number;
  demandUnits: number;
  stockState: StockState;
  stockOverride: StockState | null;
  mapped: boolean;
};

export type CategoryOption = {
  id: number;
  name: string;
  tradeableCount: number;
};

export type MappingRow = {
  menuItemPriceId: number;
  itemName: string;
  categoryName: string;
  serve: string;
  amount: number;
  isPrimary: boolean;
  squareVariationId: string | null;
};

const CARD = "rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5";
const PRIMARY_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:opacity-50 sm:h-9";
const OUTLINE_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft disabled:opacity-50 sm:h-9";
const NEUTRAL_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-lg border border-admin-line px-4 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface disabled:opacity-50 sm:h-9";
const FIELD =
  "h-11 w-full rounded-lg border border-admin-line bg-admin-card px-3 text-sm font-semibold text-admin-ink outline-none focus:border-admin-primary sm:h-9";

const CONFIG_FIELDS: {
  key: keyof MarketConfig;
  label: string;
  step: string;
  hint: string;
  help: string;
}[] = [
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

function ConfigFields({ config }: { config: MarketConfig }) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONFIG_FIELDS.map((field) => {
          const inputId = `market-config-${field.key}`;
          return (
            <div key={field.key}>
              <div className="mb-1 flex items-center gap-1">
                <label
                  htmlFor={inputId}
                  className="text-[11px] font-semibold text-admin-muted"
                >
                  {field.label}
                </label>
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
                    <p className="text-[12px] font-semibold leading-snug text-admin-ink">
                      {field.label}
                    </p>
                    <p className="text-[11px] leading-snug text-admin-muted">{field.help}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <input
                id={inputId}
                type="number"
                name={field.key}
                defaultValue={config[field.key]}
                step={field.step}
                min="0"
                className={FIELD}
              />
              <span className="mt-1 block text-[11px] text-admin-muted">{field.hint}</span>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
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

function stockLabel(state: StockState): { label: string; className: string } {
  if (state === "out") return { label: "Sold out", className: "bg-admin-error-bg text-admin-error" };
  if (state === "low") return { label: "Running low", className: "bg-admin-warning-bg text-admin-warning" };
  return { label: "In stock", className: "bg-admin-success-bg text-admin-success" };
}

export default function MarketClient({
  session,
  instruments,
  categories,
  mappingRows,
}: {
  session: SessionSummary | null;
  instruments: InstrumentSummary[];
  categories: CategoryOption[];
  mappingRows: MappingRow[];
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [selectedCategories, setSelectedCategories] = useState<number[]>(
    categories.filter((cat) => cat.tradeableCount > 0).map((cat) => cat.id)
  );
  const [mappingOpen, setMappingOpen] = useState(false);
  const [variations, setVariations] = useState<CatalogVariation[] | null>(null);
  const [loadingVariations, setLoadingVariations] = useState(false);

  const mappedCount = useMemo(
    () => mappingRows.filter((row) => row.isPrimary && row.squareVariationId).length,
    [mappingRows]
  );
  const primaryCount = useMemo(
    () => mappingRows.filter((row) => row.isPrimary).length,
    [mappingRows]
  );

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

  function toggleCategory(id: number) {
    setSelectedCategories((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  }

  async function handleStart(formData: FormData) {
    formData.set("category_ids", JSON.stringify(selectedCategories));
    const result = await startMarketAction(formData);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Market open - ${result?.count ?? 0} drinks trading.`);
    router.refresh();
  }

  async function handleEnd() {
    const confirmed = await confirm({
      title: "End the market?",
      description: "Trading stops and the board shows closed. Menu prices are untouched.",
      confirmLabel: "End market",
    });
    if (confirmed) run(endMarketAction, "Market closed.");
  }

  async function handleCrash() {
    const confirmed = await confirm({
      title: "Crash the market?",
      description: "Every price tumbles toward the crash floor for the next few ticks.",
      confirmLabel: "Crash it",
    });
    if (confirmed) run(crashMarketAction, "Crash triggered - watch the board.");
  }

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

  const live = session !== null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-2 py-3 sm:px-4 sm:py-0 md:px-6">
      {ConfirmDialogUI}

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CandlestickChart className="h-5 w-5 text-admin-primary" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-admin-ink">Drinks market</h2>
              <p className="text-[11px] text-admin-muted">
                {live
                  ? `Live since ${new Date(session.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · tick ${session.tickNo}`
                  : "Prices trade like stocks on the big screen while the night runs"}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
              live ? "bg-admin-success-bg text-admin-success" : "bg-admin-surface text-admin-muted"
            )}
          >
            {live ? "Live" : "Closed"}
          </span>
        </div>

        {!live ? (
          <form action={handleStart} className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold text-admin-muted">
                Categories on the board
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className={cn(
                      "flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors sm:h-9",
                      selectedCategories.includes(cat.id)
                        ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
                        : "border-admin-line text-admin-muted hover:bg-admin-surface"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="sr-only"
                      aria-label={`Trade ${cat.name}`}
                    />
                    {cat.name}
                    <span className="text-[11px] font-medium opacity-70">{cat.tradeableCount}</span>
                  </label>
                ))}
              </div>
            </div>

            <ConfigFields config={DEFAULT_MARKET_CONFIG} />

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-admin-muted">
                {mappedCount}/{primaryCount} lead serves linked to Square - unlinked drinks
                random-walk only.
              </p>
              <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Start market
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <form
              action={(formData) => {
                run(() => updateConfigAction(formData), "Market settings updated.");
              }}
              className="space-y-3"
            >
              <ConfigFields config={session.config} />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <a
                  href="/market/board"
                  target="_blank"
                  rel="noreferrer"
                  className={NEUTRAL_BUTTON}
                >
                  <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                  Open big screen
                </a>
                <button
                  type="button"
                  onClick={handleCrash}
                  disabled={isPending}
                  className={OUTLINE_BUTTON}
                >
                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
                  Crash the market
                </button>
                <button
                  type="button"
                  onClick={handleEnd}
                  disabled={isPending}
                  className={NEUTRAL_BUTTON}
                >
                  End market
                </button>
                <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Save settings
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {live && (
        <section className={CARD}>
          <h3 className="mb-3 text-sm font-bold text-admin-ink">Trading floor</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-125 text-left">
              <thead>
                <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                  <th className="py-2 pr-3">Drink</th>
                  <th className="py-2 pr-3 text-right">Base</th>
                  <th className="py-2 pr-3 text-right">Now</th>
                  <th className="py-2 pr-3 text-right">Demand</th>
                  <th className="py-2 pr-3">Stock</th>
                  <th className="py-2">Override</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((instrument) => {
                  const stock = stockLabel(instrument.stockState);
                  const up = instrument.currentPrice > instrument.basePrice;
                  const down = instrument.currentPrice < instrument.basePrice;
                  return (
                    <tr key={instrument.id} className="border-b border-admin-line/60">
                      <td className="py-2 pr-3">
                        <p className="text-[13px] font-semibold text-admin-ink">
                          {instrument.name}
                        </p>
                        <p className="text-[11px] text-admin-muted">
                          {instrument.serve}
                          {!instrument.mapped && " · not linked to Square"}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-right text-[13px] text-admin-muted tabular-nums">
                        {formatGbp(instrument.basePrice)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 text-right text-[13px] font-semibold tabular-nums",
                          up ? "text-admin-success" : down ? "text-admin-error" : "text-admin-ink"
                        )}
                      >
                        {formatGbp(instrument.currentPrice)}
                      </td>
                      <td className="py-2 pr-3 text-right text-[13px] text-admin-muted tabular-nums">
                        {instrument.demandUnits.toFixed(1)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            stock.className
                          )}
                        >
                          {stock.label}
                        </span>
                      </td>
                      <td className="py-2">
                        <StockSelect
                          instrument={instrument}
                          disabled={isPending}
                          onChange={(value) =>
                            run(() => setStockOverrideAction(instrument.id, value))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link2 className="h-5 w-5 text-admin-primary" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-admin-ink">Square links</h3>
              <p className="text-[11px] text-admin-muted">
                Till sales drive demand for linked serves; inventory drives sold-out alerts
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
        </div>

        {mappingOpen && (
          <div className="mt-4">
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
                        {row.isPrimary && (
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
                          {variation.variationName ? ` — ${variation.variationName}` : ""}
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
