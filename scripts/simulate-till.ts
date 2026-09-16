/* Simulates the Square POS till in the SANDBOX so the drinks market can be
   soak-tested without a real bar night.

   Why this shape: tick.ts does NOT consume webhooks for demand - it polls
   `orders.search` for COMPLETED orders at SQUARE_LOCATION_ID and sums
   `lineItems[].catalogObjectId` against `market_instruments.square_variation_id`.
   So a "till sale" is exactly: CreateOrder (catalog line items) + CreatePayment
   (order_id, autocomplete). An order with no fulfilment flips to COMPLETED the
   moment it is fully paid, which is what the till does too.

   Sandbox has its own empty catalog, so variation ids differ from production.
   `seed` builds one ITEM + ITEM_VARIATION per instrument and writes the new
   sandbox ids back to square_variation_id - only against a LOCAL Supabase
   unless you pass --allow-remote-db, because that would clobber the production
   mapping.

   Usage (SQUARE_ENVIRONMENT=sandbox, SQUARE_ACCESS_TOKEN=<sandbox token>,
   SQUARE_LOCATION_ID=<sandbox location>):
     npx jiti scripts/simulate-till.ts seed
     npx jiti scripts/simulate-till.ts stock --qty 40
     npx jiti scripts/simulate-till.ts sell --rounds 30 --interval 4000 --cash 0.4
     npx jiti scripts/simulate-till.ts locations   (prints sandbox location ids)

   Sandbox source_id values: cnon:card-nonce-ok (card), CASH (needs
   cashDetails.buyerSuppliedMoney), cnon:card-nonce-declined to test failures. */

import "dotenv/config";
import { randomUUID } from "crypto";
import type { Square } from "square";
import { squareClient } from "../src/lib/square";
import { createAdminClient } from "../src/lib/supabase/admin";

const CURRENCY: Square.Currency = "GBP";

type Instrument = {
  id: number;
  display_name: string;
  current_price: number | string;
  square_variation_id: string | null;
  square_original_price: number | string | null;
};

/* ---------- arg parsing (tiny, no dependency) ---------- */

const [, , command = "help", ...rest] = process.argv;
const flags = new Map<string, string>();
for (let i = 0; i < rest.length; i += 1) {
  if (!rest[i].startsWith("--")) continue;
  const key = rest[i].slice(2);
  const next = rest[i + 1];
  if (next && !next.startsWith("--")) {
    flags.set(key, next);
    i += 1;
  } else {
    flags.set(key, "true");
  }
}
const num = (key: string, fallback: number) => {
  const raw = flags.get(key);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

/* ---------- guards ---------- */

function assertSandbox() {
  if (process.env.SQUARE_ENVIRONMENT === "production") {
    throw new Error("Refusing to run: SQUARE_ENVIRONMENT is production. Point it at sandbox.");
  }
  if (!process.env.SQUARE_ACCESS_TOKEN) throw new Error("SQUARE_ACCESS_TOKEN missing");
}

function requireLocation(): string {
  const id = process.env.SQUARE_LOCATION_ID;
  if (!id) throw new Error("SQUARE_LOCATION_ID missing - run `locations` to find the sandbox one");
  return id;
}

function assertLocalDbOrFlag() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  if (!isLocal && flags.get("allow-remote-db") !== "true") {
    throw new Error(
      `Supabase URL ${url} is not local. seed rewrites square_variation_id; pass --allow-remote-db only if you really mean it.`
    );
  }
}

/* ---------- helpers ---------- */

function poundsToMoney(pounds: number): Square.Money {
  return { amount: BigInt(Math.round(pounds * 100)), currency: CURRENCY };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

async function loadInstruments(): Promise<{ sessionId: number | string; instruments: Instrument[] }> {
  const supabase = createAdminClient();
  const sessionArg = flags.get("session");
  let sessionId: number | string | undefined = sessionArg;
  if (!sessionId) {
    const { data, error } = await supabase
      .from("market_sessions")
      .select("id")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No market_sessions row found - create a session in the admin first");
    sessionId = data.id;
  }
  const { data, error } = await supabase
    .from("market_instruments")
    .select("id, display_name, current_price, square_variation_id, square_original_price")
    .eq("session_id", sessionId);
  if (error) throw error;
  return { sessionId: sessionId!, instruments: (data ?? []) as Instrument[] };
}

/* ---------- commands ---------- */

async function locations() {
  const res = await squareClient.locations.list();
  for (const loc of res.locations ?? []) {
    console.log(`${loc.id}  ${loc.name ?? ""}  ${loc.status ?? ""}  ${loc.currency ?? ""}`);
  }
}

/* One ITEM + one ITEM_VARIATION per instrument. Temp ids ("#inst-<id>") map
   back via idMappings so we can persist the real sandbox variation id.
   Uses square_original_price where set so the seeded till price equals the
   pre-market price, matching what production looks like before a session. */
async function seed() {
  assertLocalDbOrFlag();
  const locationId = requireLocation();
  const { instruments } = await loadInstruments();
  if (instruments.length === 0) throw new Error("No instruments to seed");

  const objects: Square.CatalogObject[] = instruments.map((inst) => {
    const price = Number(inst.square_original_price ?? inst.current_price);
    return {
      type: "ITEM",
      id: `#inst-${inst.id}`,
      presentAtAllLocations: true,
      itemData: {
        name: inst.display_name,
        variations: [
          {
            type: "ITEM_VARIATION",
            id: `#var-${inst.id}`,
            presentAtAllLocations: true,
            itemVariationData: {
              itemId: `#inst-${inst.id}`,
              name: "Regular",
              pricingType: "FIXED_PRICING",
              priceMoney: poundsToMoney(price),
              /* trackInventory so `stock` + tick.ts's batchGetCounts have data. */
              trackInventory: true,
              /* Mirrors the production shape price-sync.ts overwrites (fact 4). */
              locationOverrides: [
                { locationId, priceMoney: poundsToMoney(price), pricingType: "FIXED_PRICING" },
              ],
            },
          },
        ],
      },
    };
  });

  const res = await squareClient.catalog.batchUpsert({
    idempotencyKey: randomUUID(),
    batches: [{ objects }],
  });

  const supabase = createAdminClient();
  let written = 0;
  for (const m of res.idMappings ?? []) {
    const match = m.clientObjectId?.match(/^#var-(\d+)$/);
    if (!match || !m.objectId) continue;
    const { error } = await supabase
      .from("market_instruments")
      .update({ square_variation_id: m.objectId })
      .eq("id", Number(match[1]));
    if (error) throw error;
    written += 1;
    console.log(`#${match[1]} -> ${m.objectId}`);
  }
  console.log(`Seeded ${objects.length} items, mapped ${written} variation ids`);
}

/* Sets an IN_STOCK physical count per variation so stockState logic runs. */
async function stock() {
  const locationId = requireLocation();
  const qty = num("qty", 40);
  const { instruments } = await loadInstruments();
  const occurredAt = new Date().toISOString();
  const changes: Square.InventoryChange[] = instruments
    .filter((i) => i.square_variation_id)
    .map((i) => ({
      type: "PHYSICAL_COUNT",
      physicalCount: {
        catalogObjectId: i.square_variation_id!,
        locationId,
        state: "IN_STOCK",
        quantity: String(qty),
        occurredAt,
      },
    }));
  if (changes.length === 0) throw new Error("No mapped variations - run seed first");
  await squareClient.inventory.batchCreateChanges({
    idempotencyKey: randomUUID(),
    changes,
    ignoreUnchangedCounts: true,
  });
  console.log(`Set ${changes.length} variations to ${qty} IN_STOCK`);
}

/* The actual "till": N rounds of 1-3 line items, paid by card or cash.
   --bias <instrumentId> makes one drink ~3x as popular so you can watch a
   single price climb. */
async function sell() {
  const locationId = requireLocation();
  const rounds = num("rounds", 20);
  const interval = num("interval", 3000);
  const cashRatio = Math.min(1, Math.max(0, num("cash", 0.3)));
  const bias = flags.get("bias");

  const { instruments } = await loadInstruments();
  const mapped = instruments.filter((i) => i.square_variation_id);
  if (mapped.length === 0) throw new Error("No mapped variations - run seed first");

  /* Weighted pool: biased instrument appears 3x. */
  const pool = mapped.flatMap((i) => (bias && String(i.id) === bias ? [i, i, i] : [i]));

  let sold = 0;
  let takings = 0;
  for (let round = 1; round <= rounds; round += 1) {
    const lines = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({
      instrument: pick(pool),
      quantity: 1 + Math.floor(Math.random() * 3),
    }));

    const orderRes = await squareClient.orders.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId,
        source: { name: "Square Point of Sale (simulated)" },
        lineItems: lines.map((l) => ({
          catalogObjectId: l.instrument.square_variation_id!,
          quantity: String(l.quantity),
        })),
      },
    });
    const order = orderRes.order;
    const total = order?.totalMoney;
    if (!order?.id || !total?.amount) throw new Error("Order create returned no id/total");

    const payCash = Math.random() < cashRatio;
    /* CASH needs buyerSuppliedMoney >= amount; card uses the sandbox nonce. */
    const payRes = await squareClient.payments.create({
      idempotencyKey: randomUUID(),
      sourceId: payCash ? "CASH" : "cnon:card-nonce-ok",
      amountMoney: total,
      orderId: order.id,
      locationId,
      autocomplete: true,
      ...(payCash
        ? { cashDetails: { buyerSuppliedMoney: { amount: total.amount, currency: CURRENCY } } }
        : {}),
    });

    const status = payRes.payment?.status;
    if (status !== "COMPLETED") throw new Error(`Payment ${payRes.payment?.id} status ${status}`);

    const units = lines.reduce((s, l) => s + l.quantity, 0);
    sold += units;
    takings += Number(total.amount) / 100;
    const desc = lines.map((l) => `${l.quantity}x ${l.instrument.display_name}`).join(", ");
    console.log(
      `[${round}/${rounds}] ${payCash ? "cash" : "card"} £${(Number(total.amount) / 100).toFixed(2)}  ${desc}`
    );

    if (round < rounds) await sleep(interval);
  }
  console.log(`Done: ${sold} units, £${takings.toFixed(2)} - run the market tick to see prices move`);
}

/* ---------- entry ---------- */

async function main() {
  assertSandbox();
  switch (command) {
    case "locations":
      return locations();
    case "seed":
      return seed();
    case "stock":
      return stock();
    case "sell":
      return sell();
    default:
      console.log(
        "commands: locations | seed [--session id] [--allow-remote-db] | stock [--qty n] | sell [--rounds n] [--interval ms] [--cash 0-1] [--bias instrumentId]"
      );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
