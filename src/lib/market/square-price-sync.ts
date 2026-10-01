import type { SupabaseClient } from "@supabase/supabase-js";
import { squareClient } from "@/lib/square";
import {
  isVariation,
  originalFromRow,
  originalToRow,
  pence,
  readOriginal,
  restoreStep,
  variationPrice,
  withOriginal,
  withPrice,
  type LocationOriginal,
  type OriginalPrice,
  type Variation,
} from "./square-original-price";

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
   market_square_sync_log table (migration 20260904120000). The original
   pricing type and location prices sit beside the original price
   (migration 20261001210000). */

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
  square_original_pricing_type: string | null;
  square_original_location_prices: Record<string, LocationOriginal> | null;
  square_synced_price: number | string | null;
};

export type SquareSyncResult = {
  attempted: number;
  written: number;
  skipped: number;
  errors: { instrumentId: number; message: string }[];
  /* True on 429: nothing was written, rows stay dirty, next tick retries. */
  retryLater: boolean;
  /* Restore only: drinks whose price was changed in Square during the night,
     which closing leaves as Square has them. */
  changedInSquare: string[];
};

const emptyResult = (): SquareSyncResult => ({
  attempted: 0,
  written: 0,
  skipped: 0,
  errors: [],
  retryLater: false,
  changedInSquare: [],
});

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

type SquareError = { statusCode?: number; errors?: { code?: string }[] };

function isRateLimited(err: unknown): boolean {
  const e = err as SquareError;
  return e?.statusCode === 429 || Boolean(e?.errors?.some((x) => x.code === "RATE_LIMITED"));
}

function isVersionMismatch(err: unknown): boolean {
  return Boolean((err as SquareError)?.errors?.some((x) => x.code === "VERSION_MISMATCH"));
}

/* Square sends Retry-After in seconds on a 429; the SDK surfaces headers in
   a couple of shapes depending on version, so look in both and cap the wait
   so a tick never blocks for long. */
const MAX_RETRY_AFTER_MS = 5000;

export function retryAfterMs(err: unknown, fallbackMs = 2000): number {
  const e = err as { rawResponse?: { headers?: Record<string, string> }; headers?: Record<string, string> };
  const header = e?.rawResponse?.headers?.["retry-after"] ?? e?.headers?.["retry-after"];
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs;
  return Math.min(ms, MAX_RETRY_AFTER_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type UpsertOutcome = {
  written: Variation[];
  before: Map<string, Variation>;
  /* False when beforeWrite said no: nothing was sent to Square. */
  sent: boolean;
};

/* One request, batched in tens. Each variation is re-fetched and handed to
   change, which returns the object to write or null to leave it alone. On
   VERSION_MISMATCH (someone edited an item in Dashboard between our fetch
   and our write) re-fetch and retry exactly once. The idempotency key is
   deterministic per (caller key, attempt) so a request that times out and is
   replayed by the SDK cannot apply twice, while a re-fetched retry - which
   carries different object versions - gets its own. beforeWrite runs after
   the fetch, right before the write, so a market that started closing in
   the meantime never gets a late price. */
async function upsertVariations(
  ids: string[],
  change: (variation: Variation) => Variation | null,
  idempotencyBase: string,
  beforeWrite?: () => Promise<boolean>,
  attempt = 1
): Promise<UpsertOutcome> {
  const fresh = await fetchVariations(ids);
  const objects = ids
    .map((id) => {
      const variation = fresh.get(id);
      return variation ? change(variation) : null;
    })
    .filter((v): v is Variation => v !== null);
  if (objects.length === 0) return { written: [], before: fresh, sent: true };
  if (beforeWrite && !(await beforeWrite())) return { written: [], before: fresh, sent: false };

  try {
    const res = await squareClient.catalog.batchUpsert({
      idempotencyKey: `${idempotencyBase}-a${attempt}`.slice(0, 128),
      batches: chunk(objects, BATCH_SIZE).map((batch) => ({ objects: batch })),
    });
    return { written: (res.objects ?? []).filter(isVariation), before: fresh, sent: true };
  } catch (err) {
    if (isVersionMismatch(err) && attempt === 1) {
      return upsertVariations(ids, change, idempotencyBase, beforeWrite, 2);
    }
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
      "id, display_name, current_price, square_variation_id, square_original_price, square_original_pricing_type, square_original_location_prices, square_synced_price"
    )
    .eq("session_id", sessionId)
    .not("square_variation_id", "is", null);
  if (error) throw error;
  return (data ?? []) as InstrumentSyncRow[];
}

async function sessionIsLive(supabase: SupabaseClient, sessionId: number): Promise<boolean> {
  const { data } = await supabase.from("market_sessions").select("status").eq("id", sessionId).maybeSingle();
  return data?.status === "live";
}

/* Snapshots what Square holds for each row that has no snapshot yet and
   saves it on the instrument. Rows whose variation Square no longer has stay
   without one. Returns the snapshots taken, by instrument id. */
async function captureOriginals(
  supabase: SupabaseClient,
  rows: InstrumentSyncRow[]
): Promise<Map<number, OriginalPrice>> {
  const captured = new Map<number, OriginalPrice>();
  if (rows.length === 0) return captured;
  const fresh = await fetchVariations(rows.map((row) => row.square_variation_id as string));
  for (const row of rows) {
    const variation = fresh.get(row.square_variation_id as string);
    if (!variation) continue;
    const original = readOriginal(variation);
    const { error } = await supabase
      .from("market_instruments")
      .update(originalToRow(original))
      .eq("id", row.id)
      .is("square_original_pricing_type", null);
    if (error) {
      console.error("[market] could not save the original Square price:", error);
      continue;
    }
    captured.set(row.id, original);
  }
  return captured;
}

/* Call at the END of a successful engine tick, after market_instruments has the
   new prices. A crash is just a run of ticks in this engine, so it is covered.
   Never call from anything that fires per sale. A drink is only ever pushed
   once its original Square price is saved, so closing can always put it
   back; a missing snapshot is retried here every tick. */
export async function syncMarketPricesToSquare(
  supabase: SupabaseClient,
  sessionId: number,
  tickNo?: number
): Promise<SquareSyncResult> {
  const result = emptyResult();
  const idempotencyBase = `market-${sessionId}-t${tickNo ?? Date.now()}`;

  const { data: session } = await supabase
    .from("market_sessions")
    .select("status, square_sync_enabled")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "live" || session.square_sync_enabled === false) {
    return result;
  }

  const rows = await linkedInstruments(supabase, sessionId);
  const missing = rows.filter((row) => originalFromRow(row) == null);
  let snapshots = new Map<number, OriginalPrice>();
  if (missing.length > 0) {
    try {
      snapshots = await captureOriginals(supabase, missing);
    } catch (err) {
      console.error("[market] could not snapshot Square prices, those drinks wait:", err);
    }
  }
  const ready = rows.filter((row) => originalFromRow(row) != null || snapshots.has(row.id));

  const dirty = ready.filter(
    (row) =>
      row.square_synced_price === null ||
      Number(row.square_synced_price) !== Number(row.current_price)
  );
  result.attempted = dirty.length;
  result.skipped = rows.length - dirty.length;
  if (dirty.length === 0) return result;

  const byVariation = new Map(dirty.map((row) => [row.square_variation_id as string, row]));
  const ids = [...byVariation.keys()];
  const change = (variation: Variation) => {
    const row = variation.id ? byVariation.get(variation.id) : undefined;
    return row ? withPrice(variation, Number(row.current_price)) : null;
  };
  const stillLive = () => sessionIsLive(supabase, sessionId);

  let outcome: UpsertOutcome;
  try {
    try {
      outcome = await upsertVariations(ids, change, idempotencyBase, stillLive);
    } catch (err) {
      /* One in-tick retry after Square's Retry-After: a transient collision
         then costs seconds, not a whole tick of stale till prices. */
      if (!isRateLimited(err)) throw err;
      await sleep(retryAfterMs(err));
      outcome = await upsertVariations(ids, change, `${idempotencyBase}-r`, stillLive);
    }
  } catch (err) {
    if (isRateLimited(err)) {
      /* Still busy - another catalog write (menu edit, menu push) is in
         flight. Rows stay dirty and the next tick picks them up. */
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
  if (!outcome.sent) return result;

  await logPush(supabase, sessionId, "tick", byVariation, outcome);
  if (outcome.written.length > 0) {
    await supabase
      .from("market_sessions")
      .update({ square_last_write_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

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
   snapshot, so a re-run cannot wipe the original. Any drink it misses is
   retried by every tick and is not pushed until it has one. */
export async function captureSquareOriginalPrices(
  supabase: SupabaseClient,
  sessionId: number
): Promise<void> {
  const rows = (await linkedInstruments(supabase, sessionId)).filter((row) => originalFromRow(row) == null);
  await captureOriginals(supabase, rows);
}

/* Every price this session pushed to each variation, in pence. A price on
   the till that is not one of these (or the original) was set in Square. */
async function pushedPrices(supabase: SupabaseClient, sessionId: number): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from("market_square_sync_log")
    .select("square_variation_id, price_after")
    .eq("session_id", sessionId)
    .eq("cause", "tick");
  if (error) throw error;
  const out = new Map<string, Set<number>>();
  for (const row of (data ?? []) as { square_variation_id: string | null; price_after: number | string | null }[]) {
    const value = pence(row.price_after);
    if (!row.square_variation_id || value == null) continue;
    const set = out.get(row.square_variation_id) ?? new Set<number>();
    set.add(value);
    out.set(row.square_variation_id, set);
  }
  return out;
}

/* Call from endMarketAction() and the "Restore till prices" button. Retries 429
   with a short backoff because this write MUST land even if a tick is mid-flight.
   Puts back the pricing type and each location's price as well as the
   headline, and only for drinks still carrying a price the market pushed:
   one changed in Square during the night is left as Square has it. */
export async function restoreSquarePrices(
  supabase: SupabaseClient,
  sessionId: number
): Promise<SquareSyncResult> {
  const result = emptyResult();
  const rows = (await linkedInstruments(supabase, sessionId)).filter((row) => originalFromRow(row) != null);
  if (rows.length === 0) return result;
  result.attempted = rows.length;

  const pushed = await pushedPrices(supabase, sessionId);
  const byVariation = new Map(rows.map((row) => [row.square_variation_id as string, row]));
  const idempotencyBase = `market-restore-${sessionId}-${Date.now()}`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    const changed: string[] = [];
    const change = (variation: Variation) => {
      const row = variation.id ? byVariation.get(variation.id) : undefined;
      const original = row ? originalFromRow(row) : null;
      if (!row || !original) return null;
      const ours = new Set(pushed.get(variation.id as string) ?? []);
      if (row.square_synced_price != null) ours.add(pence(row.square_synced_price) as number);
      const step = restoreStep(variation, original, ours);
      if (step === "changed") changed.push(row.display_name);
      return step === "restore" ? withOriginal(variation, original) : null;
    };
    try {
      const outcome = await upsertVariations([...byVariation.keys()], change, `${idempotencyBase}-${attempt}`);
      await logPush(supabase, sessionId, "restore", byVariation, outcome);
      result.written = outcome.written.length;
      result.changedInSquare = changed;
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

/* Variations a live or closing market has a snapshot for, with the price
   Square had before the market, so the catalog copy shows the real menu
   price rather than tonight's market price. */
export async function marketOriginalPrices(supabase: SupabaseClient): Promise<Map<string, number | null>> {
  const { data, error } = await supabase
    .from("market_instruments")
    .select(
      "square_variation_id, square_original_price, square_original_pricing_type, market_sessions!inner(status)"
    )
    .in("market_sessions.status", ["live", "closing"])
    .not("square_variation_id", "is", null);
  if (error) throw error;
  const out = new Map<string, number | null>();
  for (const row of (data ?? []) as unknown as (InstrumentSyncRow & { square_variation_id: string })[]) {
    const original = originalFromRow(row);
    if (original) out.set(row.square_variation_id, original.price);
  }
  return out;
}
