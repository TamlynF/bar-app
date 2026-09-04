"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { formatGbp } from "@/lib/price";
import type { MarketInstrumentPayload } from "@/lib/market/tick";
import { useMarketState } from "../use-market-state";
import { eventCopy, formatChangePct } from "../market-ui";

export type BoardView = "categories" | "table" | "movers";

type Trend = "up" | "down" | "flat";

const VIEW_CYCLE: Record<BoardView, BoardView> = {
  categories: "table",
  table: "movers",
  movers: "categories",
};

const VIEW_TOGGLE_LABEL: Record<BoardView, string> = {
  categories: "Table view",
  table: "Movers view",
  movers: "Category view",
};

const FLIP_STEP_MS = 70;
const UNCATEGORISED = "The Bar";

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

function isDigit(glyph: string): boolean {
  return glyph >= "0" && glyph <= "9";
}

function glyphSequence(from: string, to: string): string[] {
  if (from === to) return [];
  if (!isDigit(from) || !isDigit(to)) return [to];
  const sequence: string[] = [];
  let current = Number(from);
  const target = Number(to);
  while (current !== target) {
    current = (current + 1) % 10;
    sequence.push(String(current));
  }
  return sequence;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

function FlipPrice({ value, className }: { value: string; className?: string }) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(value);
  const [target, setTarget] = useState(value);
  const displayedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (value !== target) {
    setTarget(value);
    if (reducedMotion) setDisplayed(value);
  }

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (reducedMotion) {
      displayedRef.current = value;
      return;
    }

    const start = displayedRef.current;
    if (start === value) return;
    const startGlyphs = Array.from({ length: value.length }, (_, index) => start[index] ?? "0");
    const sequences = startGlyphs.map((glyph, index) => glyphSequence(glyph, value[index]));
    const totalSteps = Math.max(
      0,
      ...sequences.map((sequence, index) => (sequence.length === 0 ? 0 : sequence.length + index))
    );
    if (totalSteps === 0) return;

    let step = 0;
    timerRef.current = setInterval(() => {
      step += 1;
      if (step >= totalSteps) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        displayedRef.current = value;
        setDisplayed(value);
        return;
      }
      const frame = sequences
        .map((sequence, index) => {
          const progress = step - index;
          if (progress <= 0 || sequence.length === 0) return startGlyphs[index];
          return sequence[Math.min(progress, sequence.length) - 1];
        })
        .join("");
      displayedRef.current = frame;
      setDisplayed(frame);
    }, FLIP_STEP_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [value, reducedMotion]);

  return (
    <span className={className} aria-label={value}>
      {Array.from(displayed).map((glyph, index) => (
        <span
          key={`${index}-${glyph}`}
          aria-hidden="true"
          className={isDigit(glyph) ? "ad-flap inline-block w-[1ch] text-center" : "ad-flap"}
        >
          {glyph}
        </span>
      ))}
    </span>
  );
}

function BoardSpark({
  values,
  floor,
  ceil,
  trend,
  crash,
  className,
}: {
  values: number[];
  floor: number;
  ceil: number;
  trend: Trend;
  crash: boolean;
  className?: string;
}) {
  const width = 100;
  const height = 30;
  const range = ceil - floor || 1;
  const points = values.map((value, index) => {
    const clamped = Math.min(Math.max(value, floor), ceil);
    const x = (index / (values.length - 1)) * width;
    const y = height - ((clamped - floor) / range) * height;
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });
  const line = points.map((point) => point.join(",")).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  const colour = crash
    ? "#ffffff"
    : trend === "up"
      ? "#8CFF6A"
      : trend === "down"
        ? "#FF4D6D"
        : "#a9ae8d";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`w-full overflow-visible ${className ?? ""}`}
      aria-hidden="true"
    >
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={colour} opacity=".12" />
      <polyline
        points={line}
        fill="none"
        stroke={colour}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.4" fill={colour} />
    </svg>
  );
}

function NameCell({
  instrument,
  chevron,
}: {
  instrument: MarketInstrumentPayload;
  chevron?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[1.5vw] font-medium text-[#f3f0dc]">
        {chevron}
        {instrument.name}
      </p>
      {instrument.stock === "out" ? (
        <p className="text-[0.8vw] tracking-[0.1em] text-[#FF4D6D] uppercase">sold out</p>
      ) : (
        instrument.serve !== "each" && (
          <p className="text-[0.8vw] text-[#a9ae8d]">{instrument.serve}</p>
        )
      )}
    </div>
  );
}

function PriceCell({
  instrument,
  trend,
  atFloor,
  crash,
}: {
  instrument: MarketInstrumentPayload;
  trend: Trend;
  atFloor: boolean;
  crash: boolean;
}) {
  const colour = crash
    ? "text-white"
    : atFloor
      ? "text-[#FDCC4B]"
      : trend === "up"
        ? "text-[#8CFF6A]"
        : trend === "down"
          ? "text-[#FF4D6D]"
          : "text-[#f3f0dc]";
  return (
    <FlipPrice
      value={formatGbp(instrument.price)}
      className={`block font-board-display text-[3vw] leading-none text-right ${colour}`}
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
    "justify-self-end rounded-[0.3vw] px-[0.5vw] py-[0.25vw] text-[1.05vw] font-semibold text-right";
  if (crash) return <span className={`${base} bg-[#ff2e4c] text-white`}>FLOOR</span>;
  if (atFloor) return <span className={`${base} bg-[#FDCC4B] text-[#1a2008]`}>FLOOR</span>;
  if (trend === "up") {
    return (
      <span className={`${base} bg-[#8CFF6A]/10 text-[#8CFF6A]`}>
        ▲ {formatChangePct(changePct)}
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className={`${base} bg-[#FF4D6D]/[.12] text-[#FF4D6D]`}>
        ▼ {formatChangePct(changePct)}
      </span>
    );
  }
  return <span className={`${base} bg-white/5 text-[#a9ae8d]`}>— 0.0%</span>;
}

function sparkValues(instrument: MarketInstrumentPayload): number[] {
  return instrument.spark.length < 2 ? [instrument.price, instrument.price] : instrument.spark;
}

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
    <div className="grid grid-cols-[1.2fr_9vw_6.6vw_6vw] items-center gap-[1vw] border-t border-[#3a4520] py-[0.55vw]">
      <NameCell instrument={instrument} />
      <BoardSpark
        values={sparkValues(instrument)}
        floor={instrument.floor}
        ceil={instrument.ceil}
        trend={trend}
        crash={crash}
        className="h-[2.6vw]"
      />
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
            {section.instruments.map((instrument) => (
              <CategoryRow key={instrument.id} instrument={instrument} crash={crash} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

const FLAT_COLUMNS = "grid grid-cols-[1.4fr_8vw_9vw_6.6vw_6vw] items-center gap-[1vw]";

function FlatHeader({ firstColumn }: { firstColumn: string }) {
  return (
    <div
      className={`${FLAT_COLUMNS} border-b border-[#3a4520] pb-[0.3vw] text-[0.85vw] tracking-[0.18em] text-[#a9ae8d] uppercase`}
    >
      <span>{firstColumn}</span>
      <span>Category</span>
      <span>Trend</span>
      <span className="text-right">Price</span>
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
      <span className="truncate text-[0.95vw] text-[#a9ae8d]">{instrument.category ?? "—"}</span>
      <BoardSpark
        values={sparkValues(instrument)}
        floor={instrument.floor}
        ceil={instrument.ceil}
        trend={trend}
        crash={crash}
        className="h-[2.2vw]"
      />
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
      className={`mr-[0.4vw] text-[0.9vw] ${delta < 0 ? "text-[#8CFF6A]" : "text-[#FF4D6D]"}`}
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
        ? "MARKET CRASH — every drink at its floor price"
        : "prices move with what you buy · slow sellers get cheaper"}
    </span>,
  ];
  if (top && bargain) {
    segments.push(
      <span key="top">
        <span className="font-semibold text-[#FDCC4B]">TOP</span> {top.name}{" "}
        <span className="text-[#8CFF6A]">▲</span>
      </span>,
      <span key="bargain">
        <span className="font-semibold text-[#FDCC4B]">BARGAIN</span> {bargain.name}{" "}
        <span className="text-[#FF4D6D]">▼</span> {formatGbp(bargain.price)}
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

function useCrashCountdown(crash: boolean, crashRemainingSec: number | undefined): string {
  const endsAtRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState("0:00");

  useEffect(() => {
    if (crashRemainingSec != null) endsAtRef.current = Date.now() + crashRemainingSec * 1000;
  }, [crashRemainingSec]);

  useEffect(() => {
    if (!crash) return;
    const update = () => {
      const endsAt = endsAtRef.current ?? Date.now();
      setCountdown(formatCountdown(endsAt - Date.now()));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [crash]);

  return countdown;
}

export default function MarketBoard({ initialView }: { initialView: BoardView }) {
  const { state, feed } = useMarketState(5000);
  const [view, setView] = useState<BoardView>(initialView);
  const crash = state?.crashActive === true;
  const countdown = useCrashCountdown(crash, state?.crashRemainingSec);

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
        className={`grid grid-cols-[1fr_auto_auto] items-end gap-[2vw] border-b-2 pb-[0.8vw] ${
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
        <div className="text-right">
          <p className="text-[0.9vw] tracking-[0.18em] text-[#a9ae8d] uppercase">
            {crash ? "Recovery in" : "Tick"}
          </p>
          <p
            className={`font-board-display text-[3.4vw] leading-none ${
              crash ? "ad-blink text-white" : "text-[#FDCC4B]"
            }`}
          >
            {crash ? countdown : state.tickNo}
          </p>
        </div>
      </header>

      {instruments.length === 0 ? (
        <div className="grid place-items-center">
          <p className="font-board-display text-[3vw] text-[#a9ae8d]">NO DRINKS TRADING YET</p>
        </div>
      ) : view === "categories" ? (
        <CategoriesView instruments={instruments} crash={crash} />
      ) : view === "table" ? (
        <TableView instruments={instruments} crash={crash} />
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
