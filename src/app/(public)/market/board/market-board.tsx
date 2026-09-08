"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatGbp } from "@/lib/price";
import type { MarketInstrumentPayload } from "@/lib/market/tick";
import { useMarketState } from "../use-market-state";
import { FlipPrice, eventCopy, formatChangePct } from "../market-ui";

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

function OpenCell({ instrument }: { instrument: MarketInstrumentPayload }) {
  return (
    <span className="block font-board-mono text-[1.35vw] leading-none text-right text-[#a9ae8d] tabular-nums">
      {formatGbp(instrument.openingPrice)}
    </span>
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
        ? "MARKET CRASH - every drink at its floor price"
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
        className={`grid grid-cols-[1fr_auto_auto_auto] items-end gap-[2vw] border-b-2 pb-[0.8vw] ${
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
