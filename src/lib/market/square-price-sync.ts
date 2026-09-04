import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Square } from "square";
import { squareClient } from "@/lib/square";

/* Pushes engine prices INTO Square Catalog so the till charges what the board
   shows. tick.ts reads sales out of Square; this is the write leg back in.

   Square Catalog facts that shape this file:
   1. No sparse updates - every upsert must carry the FULL ITEM_VARIATION, so we
      re-fetch immediately before writing and change only the price fields.
   2. Optimistic concurrency - every write needs the object's current `version`
      or Square returns VERSION_MISMATCH. Never cache versions across ticks.
   3. One catalog write at a time per seller account - concurrent writes get
      429. So: never write per sale, coalesce dirty instruments into one
      batchUpsert per tick, and treat 429 as "try again next tick".
   4. `location_overrides[].price_money` beats the top-level price on the POS,
      so both are overwritten.

   Columns: market_instruments.square_original_price / square_synced_price /
   square_sync_error, market_sessions.square_sync_enabled, and the
   market_square_sync_log table (migration 20260904120000). */

const CURRENCY: Square.Currency = "GBP";

/* Square.CatalogObject is a discriminated union; only this member carries
   itemVariationData, so everything below works on the narrowed type. */
type Variation = Extract<Square.CatalogObject, { type: "ITEM_VARIATION" }>;

function isVariation(obj: Square.CatalogObject | undefined): obj is Variation {
  return obj?.type === "ITEM_VARIATION";
}

function variationPrice(obj: Variation | undefined): number | null {
  return moneyToPounds(obj?.itemVariationData?.priceMoney);
}

/* Square allows 1,000 objects per batch, but a batch is all-or-nothing, so one
   bad variation would sink every price in the tick. Ten keeps the blast radius
   small; a single request may carry many batches. */
const BATCH_SIZE = 10;

type InstrumentSyncRow = {
  id: number;
  display_name: string;
  current_price: number | string;
  square_variation_id: string | null;
  square_original_price: number | string | null;
  square_synced_price: number | string | null;
};

export type SquareSyncResult = {
  attempted: number;
  written: number;
  skipped: number;
  errors: { instrumentId: number; message: string }[];
  /* True on 429: nothing was written, rows stay dirty, next tick retries. */
  retryLater: boolean;
};

const emptyResult = (): SquareSyncResult => ({
  attempted: 0,
  written: 0,
  skipped: 0,
  errors: [],
  retryLater: false,
});

/* DB holds numeric(6,2) pounds; Square wants integer minor units as BigInt.
   The engine already rounds to roundStep, so Math.round only guards float noise. */
function poundsToMoney(pounds: number): Square.Money {
  return { amount: BigInt(Math.round(pounds * 100)), currency: CURRENCY };
}

function moneyToPounds(money: Square.Money | undefined | null): number | null {
  return money?.amount == null ? null : Number(money.amount) / 100;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchVariations(ids: string[]): Promise<Map<string, Variation>> {
  const map = new Map<string, Variation>();
  if (ids.length === 0) return map;
  const res = await squareClient.catalog.batchGet({
    objectIds: ids,
    includeRelatedObjects: false,
    includeDeletedObjects: false,
  });
  for (const obj of res.objects ?? []) {
    if (isVariation(obj) && obj.id) map.set(obj.id, obj);
  }
  return map;
}

/* Returns a NEW object with the price swapped in everywhere the POS reads it;
   everything else on the variation passes through untouched (fact 1). */
function withPrice(variation: Variation, pounds: number): Variation {
  const data = variation.itemVariationData;
  if (!data) return variation;
  const price = poundsToMoney(pounds);
  return {
    ...variation,
    itemVariationData: {
      ...data,
      /* A VARIABLE_PRICING variation has no price and makes the till prompt
         staff for an amount - force FIXED so the market price is charged. */
      pricingType: "FIXED_PRICING",
      priceMoney: price,
      locationOverrides: data.locationOverrides?.map((override) =>
        override.priceMoney
          ? { ...override, priceMoney: price, pricingType: "FIXED_PRICING" as const }
          : override
      ),
    },
  };
}

type SquareError = { statusCode?: number; errors?: { code?: string }[] };

function isRateLimited(err: unknown): boolean {
  const e = err as SquareError;
  return e?.statusCode === 429 || Boolean(e?.errors?.some((x) => x.code === "RATE_LIMITED"));
}

function isVersionMismatch(err: unknown): boolean {
  return Boolean((err as SquareError)?.errors?.some((x) => x.code === "VERSION_MISMATCH"));
}

type UpsertOutcome = {
  written: Variation[];
  before: Map<string, Variation>;
};

/* One request, batched in tens. On VERSION_MISMATCH (someone edited an item in
   Dashboard between our fetch and our write) re-fetch and retry exactly once. */
async function upsertPrices(
  targets: { variationId: string; pounds: number }[],
  attempt = 1
): Promise<UpsertOutcome> {
  const fresh = await fetchVariations(targets.map((t) => t.variationId));
  const objects = targets
    .map((t) => {
      const variation = fresh.get(t.variationId);
      return variation ? withPrice(variation, t.pounds) : null;
    })
    .filter((v): v is Variation => v !== null);
  if (objects.length === 0) return { written: [], before: fresh };

  try {
    const res = await squareClient.catalog.batchUpsert({
      idempotencyKey: randomUUID(),
      batches: chunk(objects, BATCH_SIZE).map((batch) => ({ objects: batch })),
    });
    return { written: (res.objects ?? []).filter(isVariation), before: fresh };
  } catch (err) {
    if (isVersionMismatch(err) && attempt === 1) return upsertPrices(targets, 2);
    throw err;
  }
}

async function logPush(
  supabase: SupabaseClient,
  sessionId: number,
  cause: "tick" | "restore",
  rowsByVariation: Map<string, { id: number }>,
  outcome: UpsertOutcome
) {
  const rows = outcome.written.map((obj) => {
    const prev = obj.id ? outcome.before.get(obj.id) : undefined;
    return {
      session_id: sessionId,
      instrument_id: obj.id ? (rowsByVariation.get(obj.id)?.id ?? null) : null,
      square_variation_id: obj.id ?? null,
      price_before: variationPrice(prev),
      price_after: variationPrice(obj),
      version_before: prev?.version == null ? null : Number(prev.version),
      version_after: obj.version == null ? null : Number(obj.version),
      cause,
    };
  });
  if (rows.length === 0) return;
  const { error } = await supabase.from("market_square_sync_log").insert(rows);
  if (error) console.error("[market] sync log insert failed:", error);
}

async function linkedInstruments(
  supabase: SupabaseClient,
  sessionId: number
): Promise<InstrumentSyncRow[]> {
  const { data, error } = await supabase
    .from("market_instruments")
    .select(
      "id, display_name, current_price, square_variation_id, square_original_price, square_synced_price"
    )
    .eq("session_id", sessionId)
    .not("square_variation_id", "is", null);
  if (error) throw error;
  return (data ?? []) as InstrumentSyncRow[];
}

/* Call at the END of a successful engine tick, after market_instruments has the
   new prices. A crash is just a run of ticks in this engine, so it is covered.
   Never call from anything that fires per sale. */
export async function syncMarketPricesToSquare(
  supabase: SupabaseClient,
  sessionId: number
): Promise<SquareSyncResult> {
  const result = emptyResult();

  const { data: session } = await supabase
    .from("market_sessions")
    .select("status, square_sync_enabled")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "live" || session.square_sync_enabled === false) {
    return result;
  }

  const rows = await linkedInstruments(supabase, sessionId);
  const dirty = rows.filter(
    (row) =>
      row.square_synced_price === null ||
      Number(row.square_synced_price) !== Number(row.current_price)
  );
  result.attempted = dirty.length;
  result.skipped = rows.length - dirty.length;
  if (dirty.length === 0) return result;

  const byVariation = new Map(dirty.map((row) => [row.square_variation_id as string, row]));

  let outcome: UpsertOutcome;
  try {
    outcome = await upsertPrices(
      dirty.map((row) => ({
        variationId: row.square_variation_id as string,
        pounds: Number(row.current_price),
      }))
    );
  } catch (err) {
    if (isRateLimited(err)) {
      /* Another catalog write (menu edit, menu push) is in flight. Rows stay
         dirty and the next tick picks them up. */
      result.retryLater = true;
      return result;
    }
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("market_instruments")
      .update({ square_sync_error: message })
      .in(
        "id",
        dirty.map((row) => row.id)
      );
    result.errors.push(...dirty.map((row) => ({ instrumentId: row.id, message })));
    return result;
  }

  await logPush(supabase, sessionId, "tick", byVariation, outcome);

  /* Record what Square now holds: the board's headline number, the settings
     page's "board / till" pair, and next tick's dirty check. */
  for (const obj of outcome.written) {
    const row = obj.id ? byVariation.get(obj.id) : undefined;
    if (!row) continue;
    const { error } = await supabase
      .from("market_instruments")
      .update({
        square_synced_price: variationPrice(obj),
        square_sync_error: null,
      })
      .eq("id", row.id);
    if (error) console.error("[market] synced price write failed:", error);
    else result.written += 1;
  }
  return result;
}

/* Call from openSession() before the first tick. Snapshots the real Square
   price so endMarketAction() can restore it. Never overwrites an existing
   snapshot, so a re-run cannot wipe the original. */
export async function captureSquareOriginalPrices(
  supabase: SupabaseClient,
  sessionId: number
): Promise<void> {
  const rows = (await linkedInstruments(supabase, sessionId)).filter(
    (row) => row.square_original_price === null
  );
  if (rows.length === 0) return;

  const fresh = await fetchVariations(rows.map((row) => row.square_variation_id as string));
  for (const row of rows) {
    const original = variationPrice(fresh.get(row.square_variation_id as string));
    if (original === null) continue; // VARIABLE_PRICING: nothing to restore
    await supabase
      .from("market_instruments")
      .update({ square_original_price: original })
      .eq("id", row.id);
  }
}

/* Call from endMarketAction() and the "Restore till prices" button. Retries 429
   with a short backoff because this write MUST land even if a tick is mid-flight. */
export async function restoreSquarePrices(
  supabase: SupabaseClient,
  sessionId: number
): Promise<SquareSyncResult> {
  const result = emptyResult();
  const rows = (await linkedInstruments(supabase, sessionId)).filter(
    (row) => row.square_original_price !== null
  );
  if (rows.length === 0) return result;
  result.attempted = rows.length;

  const targets = rows.map((row) => ({
    variationId: row.square_variation_id as string,
    pounds: Number(row.square_original_price),
  }));
  const byVariation = new Map(rows.map((row) => [row.square_variation_id as string, row]));

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const outcome = await upsertPrices(targets);
      await logPush(supabase, sessionId, "restore", byVariation, outcome);
      result.written = outcome.written.length;
      await supabase
        .from("market_instruments")
        .update({ square_synced_price: null, square_sync_error: null })
        .eq("session_id", sessionId);
      return result;
    } catch (err) {
      if (isRateLimited(err) && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ instrumentId: 0, message });
      await supabase
        .from("market_instruments")
        .update({ square_sync_error: `RESTORE FAILED: ${message}` })
        .eq("session_id", sessionId);
      return result;
    }
  }
  return result;
}