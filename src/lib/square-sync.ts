// Square → Supabase sales sync.
//
// Pulls COMPLETED Square orders for a time window and flattens each into a
// `square_sales` row (takings, tips, fees, refunds, per-category split). Called
// by the scheduled /api/square/sync route so the dashboard reads venue takings
// from Supabase, never hitting Square on page load.
//
// These are ACTUAL venue takings and are kept distinct from the app's
// pre-booked booking revenue — the dashboard never sums the two.

import { squareClient } from "@/lib/square";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Money helpers ────────────────────────────────────────────────────────────
// Square amounts are BigInt minor units (pence). Everything we store is £.

type Money = { amount?: bigint | number | null } | null | undefined;

function toGBP(m: Money): number {
  if (!m || m.amount == null) return 0;
  return Number(m.amount) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Category bucketing ───────────────────────────────────────────────────────

export type SalesBucket = "drinks" | "food" | "tickets" | "other";
export type CategoryBreakdown = Record<SalesBucket, number>;

const EMPTY_BREAKDOWN = (): CategoryBreakdown => ({
  drinks: 0,
  food: 0,
  tickets: 0,
  other: 0,
});

/**
 * Classify a Square category (or item) name into a dashboard bucket by
 * keyword. Pure + exported so it's unit-testable and easy to tune. Unknown
 * names fall through to "other".
 */
export function bucketForCategory(name: string | null | undefined): SalesBucket {
  const n = (name ?? "").toLowerCase();
  if (!n) return "other";
  if (/\b(ticket|entry|event|bingo|quiz|admission|door|cover)\b/.test(n)) return "tickets";
  if (/(drink|beer|lager|ale|cider|wine|spirit|cocktail|shot|bar|beverage|soft|mixer|pint|prosecco|champagne|gin|vodka|whisk|rum|tequila|coffee|tea)/.test(n))
    return "drinks";
  if (/(food|kitchen|snack|meal|burger|pizza|chip|fries|starter|main|dessert|platter|nacho|wing|side|sandwich|pie|roast|breakfast|lunch|dinner)/.test(n))
    return "food";
  return "other";
}

// ── Catalog: variation → category-name map ───────────────────────────────────

/**
 * Builds a map from catalog variation id → its item's category name, so an
 * order line item (which references a variation) can be bucketed. Degrades to
 * an empty map on any failure — line items then bucket as "other".
 */
async function buildVariationCategoryMap(): Promise<Map<string, string>> {
  const variationToCategory = new Map<string, string>();
  try {
    const categoryNames = new Map<string, string>(); // categoryId → name
    const itemCategory = new Map<string, string>();   // itemId → categoryId
    const variationItem = new Map<string, string>();  // variationId → itemId

    const page = await squareClient.catalog.list({ types: "ITEM,CATEGORY" });
    for await (const obj of page) {
      if (!obj.id) continue;
      if (obj.type === "CATEGORY" && obj.categoryData?.name) {
        categoryNames.set(obj.id, obj.categoryData.name);
      } else if (obj.type === "ITEM" && obj.itemData) {
        // Loosely typed: catalog category shape varies across API versions
        // (newer `reportingCategory`/`categories`, older `categoryId`).
        const data = obj.itemData as {
          reportingCategory?: { id?: string | null } | null;
          categories?: Array<{ id?: string | null }> | null;
          categoryId?: string | null;
          variations?: Array<{ id?: string | null }> | null;
        };
        const catId =
          data.reportingCategory?.id ??
          data.categories?.[0]?.id ??
          data.categoryId ??
          null;
        if (catId) itemCategory.set(obj.id, catId);
        for (const v of data.variations ?? []) {
          if (v.id) variationItem.set(v.id, obj.id);
        }
      }
    }

    for (const [variationId, itemId] of variationItem) {
      const catId = itemCategory.get(itemId);
      const name = catId ? categoryNames.get(catId) : undefined;
      if (name) variationToCategory.set(variationId, name);
    }
  } catch (err) {
    console.error("[square-sync] catalog fetch failed, bucketing as 'other':", err);
  }
  return variationToCategory;
}

// ── Per-order shaping ────────────────────────────────────────────────────────

// Loosely typed to avoid coupling to the SDK's deep response types.
type SquareOrder = {
  id?: string;
  locationId?: string;
  createdAt?: string;
  closedAt?: string;
  state?: string;
  lineItems?: Array<{
    name?: string | null;
    catalogObjectId?: string | null;
    grossSalesMoney?: Money;
    totalMoney?: Money;
  }> | null;
  netAmounts?: {
    totalMoney?: Money;
    discountMoney?: Money;
    tipMoney?: Money;
  };
};

export type SquareSaleRow = {
  square_order_id: string;
  location_id: string | null;
  business_date: string;
  created_at: string;
  currency: string;
  gross_sales: number;
  discounts: number;
  net_sales: number;
  tips: number;
  fees: number;
  refunds: number;
  total_collected: number;
  category_breakdown: CategoryBreakdown;
  source: string;
  raw: unknown;
};

/**
 * Flatten a Square order into a `square_sales` row. Fees/refunds are supplied
 * from the Payments/Refunds APIs (keyed by order id) since they aren't on the
 * order object itself.
 */
export function orderToSaleRow(
  order: SquareOrder,
  variationCategory: Map<string, string>,
  feesByOrder: Map<string, number>,
  refundsByOrder: Map<string, number>
): SquareSaleRow | null {
  const orderId = order.id;
  if (!orderId) return null;

  const closed = order.closedAt ?? order.createdAt ?? new Date().toISOString();
  const businessDate = closed.slice(0, 10); // UTC date; UK bar orders rarely cross the UTC boundary

  const breakdown = EMPTY_BREAKDOWN();
  let gross = 0;
  for (const li of order.lineItems ?? []) {
    const value = toGBP(li.grossSalesMoney) || toGBP(li.totalMoney);
    gross += value;
    const catName = li.catalogObjectId
      ? variationCategory.get(li.catalogObjectId)
      : undefined;
    const bucket = bucketForCategory(catName ?? li.name);
    breakdown[bucket] = round2(breakdown[bucket] + value);
  }

  const discounts = toGBP(order.netAmounts?.discountMoney);
  const net = toGBP(order.netAmounts?.totalMoney) || round2(gross - discounts);
  const tips = toGBP(order.netAmounts?.tipMoney);
  const fees = round2(feesByOrder.get(orderId) ?? 0);
  const refunds = round2(refundsByOrder.get(orderId) ?? 0);

  return {
    square_order_id: orderId,
    location_id: order.locationId ?? null,
    business_date: businessDate,
    created_at: order.createdAt ?? closed,
    currency: "GBP",
    gross_sales: round2(gross),
    discounts: round2(discounts),
    net_sales: round2(net),
    tips: round2(tips),
    fees,
    refunds,
    total_collected: round2(net + tips - refunds),
    category_breakdown: breakdown,
    source: "square",
    raw: order,
  };
}

// ── Fees & refunds lookups ───────────────────────────────────────────────────

async function fetchFeesByOrder(
  locationId: string,
  beginTime: string
): Promise<Map<string, number>> {
  const fees = new Map<string, number>();
  try {
    const page = await squareClient.payments.list({ locationId, beginTime });
    for await (const p of page) {
      if (!p.orderId) continue;
      const fee = (p.processingFee ?? []).reduce(
        (s, f) => s + toGBP(f.amountMoney),
        0
      );
      if (fee) fees.set(p.orderId, round2((fees.get(p.orderId) ?? 0) + fee));
    }
  } catch (err) {
    console.error("[square-sync] payments.list failed (fees=0):", err);
  }
  return fees;
}

async function fetchRefundsByOrder(
  locationId: string,
  beginTime: string
): Promise<Map<string, number>> {
  const refunds = new Map<string, number>();
  try {
    const page = await squareClient.refunds.list({ locationId, beginTime });
    for await (const r of page) {
      if (!r.orderId) continue;
      const amt = toGBP(r.amountMoney);
      if (amt) refunds.set(r.orderId, round2((refunds.get(r.orderId) ?? 0) + amt));
    }
  } catch (err) {
    console.error("[square-sync] refunds.list failed (refunds=0):", err);
  }
  return refunds;
}

// ── Order search (manual cursor pagination) ──────────────────────────────────

async function searchCompletedOrders(
  locationId: string,
  beginTime: string
): Promise<SquareOrder[]> {
  const orders: SquareOrder[] = [];
  let cursor: string | undefined;
  do {
    const res = await squareClient.orders.search({
      locationIds: [locationId],
      cursor,
      query: {
        filter: {
          stateFilter: { states: ["COMPLETED"] },
          dateTimeFilter: { closedAt: { startAt: beginTime } },
        },
        sort: { sortField: "CLOSED_AT", sortOrder: "ASC" },
      },
      limit: 500,
    });
    for (const o of res.orders ?? []) orders.push(o as SquareOrder);
    cursor = res.cursor;
  } while (cursor);
  return orders;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export type SyncResult = {
  ordersSynced: number;
  from: string;
  status: "ok" | "error";
  error?: string;
};

/**
 * Sync Square sales into Supabase. Incremental: reads the watermark from
 * square_sync_state, pulls orders closed since then (with a lookback overlap so
 * late-arriving/offline orders aren't missed), and upserts. Idempotent.
 */
export async function syncSquareSales(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<SyncResult> {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) {
    return { ordersSynced: 0, from: "", status: "error", error: "SQUARE_LOCATION_ID not set" };
  }

  // Watermark, minus a 3-day lookback: Square offline orders can transmit up to
  // 72h late, and upsert makes re-pulling them harmless.
  const { data: state } = await supabase
    .from("square_sync_state")
    .select("last_synced_at")
    .eq("id", 1)
    .maybeSingle();

  const lookbackMs = 3 * 24 * 60 * 60 * 1000;
  const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // first run: 90d
  const watermark = state?.last_synced_at ? new Date(state.last_synced_at) : defaultStart;
  const beginTime = new Date(
    Math.min(watermark.getTime() - lookbackMs, now.getTime())
  ).toISOString();

  try {
    const [orders, variationCategory] = await Promise.all([
      searchCompletedOrders(locationId, beginTime),
      buildVariationCategoryMap(),
    ]);

    const [feesByOrder, refundsByOrder] = await Promise.all([
      fetchFeesByOrder(locationId, beginTime),
      fetchRefundsByOrder(locationId, beginTime),
    ]);

    const rows = orders
      .map((o) => orderToSaleRow(o, variationCategory, feesByOrder, refundsByOrder))
      .filter((r): r is SquareSaleRow => r !== null);

    if (rows.length > 0) {
      // Chunk to stay well under payload limits.
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase
          .from("square_sales")
          .upsert(chunk, { onConflict: "square_order_id" });
        if (error) throw new Error(error.message);
      }
    }

    await supabase
      .from("square_sync_state")
      .update({
        last_synced_at: now.toISOString(),
        last_run_at: now.toISOString(),
        last_status: "ok",
        last_error: null,
        orders_synced: rows.length,
        updated_at: now.toISOString(),
      })
      .eq("id", 1);

    return { ordersSynced: rows.length, from: beginTime, status: "ok" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("square_sync_state")
      .update({
        last_run_at: now.toISOString(),
        last_status: "error",
        last_error: message,
        updated_at: now.toISOString(),
      })
      .eq("id", 1);
    return { ordersSynced: 0, from: beginTime, status: "error", error: message };
  }
}
