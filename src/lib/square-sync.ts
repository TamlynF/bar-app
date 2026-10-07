import { squareClient } from "@/lib/square";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tradingNightOf } from "@/lib/market/normal-units";
import { withRetry } from "@/lib/retry";
import { sendSquareSyncFailureAlert } from "@/lib/square-sync-alert";
import {
  SYNC_ATTEMPTS,
  SYNC_RETRY_DELAYS_MS,
  planSync,
  retentionCutoff,
  shouldAlertOnFailure,
  type SyncPlan,
  type SyncStateLike,
  type SyncWindow,
} from "@/lib/square-sync-plan";

type Money = { amount?: bigint | number | null } | null | undefined;

function toGBP(m: Money): number {
  if (!m || m.amount == null) return 0;
  return Number(m.amount) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type SalesBucket = "drinks" | "food" | "tickets" | "other";
export type CategoryBreakdown = Record<SalesBucket, number>;

const EMPTY_BREAKDOWN = (): CategoryBreakdown => ({
  drinks: 0,
  food: 0,
  tickets: 0,
  other: 0,
});

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

type SquareOrder = {
  id?: string;
  locationId?: string;
  createdAt?: string;
  closedAt?: string;
  state?: string;
  lineItems?: Array<{
    uid?: string | null;
    name?: string | null;
    catalogObjectId?: string | null;
    quantity?: string | number | null;
    grossSalesMoney?: Money;
    totalMoney?: Money;
    modifiers?: Array<{
      catalogObjectId?: string | null;
      name?: string | null;
      quantity?: string | number | null;
      totalPriceMoney?: Money;
    }> | null;
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

export type SquareSaleLineRow = {
  square_order_id: string;
  line_uid: string;
  variation_id: string | null;
  quantity: number;
  closed_at: string;
  trading_night: string;
  modifiers: SaleLineModifier[];
};

/* What was rung on top of a line - for a spirit, the mixer it was sold with. */
export type SaleLineModifier = {
  catalogObjectId: string | null;
  name: string | null;
  quantity: number;
  totalPrice: number;
};

type LineModifier = NonNullable<NonNullable<SquareOrder["lineItems"]>[number]["modifiers"]>[number];

function lineModifiers(modifiers: LineModifier[] | null | undefined): SaleLineModifier[] {
  return (modifiers ?? []).map((modifier) => {
    const quantity = Number(modifier.quantity ?? 1);
    return {
      catalogObjectId: modifier.catalogObjectId ?? null,
      name: modifier.name ?? null,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      totalPrice: toGBP(modifier.totalPriceMoney),
    };
  });
}

/* One row per line item, the shape the market's normal-sales maths reads.
   The trading night follows the venue rule (before 06:00 counts as the night
   before) rather than the UTC business_date on the order row. */
export function orderToLineRows(order: SquareOrder): SquareSaleLineRow[] {
  const orderId = order.id;
  if (!orderId) return [];
  const closed = order.closedAt ?? order.createdAt ?? new Date().toISOString();
  const tradingNight = tradingNightOf(new Date(closed));
  const rows: SquareSaleLineRow[] = [];
  (order.lineItems ?? []).forEach((li, index) => {
    const quantity = Number(li.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    rows.push({
      square_order_id: orderId,
      line_uid: li.uid || String(index + 1),
      variation_id: li.catalogObjectId ?? null,
      quantity,
      closed_at: closed,
      trading_night: tradingNight,
      modifiers: lineModifiers(li.modifiers),
    });
  });
  return rows;
}

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
    raw: JSON.parse(JSON.stringify(order, (_, v) => (typeof v === "bigint" ? Number(v) : v))),
  };
}

async function fetchFeesByOrder(locationId: string, window: SyncWindow): Promise<Map<string, number>> {
  const fees = new Map<string, number>();
  const page = await squareClient.payments.list({
    locationId,
    beginTime: window.from.toISOString(),
    endTime: window.to.toISOString(),
  });
  for await (const p of page) {
    if (!p.orderId) continue;
    const fee = (p.processingFee ?? []).reduce((s, f) => s + toGBP(f.amountMoney), 0);
    if (fee) fees.set(p.orderId, round2((fees.get(p.orderId) ?? 0) + fee));
  }
  return fees;
}

async function fetchRefundsByOrder(locationId: string, window: SyncWindow): Promise<Map<string, number>> {
  const refunds = new Map<string, number>();
  const page = await squareClient.refunds.list({
    locationId,
    beginTime: window.from.toISOString(),
    endTime: window.to.toISOString(),
  });
  for await (const r of page) {
    if (!r.orderId) continue;
    const amt = toGBP(r.amountMoney);
    if (amt) refunds.set(r.orderId, round2((refunds.get(r.orderId) ?? 0) + amt));
  }
  return refunds;
}

/* Every completed order closed inside the window, whatever it sold - lines
   are kept for unlinked items too, so a drink linked to the menu later
   already has its history. */
async function searchCompletedOrders(locationId: string, window: SyncWindow): Promise<SquareOrder[]> {
  const orders: SquareOrder[] = [];
  let cursor: string | undefined;
  do {
    const res = await squareClient.orders.search({
      locationIds: [locationId],
      cursor,
      query: {
        filter: {
          stateFilter: { states: ["COMPLETED"] },
          dateTimeFilter: { closedAt: { startAt: window.from.toISOString(), endAt: window.to.toISOString() } },
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

export type SyncResult = {
  status: "ok" | "error";
  phase: "backfill" | "incremental";
  /* False when the run stopped at its time budget with windows still to do;
     the next run (cron or Sync now) carries on from the saved cursor. */
  complete: boolean;
  windowsDone: number;
  windowsTotal: number;
  ordersSynced: number;
  linesSynced: number;
  ordersPruned: number;
  attempts: number;
  from: string;
  to: string;
  error?: string;
};

export type SyncOptions = {
  now?: Date;
  /* Wall-clock budget for the Square pulls; the run stops cleanly between
     windows once it is spent rather than being killed mid-write. */
  budgetMs?: number;
  trigger?: "cron" | "manual";
};

const CHUNK = 500;
export const DEFAULT_SYNC_BUDGET_MS = 240_000;

/* An order's lines are replaced wholesale, so a line that Square has since
   voided disappears here too instead of lingering under an old uid. */
async function replaceSaleLines(supabase: SupabaseClient, orders: SquareOrder[]): Promise<number> {
  const lines = orders.flatMap(orderToLineRows);
  const orderIds = orders.map((o) => o.id).filter((id): id is string => Boolean(id));
  for (let i = 0; i < orderIds.length; i += CHUNK) {
    const { error } = await supabase
      .from("square_sale_lines")
      .delete()
      .in("square_order_id", orderIds.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < lines.length; i += CHUNK) {
    const { error } = await supabase.from("square_sale_lines").insert(lines.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }
  return lines.length;
}

type SyncStateRow = SyncStateLike & {
  consecutive_failures?: number | null;
  last_status?: string | null;
};

async function readSyncState(supabase: SupabaseClient): Promise<SyncStateRow | null> {
  const { data, error } = await supabase
    .from("square_sync_state")
    .select("last_synced_at, backfill_cursor, backfill_done_at, consecutive_failures, last_status")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SyncStateRow | null) ?? null;
}

async function updateSyncState(supabase: SupabaseClient, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("square_sync_state").update(patch).eq("id", 1);
  if (error) throw new Error(error.message);
}

async function openRunLog(
  supabase: SupabaseClient,
  plan: SyncPlan,
  trigger: string,
  startedAt: Date
): Promise<number | null> {
  const { data, error } = await supabase
    .from("square_sync_runs")
    .insert({
      started_at: startedAt.toISOString(),
      trigger,
      phase: plan.phase,
      status: "running",
      from_at: plan.from.toISOString(),
      to_at: plan.to.toISOString(),
      windows_total: plan.windows.length,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[square-sync] could not open the run log:", error.message);
    return null;
  }
  return (data as { id: number } | null)?.id ?? null;
}

async function closeRunLog(supabase: SupabaseClient, runId: number | null, patch: Record<string, unknown>): Promise<void> {
  if (runId == null) return;
  const { error } = await supabase.from("square_sync_runs").update(patch).eq("id", runId);
  if (error) console.error("[square-sync] could not close the run log:", error.message);
}

/* One window: pull, flatten, upsert. Square being flaky is retried here
   with a pause between goes; a window that still fails stops the run with
   the earlier windows already saved. */
async function syncWindow(
  supabase: SupabaseClient,
  locationId: string,
  window: SyncWindow,
  variationCategory: Map<string, string>
): Promise<{ orders: number; lines: number; attempts: number }> {
  const { value, attempts } = await withRetry(
    async () => {
      const orders = await searchCompletedOrders(locationId, window);
      const [feesByOrder, refundsByOrder] = await Promise.all([
        fetchFeesByOrder(locationId, window),
        fetchRefundsByOrder(locationId, window),
      ]);
      return { orders, feesByOrder, refundsByOrder };
    },
    {
      attempts: SYNC_ATTEMPTS,
      delaysMs: SYNC_RETRY_DELAYS_MS,
      onRetry: (error, attempt) =>
        console.warn(
          `[square-sync] window ${window.from.toISOString()}..${window.to.toISOString()} attempt ${attempt} failed, retrying:`,
          error instanceof Error ? error.message : error
        ),
    }
  );

  const rows = value.orders
    .map((o) => orderToSaleRow(o, variationCategory, value.feesByOrder, value.refundsByOrder))
    .filter((r): r is SquareSaleRow => r !== null);
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("square_sales").upsert(rows.slice(i, i + CHUNK), { onConflict: "square_order_id" });
    if (error) throw new Error(error.message);
  }
  const lines = await replaceSaleLines(supabase, value.orders);
  return { orders: rows.length, lines, attempts };
}

/* Drops orders older than the retention window from the app's own copy;
   their lines go with them (cascade). Square itself is never written to. */
async function pruneOldSales(supabase: SupabaseClient, now: Date): Promise<number> {
  const { count, error } = await supabase
    .from("square_sales")
    .delete({ count: "exact" })
    .lt("business_date", retentionCutoff(now));
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/* The scheduled pull. First run ever: the last six months, seven days at a
   time, saving the cursor after each batch so a timeout or a Square outage
   costs at most one batch and the next run carries on. After that: a top-up
   from the watermark. Each run then prunes anything past seven months. A run
   that fails after its retries logs the error, counts the streak and mails
   the venue. */
export async function syncSquareSales(supabase: SupabaseClient, options: SyncOptions = {}): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const budgetMs = options.budgetMs ?? DEFAULT_SYNC_BUDGET_MS;
  const trigger = options.trigger ?? "cron";
  const startedAt = Date.now();
  const locationId = process.env.SQUARE_LOCATION_ID;

  let state: SyncStateRow | null = null;
  let plan: SyncPlan = planSync(null, now);
  let runId: number | null = null;
  const progress = { windowsDone: 0, orders: 0, lines: 0, attempts: 0 };

  const fail = async (message: string): Promise<SyncResult> => {
    const consecutiveFailures = (state?.consecutive_failures ?? 0) + 1;
    const alert = shouldAlertOnFailure(consecutiveFailures);
    console.error(`[square-sync] ${plan.phase} run failed (${consecutiveFailures} in a row):`, message);
    await closeRunLog(supabase, runId, {
      finished_at: new Date().toISOString(),
      status: "error",
      windows_done: progress.windowsDone,
      orders_synced: progress.orders,
      lines_synced: progress.lines,
      attempts: progress.attempts,
      error: message,
    });
    try {
      await updateSyncState(supabase, {
        last_run_at: now.toISOString(),
        last_status: "error",
        last_error: message,
        consecutive_failures: consecutiveFailures,
        ...(alert ? { last_alerted_at: new Date().toISOString() } : {}),
        updated_at: now.toISOString(),
      });
    } catch (err) {
      console.error("[square-sync] could not record the failure:", err);
    }
    if (alert) {
      await sendSquareSyncFailureAlert({
        phase: plan.phase,
        trigger,
        error: message,
        consecutiveFailures,
        attempts: Math.max(progress.attempts, 1),
        windowsDone: progress.windowsDone,
        windowsTotal: plan.windows.length,
        runId,
        failedAt: new Date(),
      });
    }
    return {
      status: "error",
      phase: plan.phase,
      complete: false,
      windowsDone: progress.windowsDone,
      windowsTotal: plan.windows.length,
      ordersSynced: progress.orders,
      linesSynced: progress.lines,
      ordersPruned: 0,
      attempts: progress.attempts,
      from: plan.from.toISOString(),
      to: plan.to.toISOString(),
      error: message,
    };
  };

  if (!locationId) return fail("SQUARE_LOCATION_ID not set");

  try {
    state = await readSyncState(supabase);
    plan = planSync(state, now);
    runId = await openRunLog(supabase, plan, trigger, new Date());
    if (plan.phase === "backfill" && !state?.backfill_cursor) {
      await updateSyncState(supabase, { backfill_from: plan.from.toISOString(), updated_at: now.toISOString() });
    }

    const variationCategory = await buildVariationCategoryMap();

    for (const window of plan.windows) {
      if (progress.windowsDone > 0 && Date.now() - startedAt > budgetMs) break;
      const done = await syncWindow(supabase, locationId, window, variationCategory);
      progress.windowsDone += 1;
      progress.orders += done.orders;
      progress.lines += done.lines;
      progress.attempts += done.attempts;
      await updateSyncState(
        supabase,
        plan.phase === "backfill"
          ? { backfill_cursor: window.to.toISOString(), updated_at: new Date().toISOString() }
          : { last_synced_at: window.to.toISOString(), updated_at: new Date().toISOString() }
      );
      await closeRunLog(supabase, runId, {
        windows_done: progress.windowsDone,
        orders_synced: progress.orders,
        lines_synced: progress.lines,
        attempts: progress.attempts,
      });
    }

    const complete = progress.windowsDone === plan.windows.length;
    const finishedBackfill = plan.phase === "backfill" && complete;
    const ordersPruned = await pruneOldSales(supabase, now);

    await updateSyncState(supabase, {
      ...(finishedBackfill ? { backfill_done_at: now.toISOString(), last_synced_at: now.toISOString() } : {}),
      last_run_at: now.toISOString(),
      last_status: "ok",
      last_error: null,
      consecutive_failures: 0,
      orders_synced: progress.orders,
      last_pruned_at: now.toISOString(),
      last_pruned_orders: ordersPruned,
      updated_at: now.toISOString(),
    });
    await closeRunLog(supabase, runId, {
      finished_at: new Date().toISOString(),
      status: complete ? "ok" : "partial",
      orders_pruned: ordersPruned,
    });

    return {
      status: "ok",
      phase: plan.phase,
      complete,
      windowsDone: progress.windowsDone,
      windowsTotal: plan.windows.length,
      ordersSynced: progress.orders,
      linesSynced: progress.lines,
      ordersPruned,
      attempts: progress.attempts,
      from: plan.from.toISOString(),
      to: plan.to.toISOString(),
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
