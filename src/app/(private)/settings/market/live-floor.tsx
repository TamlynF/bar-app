"use client";

import { Fragment, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  ListOrdered,
  Loader2,
  MonitorPlay,
  PackagePlus,
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
    label: "Stock override",
    detail: true,
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
    help: "Whether this serve is linked to a Square catalog item. Only linked serves pick up real till sales and push their market price back to the till. Click Linked to open the item in the Square dashboard.",
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
    default:
      return null;
  }
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

  const liveState = useLiveTick(true, router.refresh);
  const instruments = mergeLiveInstruments(initialInstruments, liveState, session.id, session.tickNo);
  const nextTickCountdown = useCountdown(liveState?.nextTickInSec);
  const tiersLive = session.config.pricingMode === "tiers";
  const warmedUp = liveState?.warmedUp ?? true;
  const tickNo = liveState?.status === "live" ? (liveState.tickNo ?? session.tickNo) : session.tickNo;
  const floorFields = FLOOR_FIELDS.filter((field) => tiersLive || !field.tiersOnly);
  const floorColumns = floorFields.filter((field) => !field.detail);
  const detailFields = floorFields.filter((field) => field.detail);

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
          <div className="overflow-x-auto">
            <TooltipProvider>
              <table className={cn("w-full text-left", tiersLive ? "min-w-160" : "min-w-125")}>
                <thead>
                  <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                    {floorColumns.map((field) => (
                      <FloorHeading
                        key={field.key}
                        field={field}
                        className={field.key === "stock" && !simOpen ? "pr-0" : undefined}
                      />
                    ))}
                    {simOpen && <th className="py-2 pr-3">Sell / stock</th>}
                    <th className="py-2 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {instruments.map((instrument) => {
                    const stock = stockLabel(instrument.stockState, instrument.stockQty);
                    const up = instrument.currentPrice > instrument.basePrice;
                    const down = instrument.currentPrice < instrument.basePrice;
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
                          {simOpen && (
                            <td className="py-2 pr-3" onClick={(event) => event.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                {[1, 5].map((units) => (
                                  <button
                                    key={units}
                                    type="button"
                                    onClick={() => tools.handleSimSale(instrument, units)}
                                    disabled={
                                      isPending ||
                                      instrument.stockState === "out" ||
                                      (tools.viaSquare && !instrument.mapped)
                                    }
                                    title={
                                      tools.viaSquare && !instrument.mapped
                                        ? "Link this drink to Square first, or seed a temporary item for it"
                                        : tools.viaSquare
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
                                  onClick={() => tools.handleAddStock(instrument)}
                                  disabled={isPending || !instrument.mapped}
                                  aria-label={`Add ${tools.stockToAdd} stock for ${instrument.name}`}
                                  title={
                                    !instrument.mapped
                                      ? "Link this drink to Square first"
                                      : `Add ${tools.stockToAdd} to Square inventory for ${instrument.name}`
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
                          <td className="py-2 text-right" onClick={(event) => event.stopPropagation()}>
                            <span className="inline-flex items-center justify-end gap-1.5">
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
                                  <button
                                    type="button"
                                    aria-label={`Set price for ${instrument.name}`}
                                    title="Set price now"
                                    disabled={isPending || instrument.stockState === "out"}
                                    onClick={() =>
                                      setPriceEdit({ instrumentId: instrument.id, value: instrument.currentPrice.toFixed(2) })
                                    }
                                    className={cn(ROW_ACTION, "border-admin-line text-admin-primary hover:bg-admin-primary-soft")}
                                  >
                                    <PoundSterling className="h-4 w-4" aria-hidden="true" />
                                  </button>
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
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-admin-line bg-admin-card p-3 sm:grid-cols-4 lg:grid-cols-7">
                                {detailFields.map((field) => (
                                  <div
                                    key={field.key}
                                    className="min-w-0"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <dt className="text-[11px] font-semibold text-admin-muted">
                                      <FieldTip field={field} align="start" />
                                    </dt>
                                    <dd className="mt-0.5 text-[13px] font-semibold text-admin-ink tabular-nums">
                                      {field.key === "override" ? (
                                        <StockSelect
                                          instrument={instrument}
                                          disabled={isPending}
                                          onChange={(value) =>
                                            run(() => setStockOverrideAction(instrument.id, value))
                                          }
                                        />
                                      ) : field.key === "link" ? (
                                        <SquareItemLink
                                          instrument={instrument}
                                          environment={squareSim.environment}
                                        />
                                      ) : (
                                        detailValue(field, instrument, warmedUp)
                                      )}
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
        </div>
      )}
    </section>
  );
}
