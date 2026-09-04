import type { MarketEventKind } from "./types";

export type HistoryInstrument = {
  id: number;
  display_name: string;
  serve: string;
};

export type HistoryTick = {
  instrument_id: number;
  tick_no: number;
  price: number | string;
  created_at: string;
};

export type HistoryEvent = {
  id: number;
  instrument_id: number | null;
  kind: MarketEventKind | string;
  payload: unknown;
  created_at: string;
};

export type HistoryEntryKind = "price" | "stock" | "alert" | "crash";

export type HistoryEntry = {
  key: string;
  kind: HistoryEntryKind;
  drink: string | null;
  serve: string | null;
  from: number | null;
  to: number | null;
  pct: number | null;
  tickNo: number | null;
  copy: string;
  at: string;
};

const STOCK_KINDS = new Set(["low_stock", "out_of_stock", "restock"]);
const ALERT_KINDS = new Set(["price_drop", "surge"]);

function gbp(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `£${value.toFixed(2)}`;
}

function pctText(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "";
  const sign = pct > 0 ? "+" : "";
  return ` (${sign}${pct.toFixed(1)}%)`;
}

export function eventEntryKind(kind: string): HistoryEntryKind {
  if (kind === "crash") return "crash";
  if (STOCK_KINDS.has(kind)) return "stock";
  if (ALERT_KINDS.has(kind)) return "alert";
  return "alert";
}

function eventCopyText(kind: string, from: number | null, to: number | null, pct: number | null): string {
  switch (kind) {
    case "price_drop":
      return `Price drop alert ${gbp(from)} → ${gbp(to)}${pctText(pct)}`;
    case "surge":
      return `Surge alert ${gbp(from)} → ${gbp(to)}${pctText(pct)}`;
    case "low_stock":
      return "Running low";
    case "out_of_stock":
      return "Sold out";
    case "restock":
      return "Back on the bar";
    case "crash":
      return "Market crash triggered";
    default:
      return kind.replace(/_/g, " ");
  }
}

export function priceChangeEntries(
  instruments: HistoryInstrument[],
  ticks: HistoryTick[]
): HistoryEntry[] {
  const byInstrument = new Map(instruments.map((instrument) => [instrument.id, instrument]));
  const sorted = [...ticks].sort(
    (a, b) => a.instrument_id - b.instrument_id || a.tick_no - b.tick_no
  );
  const entries: HistoryEntry[] = [];
  let previous: HistoryTick | null = null;
  for (const tick of sorted) {
    const samePrevious = previous && previous.instrument_id === tick.instrument_id ? previous : null;
    previous = tick;
    if (!samePrevious) continue;
    const from = Number(samePrevious.price);
    const to = Number(tick.price);
    if (from === to) continue;
    const instrument = byInstrument.get(tick.instrument_id);
    const pct = from > 0 ? Math.round(((to - from) / from) * 1000) / 10 : null;
    entries.push({
      key: `tick-${tick.instrument_id}-${tick.tick_no}`,
      kind: "price",
      drink: instrument?.display_name ?? null,
      serve: instrument?.serve ?? null,
      from,
      to,
      pct,
      tickNo: tick.tick_no,
      copy: `${gbp(from)} → ${gbp(to)}${pctText(pct)}`,
      at: tick.created_at,
    });
  }
  return entries;
}

export function marketEventEntries(
  instruments: HistoryInstrument[],
  events: HistoryEvent[]
): HistoryEntry[] {
  const byInstrument = new Map(instruments.map((instrument) => [instrument.id, instrument]));
  return events.map((event) => {
    const payload = (event.payload ?? {}) as {
      name?: string;
      serve?: string;
      from?: number;
      to?: number;
      pct?: number;
    };
    const instrument = event.instrument_id != null ? byInstrument.get(event.instrument_id) : null;
    const from = payload.from ?? null;
    const to = payload.to ?? null;
    const pct = payload.pct ?? null;
    return {
      key: `event-${event.id}`,
      kind: eventEntryKind(event.kind),
      drink: payload.name ?? instrument?.display_name ?? null,
      serve: payload.serve ?? instrument?.serve ?? null,
      from,
      to,
      pct,
      tickNo: null,
      copy: eventCopyText(event.kind, from, to, pct),
      at: event.created_at,
    };
  });
}

export function buildHistoryEntries(
  instruments: HistoryInstrument[],
  ticks: HistoryTick[],
  events: HistoryEvent[]
): HistoryEntry[] {
  return [...priceChangeEntries(instruments, ticks), ...marketEventEntries(instruments, events)].sort(
    (a, b) => b.at.localeCompare(a.at) || (b.tickNo ?? 0) - (a.tickNo ?? 0)
  );
}
