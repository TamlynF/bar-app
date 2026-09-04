import { createClient } from "@/lib/supabase/server";
import {
  buildHistoryEntries,
  type HistoryEvent,
  type HistoryInstrument,
  type HistoryTick,
} from "@/lib/market/history";
import MarketHistoryClient, {
  type SessionOption,
  type SessionSummary,
} from "./market-history-client";

export const dynamic = "force-dynamic";

const TICK_ROW_CAP = 5000;

type SessionRow = {
  id: number;
  status: string;
  tick_no: number;
  started_at: string;
  ended_at: string | null;
  stock_market_event_id: number | null;
  stock_market_events: { name: string } | { name: string }[] | null;
};

function eventName(row: SessionRow): string | null {
  const joined = Array.isArray(row.stock_market_events)
    ? row.stock_market_events[0]
    : row.stock_market_events;
  return joined?.name ?? null;
}

export default async function MarketHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionParam } = await searchParams;
  const supabase = await createClient();

  const { data: sessionRows } = await supabase
    .from("market_sessions")
    .select("id, status, tick_no, started_at, ended_at, stock_market_event_id, stock_market_events(name)")
    .order("started_at", { ascending: false });

  const sessions: SessionOption[] = ((sessionRows ?? []) as SessionRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    eventName: eventName(row),
  }));

  const requestedId = sessionParam && /^\d+$/.test(sessionParam) ? Number(sessionParam) : null;
  const selectedRow =
    ((sessionRows ?? []) as SessionRow[]).find((row) => row.id === requestedId) ??
    ((sessionRows ?? []) as SessionRow[])[0] ??
    null;

  if (!selectedRow) {
    return <MarketHistoryClient sessions={sessions} selected={null} entries={[]} />;
  }

  const [{ data: instrumentRows }, { data: tickRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("market_instruments")
      .select("id, display_name, serve")
      .eq("session_id", selectedRow.id),
    supabase
      .from("market_ticks")
      .select("instrument_id, tick_no, price, created_at")
      .eq("session_id", selectedRow.id)
      .order("tick_no", { ascending: true })
      .limit(TICK_ROW_CAP),
    supabase
      .from("market_events")
      .select("id, instrument_id, kind, payload, created_at")
      .eq("session_id", selectedRow.id)
      .order("id", { ascending: true }),
  ]);

  const instruments = (instrumentRows ?? []) as HistoryInstrument[];
  const entries = buildHistoryEntries(
    instruments,
    (tickRows ?? []) as HistoryTick[],
    (eventRows ?? []) as HistoryEvent[]
  );

  const selected: SessionSummary = {
    id: selectedRow.id,
    status: selectedRow.status,
    tickNo: selectedRow.tick_no,
    startedAt: selectedRow.started_at,
    endedAt: selectedRow.ended_at,
    eventName: eventName(selectedRow),
    drinkCount: instruments.length,
    truncated: (tickRows ?? []).length >= TICK_ROW_CAP,
  };

  return <MarketHistoryClient sessions={sessions} selected={selected} entries={entries} />;
}
