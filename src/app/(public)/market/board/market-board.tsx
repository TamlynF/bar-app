"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { formatGbp } from "@/lib/price";
import type { MarketInstrumentPayload } from "@/lib/market/tick";
import { useMarketState } from "../use-market-state";
import { FlipPrice, eventCopy, formatChangePct, formatDisplayPrice } from "../market-ui";
import type { MarketStatePayload } from "@/lib/market/tick";

export type BoardView = "categories" | "table" | "movers" | "leaderboard";

type Trend = "up" | "down" | "flat";

const VIEW_CYCLE: Record<BoardView, BoardView> = {
  leaderboard: "categories",
  categories: "table",
  table: "movers",
  movers: "leaderboard",
};

const VIEW_TOGGLE_LABEL: Record<BoardView, string> = {
  leaderboard: "Category view",
  categories: "Table view",
  table: "Movers view",
  movers: "Leaderboard view",
};

const UNCATEGORISED = "The Bar";

/* A falling price is good news for the punter, so drops are green and rises
   are red - the opposite of a share-price board. */
const DOWN_TEXT = "text-[#8CFF6A]";
const UP_TEXT = "text-[#FF4D6D]";

function trendOf(changePct: number): Trend {
  if (changePct > 0.5) return "up";
  if (changePct < -0.5) return "down";
  return "flat";
}

function isAtFloor(instrument: MarketInstrumentPayload): boolean {
  return instrument.price <= instrument.floor + 0.001;
}

function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function byCategoryThenName(a: MarketInstrumentPayload, b: MarketInstrumentPayload): number {
  if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
  const categoryCompare = (a.category ?? "").localeCompare(b.category ?? "");
  if (categoryCompare !== 0) return categoryCompare;
  return a.name.localeCompare(b.name);
}

function byChangeDesc(a: MarketInstrumentPayload, b: MarketInstrumentPayload): number {
  if (a.changePct !== b.changePct) return b.changePct - a.changePct;
  return a.name.localeCompare(b.name);
}

function OpenCell({
  instrument,
  size = "text-[1.35vw]",
  align = "text-right",
}: {
  instrument: MarketInstrumentPayload;
  size?: string;
  align?: string;
}) {
  return (
    <span className={`block font-board-mono ${size} leading-none ${align} text-[#a9ae8d] tabular-nums`}>
      {formatGbp(instrument.openingPrice)}
    </span>
  );
}

function NameCell({
  instrument,
  chevron,
  size = "text-[1.5vw]",
  flip = false,
  showServe = true,
}: {
  instrument: MarketInstrumentPayload;
  chevron?: ReactNode;
  size?: string;
  flip?: boolean;
  showServe?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={`truncate ${size} font-medium text-[#f3f0dc]`}>
        {chevron}
        {flip ? <FlipPrice value={instrument.name} /> : instrument.name}
      </p>
      {instrument.stock === "out" ? (
        <p className={`text-[0.8vw] tracking-[0.1em] ${UP_TEXT} uppercase`}>sold out</p>
      ) : (
        showServe && instrument.serve !== "each" && <p className="text-[0.8vw] text-[#a9ae8d]">{instrument.serve}</p>
      )}
    </div>
  );
}

function PriceCell({
  instrument,
  trend,
  atFloor,
  crash,
  size = "text-[3vw]",
  align = "text-right",
}: {
  instrument: MarketInstrumentPayload;
  trend: Trend;
  atFloor: boolean;
  crash: boolean;
  size?: string;
  align?: string;
}) {
  const colour = crash
    ? "text-white"
    : atFloor
      ? "text-[#FDCC4B]"
      : trend === "up"
        ? UP_TEXT
        : trend === "down"
          ? DOWN_TEXT
          : "text-[#f3f0dc]";
  return (
    <FlipPrice
      value={formatDisplayPrice(instrument)}
      className={`block font-board-display ${size} leading-none ${align} ${colour}`}
    />
  );
}

function ChangePill({
  changePct,
  trend,
  atFloor,
  crash,
}: {
  changePct: number;
  trend: Trend;
  atFloor: boolean;
  crash: boolean;
}) {
  const base =
    "justify-self-end rounded-[0.3vw] px-[0.5vw] py-[0.25vw] text-[1.05vw] font-semibold whitespace-nowrap text-right";
  if (crash) return <span className={`${base} bg-[#ff2e4c] text-white`}>FLOOR</span>;
  if (atFloor) return <span className={`${base} bg-[#FDCC4B] text-[#1a2008]`}>FLOOR</span>;
  if (trend === "up") {
    return (
      <FlipPrice value={`▲ ${formatChangePct(changePct)}`} className={`${base} bg-[#FF4D6D]/[.12] ${UP_TEXT}`} />
    );
  }
  if (trend === "down") {
    return (
      <FlipPrice value={`▼ ${formatChangePct(changePct)}`} className={`${base} bg-[#8CFF6A]/10 ${DOWN_TEXT}`} />
    );
  }
  return <span className={`${base} bg-white/5 text-[#a9ae8d]`}>- 0.0%</span>;
}

const CATEGORY_COLUMNS = "grid grid-cols-[1.2fr_6.5vw_9vw_6vw] items-center gap-[1vw]";

function CategoryRow({
  instrument,
  crash,
}: {
  instrument: MarketInstrumentPayload;
  crash: boolean;
}) {
  const trend = trendOf(instrument.changePct);
  const atFloor = isAtFloor(instrument);
  return (
    <div className={`${CATEGORY_COLUMNS} border-t border-[#3a4520] py-[0.55vw]`}>
      <NameCell instrument={instrument} />
      <OpenCell instrument={instrument} />
      <PriceCell instrument={instrument} trend={trend} atFloor={atFloor} crash={crash} />
      <ChangePill changePct={instrument.changePct} trend={trend} atFloor={atFloor} crash={crash} />
    </div>
  );
}

type CategorySection = {
  name: string;
  order: number;
  instruments: MarketInstrumentPayload[];
};

function groupByCategory(instruments: MarketInstrumentPayload[]): CategorySection[] {
  const sections = new Map<string, CategorySection>();
  for (const instrument of instruments) {
    const name = instrument.category ?? UNCATEGORISED;
    const section = sections.get(name) ?? {
      name,
      order: instrument.categoryOrder,
      instruments: [],
    };
    section.instruments.push(instrument);
    sections.set(name, section);
  }
  return [...sections.values()].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name)
  );
}

function hottestName(instruments: MarketInstrumentPayload[]): string | null {
  const hottest = instruments.reduce((best, candidate) =>
    candidate.demandUnits > best.demandUnits ? candidate : best
  );
  return hottest.demandUnits > 0 ? hottest.name : null;
}

function CategoriesView({
  instruments,
  crash,
}: {
  instruments: MarketInstrumentPayload[];
  crash: boolean;
}) {
  const sections = groupByCategory(instruments);
  return (
    <div className="grid grid-cols-2 content-start gap-x-[3vw] overflow-hidden">
      {sections.map((section) => {
        const hot = hottestName(section.instruments);
        return (
          <section key={section.name}>
            <h2
              className={`mt-[0.9vw] mb-[0.3vw] flex items-baseline justify-between font-board-display text-[1.7vw] tracking-[0.14em] ${
                crash ? "text-white" : "text-[#FDCC4B]"
              }`}
            >
              <span>{section.name}</span>
              {hot && (
                <span className="font-board-mono text-[0.85vw] tracking-[0.1em] text-[#a9ae8d]">
                  hot: {hot}
                </span>
              )}
            </h2>
            <div
              className={`${CATEGORY_COLUMNS} pb-[0.2vw] text-[0.75vw] tracking-[0.18em] text-[#a9ae8d] uppercase`}
            >
              <span />
              <span className="text-right">Open</span>
              <span className="text-right">Now</span>
              <span className="text-right">Change</span>
            </div>
            {section.instruments.map((instrument) => (
              <CategoryRow key={instrument.id} instrument={instrument} crash={crash} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

const FLAT_COLUMNS = "grid grid-cols-[1.4fr_8vw_6.5vw_9vw_6vw] items-center gap-[1vw]";

function FlatHeader({ firstColumn }: { firstColumn: string }) {
  return (
    <div
      className={`${FLAT_COLUMNS} border-b border-[#3a4520] pb-[0.3vw] text-[0.85vw] tracking-[0.18em] text-[#a9ae8d] uppercase`}
    >
      <span>{firstColumn}</span>
      <span>Category</span>
      <span className="text-right">Open</span>
      <span className="text-right">Now</span>
      <span className="text-right">Change</span>
    </div>
  );
}

function FlatRow({
  instrument,
  crash,
  chevron,
}: {
  instrument: MarketInstrumentPayload;
  crash: boolean;
  chevron?: ReactNode;
}) {
  const trend = trendOf(instrument.changePct);
  const atFloor = isAtFloor(instrument);
  return (
    <div className={`${FLAT_COLUMNS} border-t border-[#3a4520] py-[0.45vw]`}>
      <NameCell instrument={instrument} chevron={chevron} />
      <span className="truncate text-[0.95vw] text-[#a9ae8d]">{instrument.category ?? "-"}</span>
      <OpenCell instrument={instrument} />
      <PriceCell instrument={instrument} trend={trend} atFloor={atFloor} crash={crash} />
      <ChangePill changePct={instrument.changePct} trend={trend} atFloor={atFloor} crash={crash} />
    </div>
  );
}

function TableView({
  instruments,
  crash,
}: {
  instruments: MarketInstrumentPayload[];
  crash: boolean;
}) {
  const sorted = [...instruments].sort(byCategoryThenName);
  return (
    <div className="overflow-hidden">
      <FlatHeader firstColumn="Drink" />
      {sorted.map((instrument) => (
        <FlatRow key={instrument.id} instrument={instrument} crash={crash} />
      ))}
    </div>
  );
}

type RankSnapshot = {
  key: string;
  previous: Map<number, number> | null;
  current: Map<number, number>;
};

function rankMap(sorted: MarketInstrumentPayload[]): Map<number, number> {
  return new Map(sorted.map((instrument, index) => [instrument.id, index]));
}

function RankChevron({ delta }: { delta: number }) {
  if (delta === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={`mr-[0.4vw] text-[0.9vw] ${delta < 0 ? UP_TEXT : DOWN_TEXT}`}
    >
      {delta < 0 ? "▲" : "▼"}
    </span>
  );
}

function MoversView({
  instruments,
  crash,
}: {
  instruments: MarketInstrumentPayload[];
  crash: boolean;
}) {
  const sorted = [...instruments].sort(byChangeDesc);
  const orderKey = sorted.map((instrument) => instrument.id).join(",");
  const [ranks, setRanks] = useState<RankSnapshot>(() => ({
    key: orderKey,
    previous: null,
    current: rankMap(sorted),
  }));
  if (ranks.key !== orderKey) {
    setRanks({ key: orderKey, previous: ranks.current, current: rankMap(sorted) });
  }

  return (
    <div className="overflow-hidden">
      <FlatHeader firstColumn="Mover" />
      {sorted.map((instrument, index) => {
        const previousRank = ranks.previous?.get(instrument.id);
        const delta = previousRank == null ? 0 : index - previousRank;
        return (
          <FlatRow
            key={instrument.id}
            instrument={instrument}
            crash={crash}
            chevron={<RankChevron delta={delta} />}
          />
        );
      })}
    </div>
  );
}

const BOARD_COLUMNS = "grid grid-cols-[2vw_1fr_6vw_8vw_7vw] items-center gap-[0.8vw]";
const LEADERBOARD_MIN = 5;
const LEADERBOARD_MAX = 15;

type LeaderboardRow = { instrument: MarketInstrumentPayload; rank: number };
type LeaderboardGroup = { category: string; rows: LeaderboardRow[] };

/* The top N in ranking order, then regrouped under their category headers in
   the order the categories first appear in that ranking - so "Draught" with
   two pints, then "Bottled selection" with one, then "Classic cocktails" with
   two, each drink keeping its overall rank number. */
function groupLeaderboard(ranked: MarketInstrumentPayload[], limit: number): LeaderboardGroup[] {
  const groups: LeaderboardGroup[] = [];
  ranked.slice(0, limit).forEach((instrument, index) => {
    const category = instrument.category ?? UNCATEGORISED;
    let group = groups.find((g) => g.category === category);
    if (!group) {
      group = { category, rows: [] };
      groups.push(group);
    }
    group.rows.push({ instrument, rank: index + 1 });
  });
  return groups;
}

type ColumnMetrics = { available: number; row: number; group: number };

/* How many ranked drinks fit in the column once their category headers are
   counted - a bigger or taller screen shows a longer list, a 16:9 TV about
   five to eight. Never fewer than five. */
function rowsThatFit(ranked: MarketInstrumentPayload[], metrics: ColumnMetrics | null): number {
  if (!metrics || metrics.row <= 0) return LEADERBOARD_MIN;
  for (let n = Math.min(LEADERBOARD_MAX, ranked.length); n > LEADERBOARD_MIN; n--) {
    const groups = groupLeaderboard(ranked, n).length;
    if (groups * metrics.group + n * metrics.row <= metrics.available) return n;
  }
  return LEADERBOARD_MIN;
}

function tallest(elements: NodeListOf<HTMLElement>): number {
  let max = 0;
  elements.forEach((el) => {
    max = Math.max(max, el.offsetHeight);
  });
  return max;
}

/* Sized from the tallest row and header on screen, so a "sold out" line or
   a wrapped name cannot push the last drink below the fold. */
function measureColumn(column: HTMLElement | null): ColumnMetrics | null {
  if (!column) return null;
  const head = column.querySelector<HTMLElement>("[data-board-head]");
  const rows = column.querySelectorAll<HTMLElement>("[data-board-row]");
  const groups = column.querySelectorAll<HTMLElement>("[data-board-group]");
  if (!head || rows.length === 0 || groups.length === 0) return null;
  return {
    available: column.clientHeight - head.offsetHeight,
    row: tallest(rows),
    group: tallest(groups),
  };
}

function LeaderboardColumn({
  title,
  subtitle,
  shown,
  arrow,
  accent,
  accentBg,
  accentBand,
  ranked,
  limit,
  crash,
  columnRef,
}: {
  title: string;
  subtitle: string;
  shown: number;
  arrow: string;
  accent: string;
  accentBg: string;
  accentBand: string;
  ranked: MarketInstrumentPayload[];
  limit: number;
  crash: boolean;
  columnRef: RefObject<HTMLDivElement | null>;
}) {
  const groups = groupLeaderboard(ranked, limit);
  return (
    <div ref={columnRef} className="min-h-0 min-w-0 overflow-hidden">
      <div data-board-head>
        <div
          className={`flex items-center justify-between gap-[1vw] rounded-[0.4vw] border-l-[0.3vw] px-[1vw] py-[0.55vw] ${
            crash ? "border-white bg-white/10" : accentBand
          }`}
        >
          <p className={`shrink-0 font-board-display text-[2.1vw] leading-none tracking-[0.1em] ${crash ? "text-white" : accent}`}>
            {arrow} {title}
          </p>
          <p className="flex min-w-0 items-center gap-[0.6vw] text-[0.95vw] leading-tight text-[#f3f0dc]">
            <span
              className={`shrink-0 rounded-[0.25vw] px-[0.5vw] py-[0.25vw] font-board-display text-[1.05vw] tracking-[0.12em] ${
                crash ? "bg-white text-[#7a0f1e]" : `${accentBg} text-[#1a2008]`
              }`}
            >
              TOP {shown}
            </span>
            <span className="truncate">{subtitle}</span>
          </p>
        </div>
        <div className={`${BOARD_COLUMNS} mt-[0.9vw] border-b border-[#3a4520] pb-[0.35vw] text-[0.75vw] tracking-[0.18em] text-[#a9ae8d] uppercase`}>
          <span />
          <span>Drink</span>
          <span className="text-center">Menu price</span>
          <span className="text-center">Now</span>
          <span className="text-right">Change</span>
        </div>
      </div>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          <p
            data-board-group
            className={`pt-[0.7vw] pb-[0.2vw] font-board-display text-[1.25vw] tracking-[0.14em] ${crash ? "text-white" : "text-[#FDCC4B]"}`}
          >
            <FlipPrice value={group.category} />
          </p>
          {group.rows.map(({ instrument, rank }) => {
            const trend = trendOf(instrument.changePct);
            const atFloor = isAtFloor(instrument);
            return (
              <div key={rank} data-board-row className={`${BOARD_COLUMNS} border-t border-[#3a4520] py-[0.4vw]`}>
                <span
                  className={`grid h-[1.9vw] w-[1.9vw] place-items-center rounded-[0.3vw] font-board-display text-[1.2vw] leading-none ${
                    rank === 1 ? `${accentBg} text-[#1a2008]` : `bg-white/5 ${accent}`
                  }`}
                >
                  {rank}
                </span>
                <NameCell instrument={instrument} size="text-[1.3vw]" flip showServe={false} />
                <OpenCell instrument={instrument} size="text-[1.1vw]" align="text-center" />
                <PriceCell instrument={instrument} trend={trend} atFloor={atFloor} crash={crash} size="text-[2.3vw]" align="text-center" />
                <ChangePill changePct={instrument.changePct} trend={trend} atFloor={atFloor} crash={crash} />
              </div>
            );
          })}
        </div>
      ))}
      {groups.length === 0 && <p className="py-[1vw] text-[1vw] text-[#a9ae8d]">Nothing here yet</p>}
    </div>
  );
}

/* Deals on the left, the drinks going up on the right. Tier mode ranks by
   tier then pace (slowest vs normal = best deal), and a drink only appears
   once its price has actually crossed the menu price in its tier's direction
   - a drink just promoted to the top tier that is still gliding up from a
   discount waits off the board rather than showing as a "riser" at a lower
   price. Demand mode has no tiers, so the same layout ranks by change since
   open instead. Each column shows as many drinks as the screen has room for
   (five at least), or the event's leaderboard row count when that is set
   and fits. */
function LeaderboardView({
  instruments,
  crash,
  state,
}: {
  instruments: MarketInstrumentPayload[];
  crash: boolean;
  state: MarketStatePayload;
}) {
  const tiers = state.pricingMode === "tiers";
  const dealsRef = useRef<HTMLDivElement | null>(null);
  const risersRef = useRef<HTMLDivElement | null>(null);
  const [limit, setLimit] = useState(LEADERBOARD_MIN);

  const deals = tiers
    ? instruments
        .filter((i) => (i.tierPct ?? 0) < 0 && i.price < i.openingPrice)
        .sort((a, b) => (a.tierPct ?? 0) - (b.tierPct ?? 0) || (a.pace ?? 0) - (b.pace ?? 0))
    : [...instruments].sort(byChangeDesc).reverse();
  const risers = tiers
    ? instruments
        .filter((i) => (i.tierPct ?? 0) > 0 && i.price > i.openingPrice)
        .sort((a, b) => (b.tierPct ?? 0) - (a.tierPct ?? 0) || (b.pace ?? 0) - (a.pace ?? 0))
    : [...instruments].sort(byChangeDesc);
  const requested = state.leaderboardRows ?? 0;
  useLayoutEffect(() => {
    const fit = () => {
      const fits = Math.max(
        LEADERBOARD_MIN,
        Math.min(rowsThatFit(deals, measureColumn(dealsRef.current)), rowsThatFit(risers, measureColumn(risersRef.current)))
      );
      const next = requested > 0 ? Math.min(requested, fits) : fits;
      setLimit((current) => (current === next ? current : next));
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (dealsRef.current) observer.observe(dealsRef.current);
    if (risersRef.current) observer.observe(risersRef.current);
    return () => observer.disconnect();
  }, [deals, risers, requested]);

  if (tiers && state.warmedUp === false) {
    const sold = state.unitsSoldTotal ?? 0;
    const need = state.warmupUnits ?? 0;
    return (
      <div className="flex flex-col items-center justify-center gap-[1vw] text-center">
        <p className="font-board-display text-[7vw] leading-none text-[#FDCC4B]">MARKET WARMING UP</p>
        <p className="font-board-mono text-[1.4vw] tracking-[0.2em] text-[#f3f0dc] uppercase">
          {sold} of {need} drinks sold · prices move once the bar is busy
        </p>
      </div>
    );
  }

  const shown = Math.min(limit, Math.max(deals.length, risers.length, 1));
  return (
    <div className="grid h-full min-h-0 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-[3vw] overflow-hidden">
      <LeaderboardColumn
        title="Best deals"
        subtitle={tiers ? "slow tonight, price coming down" : "biggest drops since open"}
        shown={shown}
        arrow="▼"
        accent={DOWN_TEXT}
        accentBg="bg-[#8CFF6A]"
        accentBand="border-[#8CFF6A] bg-[#8CFF6A]/10"
        ranked={deals}
        limit={limit}
        crash={crash}
        columnRef={dealsRef}
      />
      <LeaderboardColumn
        title="Top shelf"
        subtitle={tiers ? "selling fast, price going up" : "biggest rises since open"}
        shown={shown}
        arrow="▲"
        accent={UP_TEXT}
        accentBg="bg-[#FF4D6D]"
        accentBand="border-[#FF4D6D] bg-[#FF4D6D]/10"
        ranked={risers}
        limit={limit}
        crash={crash}
        columnRef={risersRef}
      />
    </div>
  );
}

function TickerSeparator() {
  return <span className="mx-[0.6vw] text-[#a9ae8d]">·</span>;
}

function TickerSegments({
  crash,
  instruments,
  feedCopy,
}: {
  crash: boolean;
  instruments: MarketInstrumentPayload[];
  feedCopy: string[];
}) {
  const top = instruments.length
    ? instruments.reduce((best, candidate) =>
        candidate.changePct > best.changePct ? candidate : best
      )
    : null;
  const bargain = instruments.length
    ? instruments.reduce((best, candidate) =>
        candidate.changePct < best.changePct ? candidate : best
      )
    : null;

  const segments: ReactNode[] = [
    <span key="dfx" className="font-semibold text-[#FDCC4B]">
      DFX
    </span>,
    <span key="status">
      {crash
        ? "MARKET CRASH - every drink at its floor price"
        : "prices move with what you buy · slow sellers get cheaper"}
    </span>,
  ];
  if (top && bargain) {
    segments.push(
      <span key="top">
        <span className="font-semibold text-[#FDCC4B]">TOP</span> {top.name}{" "}
        <span className={UP_TEXT}>▲</span>
      </span>,
      <span key="bargain">
        <span className="font-semibold text-[#FDCC4B]">BARGAIN</span> {bargain.name}{" "}
        <span className={DOWN_TEXT}>▼</span> {formatDisplayPrice(bargain)}
      </span>
    );
  }
  feedCopy.forEach((copy, index) => {
    segments.push(<span key={`feed-${index}`}>{copy}</span>);
  });
  segments.push(
    <span key="karaoke">karaoke thursdays</span>,
    <span key="live">live music saturdays</span>
  );

  return (
    <>
      {segments.map((segment, index) => (
        <span key={index} className="flex items-center">
          {segment}
          <TickerSeparator />
        </span>
      ))}
    </>
  );
}

function useCountdown(remainingSec: number | undefined): string {
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

export default function MarketBoard({
  initialView,
  qrDataUrl,
}: {
  initialView: BoardView;
  qrDataUrl: string | null;
}) {
  const { state, feed } = useMarketState(5000);
  const [view, setView] = useState<BoardView>(initialView);
  const crash = state?.crashActive === true;
  const crashCountdown = useCountdown(state?.crashRemainingSec);
  const nextTickCountdown = useCountdown(state?.nextTickInSec);
  const rerankCountdown = useCountdown(state?.nextRerankInSec ?? undefined);
  const tiersLive = state?.pricingMode === "tiers";

  if (!state || state.status === "closed") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-[1vw] text-center">
        <p className="font-board-display text-[9vw] leading-none text-[#FDCC4B]">
          {state ? "MARKETS CLOSED" : "OPENING…"}
        </p>
        <p className="font-board-mono text-[1.2vw] tracking-[0.3em] text-[#a9ae8d] uppercase">
          Don Fenticas drink exchange
        </p>
      </div>
    );
  }

  const instruments = state.instruments ?? [];
  const feedCopy = feed.slice(-2).map(eventCopy);

  return (
    <div
      className={`grid h-dvh grid-rows-[auto_1fr_auto] gap-[1.2vw] px-[2vw] pt-[1.6vw] font-board-mono tabular-nums transition-colors duration-500 ${
        crash ? "bg-[#7a0f1e]" : "bg-[#1a2008]"
      }`}
    >
      <header
        className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-end gap-[2vw] border-b-2 pb-[0.8vw] ${
          crash ? "border-white" : "border-[#FDCC4B]"
        }`}
      >
        <div>
          <p
            className={`font-board-display text-[5vw] leading-[0.9] tracking-[0.02em] ${
              crash ? "text-white" : "text-[#FDCC4B]"
            }`}
          >
            Don Fenticas
          </p>
          <p className="font-board-mono text-[1.5vw] tracking-[0.18em] text-[#f3f0dc]">
            DRINK EXCHANGE · HINCKLEY
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.9vw] tracking-[0.18em] text-[#a9ae8d] uppercase">Market</p>
          <p
            className={`font-board-display text-[3.4vw] leading-none ${
              crash ? "text-white" : "text-[#8CFF6A]"
            }`}
          >
            {crash ? "CRASH" : "OPEN"}
          </p>
        </div>
        {tiersLive && !crash && (
          <div className="text-right">
            <p className="text-[0.9vw] tracking-[0.18em] text-[#a9ae8d] uppercase">
              {state.warmedUp === false ? "Warming up" : "Next re-rank"}
            </p>
            <p className="font-board-display text-[3.4vw] leading-none text-[#8CFF6A]">
              {state.warmedUp === false ? `${state.unitsSoldTotal ?? 0}/${state.warmupUnits ?? 0}` : rerankCountdown}
            </p>
          </div>
        )}
        <div className="text-right">
          <p className="text-[0.9vw] tracking-[0.18em] text-[#a9ae8d] uppercase">
            {crash ? "Recovery in" : "Next update"}
          </p>
          <p
            className={`font-board-display text-[3.4vw] leading-none ${
              crash ? "ad-blink text-white" : "text-[#FDCC4B]"
            }`}
          >
            {crash ? crashCountdown : nextTickCountdown}
          </p>
        </div>
        {qrDataUrl && (
          <div className="flex items-center gap-[0.9vw] self-center border-l border-[#3a4520] pl-[1.8vw]">
            <Image
              src={qrDataUrl}
              alt="QR code linking to the Market Night page"
              width={384}
              height={384}
              unoptimized
              className="h-[6.2vw] w-[6.2vw] rounded-[0.4vw] bg-white p-[0.3vw]"
            />
            <div className="max-w-[12vw] text-[0.8vw] leading-[1.4] tracking-[0.1em] uppercase">
              <p className="font-semibold text-[#f3f0dc]">Scan for the market on your phone</p>
              <p className="text-[#a9ae8d]">Get alerts on the drinks you watch</p>
            </div>
          </div>
        )}
      </header>

      {instruments.length === 0 ? (
        <div className="grid place-items-center">
          <p className="font-board-display text-[3vw] text-[#a9ae8d]">NO DRINKS TRADING YET</p>
        </div>
      ) : view === "categories" ? (
        <CategoriesView instruments={instruments} crash={crash} />
      ) : view === "table" ? (
        <TableView instruments={instruments} crash={crash} />
      ) : view === "leaderboard" ? (
        <LeaderboardView instruments={instruments} crash={crash} state={state} />
      ) : (
        <MoversView instruments={instruments} crash={crash} />
      )}

      <footer
        className={`overflow-hidden border-t-2 py-[0.6vw] whitespace-nowrap ${
          crash ? "border-white" : "border-[#FDCC4B]"
        }`}
      >
        <div className="ad-marquee-track [--marquee-duration:40s]">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex shrink-0 items-center text-[1.3vw] tracking-[0.06em]"
              aria-hidden={copy === 1}
            >
              <TickerSegments crash={crash} instruments={instruments} feedCopy={feedCopy} />
            </div>
          ))}
        </div>
      </footer>

      {crash && (
        <div className="pointer-events-none fixed inset-0 z-10 grid place-items-center" aria-hidden="true">
          <div className="ad-shake text-center font-board-display text-[11vw] leading-[0.9] tracking-[0.08em] text-white [text-shadow:0_0_3vw_#ff2e4c]">
            MARKET CRASH
            <span className="block text-[2.2vw] tracking-[0.3em]">
              ALL PRICES AT FLOOR · GET TO THE BAR
            </span>
          </div>
        </div>
      )}

      <div className="fixed right-[1vw] bottom-[1vw] z-20 opacity-25 transition-opacity focus-within:opacity-100 hover:opacity-100">
        <button
          type="button"
          onClick={() => setView((current) => VIEW_CYCLE[current])}
          aria-label={VIEW_TOGGLE_LABEL[view]}
          className="min-h-11 min-w-11 cursor-pointer rounded-[0.3vw] bg-[#FDCC4B] px-[0.9vw] py-[0.5vw] font-board-mono text-[0.85vw] font-semibold tracking-[0.08em] text-[#1a2008] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {VIEW_TOGGLE_LABEL[view]}
        </button>
      </div>
    </div>
  );
}
