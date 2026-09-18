"use client";

import { Fragment, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ExternalLink,
  Info,
  ListOrdered,
  Loader2,
  MonitorPlay,
  PackagePlus,
  ShoppingCart,
  PoundSterling,
  Settings2,
  Square,
  TrendingDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatGbp } from "@/lib/price";
import type { StockState } from "@/lib/market/types";
import { ListSearchInput } from "@/components/admin";
import { TickBreakdownSheet } from "./tick-breakdown-sheet";
import { squareItemUrl } from "@/lib/market/simulate";
import { mergeLiveInstruments } from "@/lib/market/live-merge";
import { useLiveTick } from "@/hooks/use-live-tick";
import {
  crashInstrumentAction,
  crashMarketAction,
  endMarketAction,
  rerankNowAction,
  setInstrumentPriceAction,
  setStockOverrideAction,
  squareItemLinkAction,
} from "./actions";
import { SimPanel } from "./sim-panel";
import { useSimTools } from "./sim-tools";
import type { InstrumentSummary, SessionSummary, SquareSimSummary } from "./types";
import { CARD, NEUTRAL_BUTTON, PRIMARY_BUTTON } from "./ui";

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
    help: "Position at the last re-rank, sorted on pace with 1 the busiest drink relative to its own normal. Ties go to the drink that sold most recently, then the dearer one. The top bands earn a mark-up, the bottom bands a discount, the middle stays at base. It only changes at a re-rank, so between re-ranks pace can move while rank stays put.",
  },
  {
    key: "target",
    label: "Target",
    align: "right",
    tiersOnly: true,
    help: "Base price with the tier applied: £8.95 at +30% targets £11.64. The board price closes a fixed share of the gap each tick instead of jumping, so Now catches up over a few ticks. During a crash every target is the crash price instead.",
  },
  {
    key: "now",
    label: "Now",
    align: "right",
    help: "The price on the board and the till at the last tick. Red when above tonight's opening price, green when below, matching the change guests see on the board.",
  },
  {
    key: "stock",
    label: "Stock",
    help: "Stock as Square last reported it, unless an override is set. Running low and Sold out follow the event's thresholds. Sold out freezes the price and drops the drink from the deals; Running low is a badge and an alert only.",
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
    help: "How many of this serve the bar usually sells on a night like tonight, averaged from past Square sales over the event's hours. Pace is measured against it. Drinks under the event's pace floor are treated as selling the floor amount, so one sale of a rare bottle can't top the board.",
  },
  {
    key: "demand",
    label: "Demand",
    detail: true,
    help: "Recent sales heat. Every unit sold adds one and the total keeps only part of itself each tick, so it shows what is selling right now rather than all night. Pace divides this by the drink's per-tick normal.",
  },
  {
    key: "pace",
    label: "Pace",
    detail: true,
    tiersOnly: true,
    help: "Demand divided by what this drink sells per tick on a normal night. 1.00× is a normal night for it, 2.00× twice as busy, 0.50× half. One sale lifts a 3-a-night cocktail well above 1× but barely moves a 60-a-night pint, so the board rewards drinks hotter than their own usual, not just big sellers. This is the only number the rank sorts on.",
  },
  {
    key: "tier",
    label: "Tier",
    detail: true,
    tiersOnly: true,
    help: "The price move the rank earned at the last re-rank, as a share of base price: +30% for the top band down to −30% for the bottom band. Blank means base price, either because the market is still warming up or because the rank sits in the middle. In a small market where a drink falls in both the top and bottom bands, the discount wins.",
  },
  {
    key: "sold",
    label: "Units tonight",
    detail: true,
    help: "How many of this serve have sold since the market opened, from the till plus any simulated sales. The raw material for heat and pace.",
  },
  {
    key: "range",
    label: "High / low",
    detail: true,
    help: "The highest and lowest board price this drink has reached tonight, opening price included.",
  },
  {
    key: "tierChanges",
    label: "Tier changes",
    detail: true,
    tiersOnly: true,
    help: "How many re-ranks have moved this drink to a different tier tonight. A drink that bounces between bands every re-rank is sitting on a band edge.",
  },
  {
    key: "priceChanges",
    label: "Price changes",
    detail: true,
    help: "How many ticks have moved the board price tonight, by any amount. The till only follows moves above its write threshold.",
  },
  {
    key: "change",
    label: "Since open",
    detail: true,
    help: "Now minus the opening price, in pounds and as a percentage. The percentage is the figure guests see next to the drink on the board.",
  },
  {
    key: "link",
    label: "Square link",
    detail: true,
    help: "Whether this serve is linked to a Square catalog item. Only linked serves pick up real till sales and push their market price back to the till. Click Linked to open the item in the Square dashboard.",
  },
  {
    key: "ticks",
    label: "Tick breakdown",
    detail: true,
    help: "Every tick this session for this drink: units sold, heat, pace, minutes since sale, rank value, rank, adjust, target, board price and till price, with the formula behind each column. The working behind the numbers on this row.",
  },
];

const SELL_STOCK_HEADING: FloorField = {
  key: "sell-stock",
  label: "Sell / stock",
  help: "Test buttons. The cart sells the Units per sell amount, queued for the next tick or rung through the Square sandbox; sales feed demand, pace and the next rank. The box adds the Stock per add amount to the drink's Square inventory, for showing the running low and back in stock alerts.",
};

const ACTIONS_HEADING: FloorField = {
  key: "actions",
  label: "Stock override · price · crash",
  align: "right",
  help: "Stock override replaces Square's count with your word: Sold out freezes the price and hides the drink from the deals, Running low is a badge and an alert only, and it holds until set back to Auto. Rank and tier never change with stock. £ puts a price on the board this moment, within the drink's limits; rank, tier and Target don't move, so it glides back toward Target over a few ticks - a nudge, not a lock. Crash drops this one drink to its crash price for the crash duration.",
};

type SortKey = "drink" | "opening" | "rank" | "target" | "now" | "stock";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const SORTABLE: Record<string, SortKey> = {
  drink: "drink",
  opening: "opening",
  rank: "rank",
  target: "target",
  now: "now",
  stock: "stock",
};

const STOCK_ORDER: Record<StockState, number> = { out: 0, low: 1, ok: 2 };

function sortValue(instrument: InstrumentSummary, key: SortKey): number | string {
  switch (key) {
    case "drink":
      return `${instrument.name} ${instrument.serve}`.toLowerCase();
    case "opening":
      return instrument.openingPrice;
    case "rank":
      return instrument.rankPos ?? Number.MAX_SAFE_INTEGER;
    case "target":
      return instrument.targetPrice ?? instrument.basePrice;
    case "now":
      return instrument.currentPrice;
    case "stock":
      return STOCK_ORDER[instrument.stockState] * 100000 + (instrument.stockQty ?? 0);
  }
}

function sortInstruments(list: InstrumentSummary[], sort: Sort | null): InstrumentSummary[] {
  if (!sort) return list;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
    return cmp * sign || a.name.localeCompare(b.name);
  });
}

/* Everything a row shows, flattened, so one search box finds a drink by
   name, serve, any price, rank, tier, pace or stock wording. */
function searchText(instrument: InstrumentSummary, warmedUp: boolean): string {
  const tier = tierLabel(instrument.tierPct);
  return [
    instrument.name,
    instrument.serve,
    instrument.mapped ? "linked" : "not linked",
    instrument.crashing ? "crashing" : "",
    formatGbp(instrument.openingPrice),
    formatGbp(instrument.basePrice),
    formatGbp(instrument.currentPrice),
    instrument.targetPrice == null ? "" : formatGbp(instrument.targetPrice),
    warmedUp && instrument.rankPos != null ? `rank ${instrument.rankPos}` : "",
    warmedUp && tier ? tier : "",
    instrument.pace == null ? "" : `${instrument.pace.toFixed(2)}×`,
    stockLabel(instrument.stockState, instrument.stockQty).label,
    instrument.stockOverride ? `override ${instrument.stockOverride}` : "auto",
    changeSinceOpen(instrument),
  ]
    .join(" ")
    .toLowerCase();
}

function FieldTip({
  field,
  align,
  sortDir,
  onSort,
}: {
  field: FloorField;
  align: "start" | "end";
  sortDir?: "asc" | "desc" | null;
  onSort?: () => void;
}) {
  const label = onSort ? (
    <button
      type="button"
      onClick={onSort}
      aria-label={`Sort by ${field.label}${sortDir ? `, currently ${sortDir === "asc" ? "ascending" : "descending"}` : ""}`}
      className={cn(
        "inline-flex items-center gap-0.5 rounded whitespace-nowrap transition-colors hover:text-admin-ink focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none",
        sortDir && "text-admin-ink"
      )}
    >
      {field.label}
      {sortDir === "asc" ? (
        <ArrowUp className="h-3 w-3" aria-hidden="true" />
      ) : sortDir === "desc" ? (
        <ArrowDown className="h-3 w-3" aria-hidden="true" />
      ) : null}
    </button>
  ) : (
    <span className="whitespace-nowrap">{field.label}</span>
  );
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About ${field.label}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-admin-surface hover:text-admin-ink focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none"
          >
            <Info className="h-3 w-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align={align} className="max-w-72 space-y-1 p-3">
          <p className="text-[12px] leading-snug font-semibold text-admin-ink">{field.label}</p>
          <p className="text-[11px] leading-snug text-admin-muted">{field.help}</p>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function FloorHeading({
  field,
  className,
  sort,
  onSort,
}: {
  field: FloorField;
  className?: string;
  sort?: Sort | null;
  onSort?: (key: SortKey) => void;
}) {
  const sortKey = SORTABLE[field.key];
  const active = sortKey && sort?.key === sortKey ? sort.dir : null;
  return (
    <th
      scope="col"
      aria-sort={active ? (active === "asc" ? "ascending" : "descending") : undefined}
      className={cn("py-2 pr-3", field.align === "right" && "text-right", className)}
    >
      <FieldTip
        field={field}
        align={field.align === "right" ? "end" : "start"}
        sortDir={active}
        onSort={sortKey && onSort ? () => onSort(sortKey) : undefined}
      />
    </th>
  );
}

const CHAIN_KEYS = ["base", "normal", "demand", "pace", "tier", "now", "change"];
const TONIGHT_KEYS = ["sold", "range", "priceChanges", "tierChanges"];
const MORE_KEYS = ["link", "ticks"];

function DetailGroup({
  title,
  blurb,
  className,
  children,
}: {
  title: string;
  blurb: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-admin-line/70 bg-admin-surface/50 px-3 pt-2 pb-3", className)}>
      <h4 className="text-[12px] font-bold text-admin-ink">{title}</h4>
      <p className="mt-0.5 mb-2.5 text-[11px] text-admin-muted">{blurb}</p>
      {children}
    </section>
  );
}

function DetailCell({ field, children }: { field: FloorField; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-admin-muted">
        <FieldTip field={field} align="start" />
      </dt>
      <dd className="mt-0.5 text-[15px] font-bold text-admin-ink tabular-nums">{children}</dd>
    </div>
  );
}

function changeSinceOpen(instrument: InstrumentSummary): string {
  if (instrument.openingPrice <= 0) return "—";
  const diff = instrument.currentPrice - instrument.openingPrice;
  const pct = (diff / instrument.openingPrice) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return `${sign}${formatGbp(Math.abs(diff))} (${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%)`;
}

function detailValue(field: FloorField, instrument: InstrumentSummary, warmedUp: boolean): ReactNode {
  const tier = tierLabel(instrument.tierPct);
  const up = instrument.currentPrice > instrument.openingPrice;
  const down = instrument.currentPrice < instrument.openingPrice;
  switch (field.key) {
    case "base":
      return formatGbp(instrument.basePrice);
    case "normal":
      return instrument.normalUnitsPerNight == null ? "—" : instrument.normalUnitsPerNight.toFixed(1);
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
      return (
        <span className={cn("whitespace-nowrap", up ? "text-admin-error" : down ? "text-admin-success" : undefined)}>
          {changeSinceOpen(instrument)}
        </span>
      );
    case "sold":
      return instrument.unitsSold.toFixed(0);
    case "range":
      return instrument.highPrice == null || instrument.lowPrice == null ? (
        "—"
      ) : (
        <span className="whitespace-nowrap">
          {formatGbp(instrument.highPrice)} / {formatGbp(instrument.lowPrice)}
        </span>
      );
    case "tierChanges":
      return String(instrument.tierChanges);
    case "priceChanges":
      return String(instrument.priceChanges);
    default:
      return null;
  }
}

const OVERRIDE_HELP =
  "Tell the market what the stock really is when Square is wrong or the drink isn't linked. Auto follows Square. Sold out freezes the price that tick and hides the drink from the deals; the rank and tier are untouched, since ranking only looks at sales. Running low just shows the badge and sends the alert. Any choice holds until you set it back to Auto, so remember to.";

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
    <Tooltip>
      <TooltipTrigger asChild>
        <select
          aria-label={`Stock override for ${instrument.name}`}
          value={instrument.stockOverride ?? "auto"}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 cursor-pointer rounded-lg border border-admin-line bg-transparent pr-1 pl-2 text-[12px] font-semibold text-admin-primary outline-none transition-colors hover:bg-admin-primary-soft focus-visible:ring-2 focus-visible:ring-admin-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="auto">Auto</option>
          <option value="ok">In stock</option>
          <option value="low">Running low</option>
          <option value="out">Sold out</option>
        </select>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-64 space-y-1 p-3">
        <p className="text-[12px] leading-snug font-semibold text-admin-ink">Stock override</p>
        <p className="text-[11px] leading-snug text-admin-muted">{OVERRIDE_HELP}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const SQUARE_LINK_CLASS =
  "flex min-h-11 items-center gap-1 text-[13px] font-semibold text-admin-primary hover:underline disabled:opacity-50 sm:min-h-0";

/* "Linked" opens the drink in the Square dashboard. Usually a plain anchor:
   the page resolves the parent ITEM id for every mapped drink from a cached
   pass over the catalog. A mapping saved since that pass has no id yet, so it
   falls back to looking the item up on click - and there the tab is opened up
   front and pointed at the item once Square answers, because opening it after
   the await would be treated as a pop-up. */
function SquareItemLink({
  instrument,
  environment,
}: {
  instrument: InstrumentSummary;
  environment: "sandbox" | "production";
}) {
  const [loading, setLoading] = useState(false);

  if (!instrument.mapped) return <span className="text-admin-warning">Not linked</span>;

  if (instrument.squareItemId) {
    return (
      <a
        href={squareItemUrl(environment, instrument.squareItemId)}
        target="_blank"
        rel="noreferrer"
        title={`Open ${instrument.name} in the Square dashboard`}
        className={SQUARE_LINK_CLASS}
      >
        Linked
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    );
  }

  async function open() {
    const tab = window.open("about:blank", "_blank", "noopener,noreferrer");
    setLoading(true);
    const result = await squareItemLinkAction(instrument.id);
    setLoading(false);
    if ("error" in result && result.error) {
      tab?.close();
      toast.error(result.error);
      return;
    }
    if (!("url" in result) || !result.url) return;
    if (tab) tab.location.href = result.url;
    else window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      title={`Open ${instrument.name} in the Square dashboard`}
      className={SQUARE_LINK_CLASS}
    >
      Linked
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

const ROW_ACTION =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function stockLabel(state: StockState, qty: number | null): { label: string; className: string } {
  const count = qty == null ? "" : ` · ${Math.max(0, Math.round(qty))} left`;
  if (state === "out") return { label: `Sold out${count}`, className: "bg-admin-error-bg text-admin-error" };
  if (state === "low") return { label: `Running low${count}`, className: "bg-admin-warning-bg text-admin-warning" };
  return { label: `In stock${count}`, className: "bg-admin-success-bg text-admin-success" };
}

/* The one card that matters while a market trades: which event is live,
   the controls for it, and every drink on its board moving with the ticks.
   Ticks arrive through the polled state and are laid over the server props,
   so nothing else on the page re-renders for them. */
export function LiveFloorCard({
  session,
  instruments: initialInstruments,
  liveEvent,
  squareSim,
  onOpenSettings,
}: {
  session: SessionSummary;
  instruments: InstrumentSummary[];
  liveEvent: { id: number; name: string } | null;
  squareSim: SquareSimSummary;
  onOpenSettings?: () => void;
}) {
  const router = useRouter();
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [floorOpen, setFloorOpen] = useState(true);
  const [simOpen, setSimOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [priceEdit, setPriceEdit] = useState<{ instrumentId: number; value: string } | null>(null);
  const [sort, setSort] = useState<Sort | null>(null);
  const [breakdownFor, setBreakdownFor] = useState<InstrumentSummary | null>(null);
  const [query, setQuery] = useState("");

  const liveState = useLiveTick(true, router.refresh);
  const instruments = mergeLiveInstruments(initialInstruments, liveState, session.id, session.tickNo);
  const nextTickCountdown = useCountdown(liveState?.nextTickInSec);
  const tiersLive = session.config.pricingMode === "tiers";
  const warmedUp = liveState?.warmedUp ?? true;
  const tickNo = liveState?.status === "live" ? (liveState.tickNo ?? session.tickNo) : session.tickNo;
  const floorFields = FLOOR_FIELDS.filter((field) => tiersLive || !field.tiersOnly);
  const floorColumns = floorFields.filter((field) => !field.detail);
  const byKey = new Map(floorFields.map((field) => [field.key, field]));
  const pick = (keys: string[]) => keys.map((key) => byKey.get(key)).filter((field): field is FloorField => Boolean(field));
  const chainFields = pick(tiersLive ? CHAIN_KEYS : ["base", "demand", "now", "change"]);
  const tonightFields = pick(TONIGHT_KEYS);
  const moreFields = pick(MORE_KEYS);
  const needle = query.trim().toLowerCase();
  const shown = sortInstruments(
    needle ? instruments.filter((instrument) => searchText(instrument, warmedUp).includes(needle)) : instruments,
    sort
  );
  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current?.key !== key ? { key, dir: "asc" } : current.dir === "asc" ? { key, dir: "desc" } : null
    );

  const tools = useSimTools({
    session,
    instruments,
    squareSim,
    confirm,
    startTransition,
    refresh: router.refresh,
  });

  function toggleExpanded(id: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  async function handleEnd() {
    const confirmed = await confirm({
      title: "Close the market?",
      description:
        "Trading stops, the board shows closed, and every linked drink goes back to its normal price on the till.",
      confirmLabel: "Close market",
    });
    if (confirmed) run(endMarketAction, "Market closed - till prices restored.");
  }

  async function handleCrash() {
    const confirmed = await confirm({
      title: "Crash the market?",
      description: "Every price tumbles toward the crash floor for the next few ticks.",
      confirmLabel: "Crash it",
    });
    if (confirmed) run(crashMarketAction, "Crash triggered - watch the board.");
  }

  function handleRerank() {
    run(rerankNowAction, warmedUp ? "Re-ranked - tiers updated." : "Warm-up skipped - tiers are on.");
  }

  function handleSetPrice() {
    if (!priceEdit) return;
    const price = Number(priceEdit.value);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a price above zero.");
      return;
    }
    const { instrumentId } = priceEdit;
    setPriceEdit(null);
    run(() => setInstrumentPriceAction(instrumentId, price), "Price set - it shows on the board from the next tick.");
  }

  async function handleCrashDrink(instrument: InstrumentSummary) {
    const confirmed = await confirm({
      title: `Crash ${instrument.name}?`,
      description:
        "This drink's price tumbles toward its crash price for the next few ticks. Everything else keeps trading normally.",
      confirmLabel: "Crash it",
    });
    if (confirmed) run(() => crashInstrumentAction(instrument.id), `${instrument.name} is crashing - watch the board.`);
  }

  return (
    <section className={cn(CARD, "border-admin-success/40")}>
      {ConfirmDialogUI}
      <TickBreakdownSheet instrument={breakdownFor} config={session.config} onClose={() => setBreakdownFor(null)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-admin-success opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-admin-success" />
            </span>
            <h2 className="truncate text-base leading-tight font-bold text-admin-ink sm:text-lg">
              Live now{liveEvent ? ` · ${liveEvent.name}` : ""}
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-admin-muted tabular-nums">
            {instruments.length} {instruments.length === 1 ? "drink" : "drinks"} trading · Tick {tickNo} · next in{" "}
            {nextTickCountdown}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {liveEvent && (
            <Link
              href={`/settings/market/${liveEvent.id}`}
              className="flex min-h-11 items-center gap-1 text-[12px] font-semibold text-admin-primary hover:underline"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              Drinks and prices
            </Link>
          )}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex min-h-11 items-center gap-1 text-[12px] font-semibold text-admin-primary hover:underline"
            >
              Event settings
            </button>
          )}
          <Link
            href="/settings/market/how-it-works"
            className="flex min-h-11 items-center gap-1 text-[12px] font-semibold text-admin-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            How pricing works
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap">
        <button
          type="button"
          onClick={handleEnd}
          disabled={isPending}
          className={cn(PRIMARY_BUTTON, "bg-admin-error hover:bg-admin-error/90 max-sm:flex-1")}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          )}
          Close market
        </button>
        <a
          href="/market/board"
          target="_blank"
          rel="noreferrer"
          className={cn(
            NEUTRAL_BUTTON,
            "border-admin-info/40 bg-admin-info-bg text-admin-info hover:bg-admin-info/15 max-sm:flex-1"
          )}
        >
          <MonitorPlay className="h-4 w-4" aria-hidden="true" />
          Big screen
        </a>
        {tiersLive && (
          <button
            type="button"
            onClick={handleRerank}
            disabled={isPending}
            title={
              warmedUp
                ? "Re-rank now"
                : `Skip warm-up (${liveState?.unitsSoldTotal ?? 0} of ${session.config.warmupUnits} units sold)`
            }
            className={cn(NEUTRAL_BUTTON, "max-sm:flex-1")}
          >
            <ListOrdered className="h-4 w-4" aria-hidden="true" />
            {warmedUp ? "Re-rank now" : "Skip warm-up"}
          </button>
        )}
        <button
          type="button"
          onClick={handleCrash}
          disabled={isPending}
          className={cn(
            NEUTRAL_BUTTON,
            "border-admin-warning/40 bg-admin-warning-bg text-admin-warning hover:bg-admin-warning/15 max-sm:flex-1"
          )}
        >
          <TrendingDown className="h-4 w-4" aria-hidden="true" />
          Crash market
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFloorOpen((open) => !open)}
        aria-expanded={floorOpen}
        className="mt-4 flex min-h-11 w-full items-center gap-2 border-t border-admin-line pt-3 text-left"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200",
            !floorOpen && "-rotate-90"
          )}
          aria-hidden="true"
        />
        <span className="text-sm font-bold text-admin-ink">Trading floor</span>
      </button>

      {floorOpen && (
        <div className="mt-2">
          <SimPanel
            open={simOpen}
            onToggle={() => setSimOpen((open) => !open)}
            tools={tools}
            instruments={instruments}
            squareSim={squareSim}
            isPending={isPending}
          />

          {tiersLive && !warmedUp && (
            <p className="mb-2 text-[11px] text-admin-muted">
              Warming up · {liveState?.unitsSoldTotal ?? 0} of {session.config.warmupUnits} drinks sold before tiers start.
              Rank, tier and target fill in once the bar reaches that number.
            </p>
          )}
          <div className="mb-2 flex items-center gap-2">
            <div className="min-w-0 flex-1 sm:max-w-sm">
              <ListSearchInput
                value={query}
                onChange={setQuery}
                label="Search the trading floor"
                placeholder="Search drinks, prices, rank, tier or stock"
              />
            </div>
            {needle && (
              <span className="text-[11px] text-admin-muted tabular-nums">
                {shown.length} of {instruments.length}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <TooltipProvider>
              <table className={cn("w-full text-left", tiersLive ? "min-w-160" : "min-w-125")}>
                <thead>
                  <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                    {floorColumns.map((field) => (
                      <FloorHeading
                        key={field.key}
                        field={field}
                        sort={sort}
                        onSort={toggleSort}
                        className={field.key === "stock" && !simOpen ? "pr-0" : undefined}
                      />
                    ))}
                    {simOpen && <FloorHeading field={SELL_STOCK_HEADING} />}
                    <FloorHeading field={ACTIONS_HEADING} className="pr-0" />
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={floorColumns.length + (simOpen ? 2 : 1)} className="py-8 text-center text-[13px] text-admin-muted">
                        Nothing on the floor matches &ldquo;{query.trim()}&rdquo;
                      </td>
                    </tr>
                  )}
                  {shown.map((instrument) => {
                    const stock = stockLabel(instrument.stockState, instrument.stockQty);
                    const up = instrument.currentPrice > instrument.openingPrice;
                    const down = instrument.currentPrice < instrument.openingPrice;
                    const total = instruments.length;
                    const expanded = expandedIds.has(instrument.id);
                    const editing = priceEdit?.instrumentId === instrument.id;
                    const columnCount = floorColumns.length + (simOpen ? 2 : 1);
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
                                <span className="block text-[13px] font-semibold text-admin-ink">
                                  {instrument.name}
                                  {instrument.crashing && (
                                    <span className="ml-1.5 rounded-full bg-admin-error-bg px-2 py-0.5 text-[11px] font-semibold text-admin-error">
                                      Crashing
                                    </span>
                                  )}
                                </span>
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
                              up ? "text-admin-error" : down ? "text-admin-success" : "text-admin-ink"
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
                          {simOpen && (
                            <td className="py-2 pr-3" onClick={(event) => event.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => tools.handleSimSale(instrument, tools.unitsPerSale)}
                                  disabled={
                                    isPending ||
                                    instrument.stockState === "out" ||
                                    (tools.viaSquare && !instrument.mapped)
                                  }
                                  aria-label={`Sell ${tools.unitsPerSale} × ${instrument.name}`}
                                  title={
                                    tools.viaSquare && !instrument.mapped
                                      ? "Link this drink to Square first, or seed a temporary item for it"
                                      : tools.viaSquare
                                        ? `Ring ${tools.unitsPerSale} × ${instrument.name} through the Square sandbox`
                                        : `Sell ${tools.unitsPerSale} × ${instrument.name}`
                                  }
                                  className={cn(ROW_ACTION, "border-admin-line text-admin-primary hover:bg-admin-primary-soft")}
                                >
                                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => tools.handleAddStock(instrument)}
                                  disabled={isPending || !instrument.mapped}
                                  aria-label={`Add ${tools.stockToAdd} stock for ${instrument.name}`}
                                  title={
                                    !instrument.mapped
                                      ? "Link this drink to Square first"
                                      : `Add ${tools.stockToAdd} to Square inventory for ${instrument.name}`
                                  }
                                  className={cn(ROW_ACTION, "border-admin-line text-admin-primary hover:bg-admin-primary-soft")}
                                >
                                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
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
                          <td className="py-2 text-right" onClick={(event) => event.stopPropagation()}>
                            <span className="inline-flex items-center justify-end gap-1.5">
                              <StockSelect
                                instrument={instrument}
                                disabled={isPending}
                                onChange={(value) => run(() => setStockOverrideAction(instrument.id, value))}
                              />
                              {editing ? (
                                <>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.05"
                                    min="0"
                                    autoFocus
                                    aria-label={`New price for ${instrument.name}`}
                                    value={priceEdit.value}
                                    disabled={isPending}
                                    onChange={(event) =>
                                      setPriceEdit({ instrumentId: instrument.id, value: event.target.value })
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        handleSetPrice();
                                      }
                                      if (event.key === "Escape") setPriceEdit(null);
                                    }}
                                    className="h-9 w-20 rounded-lg border border-admin-line bg-admin-card px-2 text-right text-[13px] font-semibold text-admin-ink tabular-nums outline-none focus:border-admin-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Save price for ${instrument.name}`}
                                    title="Save price"
                                    disabled={isPending}
                                    onClick={handleSetPrice}
                                    className={cn(ROW_ACTION, "border-admin-primary bg-admin-primary text-white hover:bg-admin-primary-hover")}
                                  >
                                    <Check className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Cancel price change"
                                    title="Cancel"
                                    onClick={() => setPriceEdit(null)}
                                    className={cn(ROW_ACTION, "border-admin-line text-admin-muted hover:bg-admin-surface")}
                                  >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        aria-label={`Set price for ${instrument.name}`}
                                        disabled={isPending || instrument.stockState === "out"}
                                        onClick={() =>
                                          setPriceEdit({ instrumentId: instrument.id, value: instrument.currentPrice.toFixed(2) })
                                        }
                                        className={cn(ROW_ACTION, "border-admin-line text-admin-primary hover:bg-admin-primary-soft")}
                                      >
                                        <PoundSterling className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="end" className="max-w-64 space-y-1 p-3">
                                      <p className="text-[12px] leading-snug font-semibold text-admin-ink">Set price now</p>
                                      <p className="text-[11px] leading-snug text-admin-muted">
                                        Put a price on the board this moment, held within the drink&apos;s floor and
                                        ceiling and rounded to the step. The till gets it next tick. Rank, tier and
                                        Target don&apos;t change, so the price glides back toward Target over the
                                        next few ticks: a nudge, not a lock. To hold a price, lower the base, edit the
                                        limits, or mark it sold out. A big enough drop alerts guests watching it.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <button
                                    type="button"
                                    aria-label={`Crash ${instrument.name}`}
                                    title="Crash this drink"
                                    disabled={isPending || instrument.crashing || instrument.stockState === "out"}
                                    onClick={() => handleCrashDrink(instrument)}
                                    className={cn(ROW_ACTION, "border-admin-warning/40 bg-admin-warning-bg text-admin-warning hover:bg-admin-warning/15")}
                                  >
                                    <TrendingDown className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-admin-line/60 bg-admin-surface/40">
                            <td colSpan={columnCount} className="px-3 pt-1 pb-3">
                              <div
                                className="grid gap-3 rounded-xl border border-admin-line bg-admin-card p-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DetailGroup
                                  title="How the price is worked out"
                                  blurb={
                                    tiersLive
                                      ? "Left to right: what it normally sells, what it is selling now, how that ranks, and where the price sits."
                                      : "Left to right: the menu price, what is selling now, and the price on the board."
                                  }
                                  className="lg:col-span-2"
                                >
                                  <ol className="no-scrollbar m-0 flex list-none items-stretch overflow-x-auto p-0">
                                    {chainFields.map((field, index) => (
                                      <li key={field.key} className="flex shrink-0 items-center">
                                        {index > 0 && (
                                          <ChevronRight className="mx-1.5 h-4 w-4 shrink-0 text-admin-line" aria-hidden="true" />
                                        )}
                                        <DetailCell field={field}>
                                          {field.key === "now" ? (
                                            <span className={cn(up ? "text-admin-error" : down ? "text-admin-success" : undefined)}>
                                              {formatGbp(instrument.currentPrice)}
                                            </span>
                                          ) : (
                                            detailValue(field, instrument, warmedUp)
                                          )}
                                        </DetailCell>
                                      </li>
                                    ))}
                                  </ol>
                                </DetailGroup>
                                <DetailGroup title="Tonight so far" blurb="Since the market opened.">
                                  <dl className="m-0 flex flex-wrap gap-x-6 gap-y-3">
                                    {tonightFields.map((field) => (
                                      <DetailCell key={field.key} field={field}>
                                        {detailValue(field, instrument, warmedUp)}
                                      </DetailCell>
                                    ))}
                                  </dl>
                                </DetailGroup>
                                <DetailGroup title="Dig deeper" blurb="The till item and every tick behind these numbers.">
                                  <dl className="m-0 flex flex-wrap gap-x-6 gap-y-3">
                                    {moreFields.map((field) => (
                                      <DetailCell key={field.key} field={field}>
                                        {field.key === "link" ? (
                                          <SquareItemLink instrument={instrument} environment={squareSim.environment} />
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setBreakdownFor(instrument)}
                                            className={SQUARE_LINK_CLASS}
                                          >
                                            Show ticks
                                            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                                          </button>
                                        )}
                                      </DetailCell>
                                    ))}
                                  </dl>
                                </DetailGroup>
                              </div>
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
        </div>
      )}
    </section>
  );
}
