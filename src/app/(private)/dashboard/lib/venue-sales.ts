// src/app/(private)/dashboard/lib/venue-sales.ts
//
// Pure shaping helpers for the dashboard "Venue Sales" section, sourced from
// the `square_sales` table (populated by /api/square/sync). These are ACTUAL
// Square takings — bar/food/POS — and are shown DISTINCT from the app's
// pre-booked booking revenue (see analytics.ts). The two are never summed.
//
// Same pattern as analytics.ts: fetch raw rows, run pure functions, hand plain
// serialisable objects to client chart components.

import type { CategoryBreakdown, SalesBucket } from "@/lib/square-sync";
import { delta, type Delta } from "./analytics";

export type VenueSaleRow = {
  business_date: string;
  net_sales: number | null;
  gross_sales: number | null;
  tips: number | null;
  fees: number | null;
  refunds: number | null;
  total_collected: number | null;
  category_breakdown: CategoryBreakdown | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Totals ───────────────────────────────────────────────────────────────────

export type SalesTotals = {
  takings: number;        // net sales (goods/services, ex-tips)
  gross: number;
  tips: number;
  fees: number;
  refunds: number;
  collected: number;      // net + tips - refunds
};

export function sumSales(rows: VenueSaleRow[]): SalesTotals {
  const t: SalesTotals = { takings: 0, gross: 0, tips: 0, fees: 0, refunds: 0, collected: 0 };
  for (const r of rows) {
    t.takings += r.net_sales ?? 0;
    t.gross += r.gross_sales ?? 0;
    t.tips += r.tips ?? 0;
    t.fees += r.fees ?? 0;
    t.refunds += r.refunds ?? 0;
    t.collected += r.total_collected ?? 0;
  }
  return {
    takings: round2(t.takings),
    gross: round2(t.gross),
    tips: round2(t.tips),
    fees: round2(t.fees),
    refunds: round2(t.refunds),
    collected: round2(t.collected),
  };
}

// ── Category split ───────────────────────────────────────────────────────────

const BUCKETS: SalesBucket[] = ["drinks", "food", "tickets", "other"];
const BUCKET_LABEL: Record<SalesBucket, string> = {
  drinks: "Drinks",
  food: "Food",
  tickets: "Tickets",
  other: "Other",
};

export type CategorySlice = { category: string; revenue: number };

/** Aggregate per-category takings across rows, largest first, zero buckets dropped. */
export function categoryTotals(rows: VenueSaleRow[]): CategorySlice[] {
  const totals: CategoryBreakdown = { drinks: 0, food: 0, tickets: 0, other: 0 };
  for (const r of rows) {
    const cb = r.category_breakdown;
    if (!cb) continue;
    for (const b of BUCKETS) totals[b] += cb[b] ?? 0;
  }
  return BUCKETS.map((b) => ({ category: BUCKET_LABEL[b], revenue: round2(totals[b]) }))
    .filter((s) => s.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

// ── Daily takings trend ──────────────────────────────────────────────────────

export type DailyPoint = { date: string; label: string; takings: number };

/**
 * Takings per calendar day for the trailing `days` days, zero-filled so the
 * chart never gaps.
 */
export function dailyTakings(
  rows: VenueSaleRow[],
  days = 30,
  now: Date = new Date()
): DailyPoint[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    byDate.set(r.business_date, (byDate.get(r.business_date) ?? 0) + (r.net_sales ?? 0));
  }
  const out: DailyPoint[] = [];
  // Anchor on the UTC calendar day so it lines up with `business_date` (a UTC
  // date from Square) regardless of server timezone.
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    out.push({
      date: iso,
      label: cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      takings: round2(byDate.get(iso) ?? 0),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// ── Takings matched to event nights ──────────────────────────────────────────

export type EventNight = { date: string; title: string };
export type EventTakings = { date: string; title: string; takings: number; tips: number };

/**
 * Match Square takings to event nights by trading date. Lets the dashboard show
 * "what did the bar take on quiz night". Only nights with a sale are returned,
 * most recent first.
 */
export function takingsByEvent(
  rows: VenueSaleRow[],
  events: EventNight[]
): EventTakings[] {
  const netByDate = new Map<string, number>();
  const tipsByDate = new Map<string, number>();
  for (const r of rows) {
    netByDate.set(r.business_date, (netByDate.get(r.business_date) ?? 0) + (r.net_sales ?? 0));
    tipsByDate.set(r.business_date, (tipsByDate.get(r.business_date) ?? 0) + (r.tips ?? 0));
  }
  return events
    .map((e) => ({
      date: e.date,
      title: e.title,
      takings: round2(netByDate.get(e.date) ?? 0),
      tips: round2(tipsByDate.get(e.date) ?? 0),
    }))
    .filter((e) => e.takings > 0 || e.tips > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ── One-call fetch + compute for the dashboard page ──────────────────────────

type SupabaseLike = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type VenueSalesData = {
  connected: boolean;          // any sales rows at all — false = sync hasn't run / not wired
  lastSyncedAt: string | null;
  thisMonth: SalesTotals;
  lastMonth: SalesTotals;
  deltas: { takings: Delta; tips: Delta };
  categories: CategorySlice[];
  daily: DailyPoint[];
  byEvent: EventTakings[];
};

const SALE_SELECT =
  "business_date, net_sales, gross_sales, tips, fees, refunds, total_collected, category_breakdown";

export async function fetchVenueSales(
  supabase: SupabaseLike,
  now: Date = new Date()
): Promise<VenueSalesData> {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyOneDaysAgo = new Date(now);
  thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

  const windowStart = new Date(
    Math.min(firstOfPrevMonth.getTime(), thirtyOneDaysAgo.getTime())
  );
  const windowStartDate = windowStart.toISOString().slice(0, 10);
  const firstOfMonthDate = firstOfMonth.toISOString().slice(0, 10);
  const firstOfPrevMonthDate = firstOfPrevMonth.toISOString().slice(0, 10);

  const [{ data: rowsData }, { data: syncState }, { data: pastEvents }] = await Promise.all([
    supabase.from("square_sales").select(SALE_SELECT).gte("business_date", windowStartDate),
    supabase.from("square_sync_state").select("last_synced_at").eq("id", 1).maybeSingle(),
    supabase
      .from("events")
      .select("date, title")
      .gte("date", firstOfMonthDate)
      .lte("date", now.toISOString().slice(0, 10))
      .neq("is_active", false)
      .order("date", { ascending: false }),
  ]);

  const rows = (rowsData ?? []) as VenueSaleRow[];
  const thisMonthRows = rows.filter((r) => r.business_date >= firstOfMonthDate);
  const lastMonthRows = rows.filter(
    (r) => r.business_date >= firstOfPrevMonthDate && r.business_date < firstOfMonthDate
  );

  const thisMonth = sumSales(thisMonthRows);
  const lastMonth = sumSales(lastMonthRows);

  return {
    connected: rows.length > 0,
    lastSyncedAt: (syncState as { last_synced_at: string | null } | null)?.last_synced_at ?? null,
    thisMonth,
    lastMonth,
    deltas: {
      takings: delta(thisMonth.takings, lastMonth.takings),
      tips: delta(thisMonth.tips, lastMonth.tips),
    },
    categories: categoryTotals(thisMonthRows),
    daily: dailyTakings(rows, 30, now),
    byEvent: takingsByEvent(
      thisMonthRows,
      ((pastEvents ?? []) as { date: string; title: string | null }[]).map((e) => ({
        date: e.date,
        title: e.title ?? "Event",
      }))
    ),
  };
}
