/* Deletes the throwaway catalog items left behind by "Temp items" seeding in
   the Square SANDBOX.

   Why they pile up: seedSandboxCatalog only deletes the items recorded in
   market_instruments.sandbox_item_id, and only when seeding in temp mode. Seed
   once in temp mode and again with "Use mapped items" and that column is set
   back to null, so the first seed's items are orphaned - same drink name, a
   second (third, fourth) copy in the catalog, nothing pointing at them.

   What counts as an orphan here: an ITEM whose variations are referenced by
   NOTHING in menu_item_prices.square_variation_id, and whose name matches a
   drink that has traded on a market. A mapped item can never be a candidate,
   so the menu's real catalog links are safe even when the names collide.

   Usage (SQUARE_ENVIRONMENT=sandbox, SQUARE_ACCESS_TOKEN=<sandbox token>):
     npx jiti scripts/clean-sandbox-items.ts            # dry run, lists what would go
     npx jiti scripts/clean-sandbox-items.ts --delete   # actually deletes them
     npx jiti scripts/clean-sandbox-items.ts --delete --keep-newest

   --keep-newest leaves the most recently updated copy of each drink name in
   place, which is what you want if a live market is still pointed at one. */

import { config as loadEnv } from "dotenv";

/* Imports are hoisted, so src/lib/square would build its client before dotenv
   ran. Both clients are pulled in dynamically from main() instead. */
loadEnv({ path: ".env.local" });
loadEnv();

type SquareClient = (typeof import("../src/lib/square"))["squareClient"];
type AdminClient = ReturnType<(typeof import("../src/lib/supabase/admin"))["createAdminClient"]>;

const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith("--")));
const DELETE = flags.has("--delete");
const KEEP_NEWEST = flags.has("--keep-newest");
const DELETE_CHUNK = 200;

type Candidate = {
  itemId: string;
  name: string;
  variationIds: string[];
  updatedAt: string;
};

function assertSandbox() {
  if (process.env.SQUARE_ENVIRONMENT === "production") {
    throw new Error("Refusing to run: SQUARE_ENVIRONMENT is production. Point it at sandbox.");
  }
  if (!process.env.SQUARE_ACCESS_TOKEN) throw new Error("SQUARE_ACCESS_TOKEN missing");
}

async function mappedVariationIds(supabase: AdminClient) {
  const { data, error } = await supabase
    .from("menu_item_prices")
    .select("square_variation_id")
    .not("square_variation_id", "is", null);
  if (error) throw new Error(`menu_item_prices read failed: ${error.message}`);
  return new Set((data ?? []).map((row) => row.square_variation_id as string));
}

/* A live market seeded with temp items points at variations that are in no
   menu mapping, so they would otherwise read as orphans. Never delete the
   catalog out from under a market that is still trading. */
async function liveSessionObjectIds(supabase: AdminClient) {
  const { data: session } = await supabase
    .from("market_sessions")
    .select("id")
    .eq("status", "live")
    .maybeSingle();
  if (!session) return new Set<string>();
  const { data, error } = await supabase
    .from("market_instruments")
    .select("square_variation_id, sandbox_item_id")
    .eq("session_id", session.id);
  if (error) throw new Error(`live instruments read failed: ${error.message}`);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.square_variation_id) ids.add(row.square_variation_id as string);
    if (row.sandbox_item_id) ids.add(row.sandbox_item_id as string);
  }
  return ids;
}

async function marketDrinkNames(supabase: AdminClient) {
  const { data, error } = await supabase.from("market_instruments").select("display_name");
  if (error) throw new Error(`market_instruments read failed: ${error.message}`);
  return new Set((data ?? []).map((row) => (row.display_name as string).trim().toLowerCase()));
}

async function findCandidates(
  square: SquareClient,
  mapped: Set<string>,
  names: Set<string>
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const page = await square.catalog.list({ types: "ITEM" });
  for await (const obj of page) {
    if (obj.type !== "ITEM" || !obj.id || !obj.itemData?.name) continue;
    const variationIds = (obj.itemData.variations ?? [])
      .map((variation) => variation.id)
      .filter((id): id is string => Boolean(id));
    if (mapped.has(obj.id) || variationIds.some((id) => mapped.has(id))) continue;
    if (!names.has(obj.itemData.name.trim().toLowerCase())) continue;
    candidates.push({
      itemId: obj.id,
      name: obj.itemData.name,
      variationIds,
      updatedAt: obj.updatedAt ?? "",
    });
  }
  return candidates;
}

function groupByName(candidates: Candidate[]): Map<string, Candidate[]> {
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = candidate.name.trim().toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return groups;
}

async function deleteItems(square: SquareClient, itemIds: string[]): Promise<string[]> {
  const deleted: string[] = [];
  for (let i = 0; i < itemIds.length; i += DELETE_CHUNK) {
    const chunk = itemIds.slice(i, i + DELETE_CHUNK);
    const res = await square.catalog.batchDelete({ objectIds: chunk });
    deleted.push(...(res.deletedObjectIds ?? []));
  }
  return deleted;
}

async function main() {
  assertSandbox();
  const { squareClient } = await import("../src/lib/square");
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();

  const [menuMapped, liveIds, names] = await Promise.all([
    mappedVariationIds(supabase),
    liveSessionObjectIds(supabase),
    marketDrinkNames(supabase),
  ]);
  const mapped = new Set([...menuMapped, ...liveIds]);
  console.log(
    `Protecting ${menuMapped.size} mapped variations + ${liveIds.size} objects in use by the live market · matching against ${names.size} market drink names`
  );

  const candidates = await findCandidates(squareClient, mapped, names);
  if (candidates.length === 0) {
    console.log("Nothing to clean - no unmapped copies of a market drink in the sandbox catalog.");
    return;
  }

  const groups = groupByName(candidates);
  const doomed: Candidate[] = [];
  for (const group of groups.values()) {
    const [newest, ...rest] = group;
    const drop = KEEP_NEWEST ? rest : group;
    if (KEEP_NEWEST && rest.length === 0) continue;
    if (KEEP_NEWEST) console.log(`  keeping ${newest.name} (${newest.itemId})`);
    doomed.push(...drop);
  }

  console.log(`\n${doomed.length} item${doomed.length === 1 ? "" : "s"} to delete:`);
  for (const [name, group] of groups) {
    const count = doomed.filter((c) => c.name.trim().toLowerCase() === name).length;
    if (count > 0) console.log(`  ${group[0].name} × ${count}`);
  }

  if (!DELETE) {
    console.log("\nDry run. Re-run with --delete to remove them.");
    return;
  }

  const deleted = await deleteItems(squareClient, doomed.map((c) => c.itemId));
  console.log(`\nSquare deleted ${deleted.length} objects (items take their variations with them).`);

  const deletedSet = new Set(deleted);
  const stale = doomed.filter((c) => deletedSet.has(c.itemId)).map((c) => c.itemId);
  if (stale.length > 0) {
    const { error } = await supabase
      .from("market_instruments")
      .update({ sandbox_item_id: null })
      .in("sandbox_item_id", stale);
    if (error) console.error(`Could not clear sandbox_item_id: ${error.message}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
