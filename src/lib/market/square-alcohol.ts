import type { Square } from "square";
import { squareClient } from "@/lib/square";

/* Copies each menu category's alcohol tick onto the Square items its linked
   serves belong to. Square has no sparse update for an ITEM: an upsert must
   carry the whole item, variations included, or the missing variations are
   deleted. So every item is re-read and sent back with only is_alcoholic
   changed, which also re-sends the variations' current prices - callers
   must refuse while a market is live. */

export type ServeAlcoholRow = { variationId: string; isAlcoholic: boolean };

export type AlcoholPlan = {
  desiredByItem: Map<string, boolean>;
  conflictItemIds: string[];
};

/* One flag per Square item. Serves of one item normally share a category;
   if they disagree the item is left alone rather than guessed. */
export function planAlcoholByItem(
  serves: ServeAlcoholRow[],
  itemIdByVariation: Map<string, string>
): AlcoholPlan {
  const seen = new Map<string, Set<boolean>>();
  for (const serve of serves) {
    const itemId = itemIdByVariation.get(serve.variationId);
    if (!itemId) continue;
    const flags = seen.get(itemId) ?? new Set<boolean>();
    flags.add(serve.isAlcoholic);
    seen.set(itemId, flags);
  }
  const desiredByItem = new Map<string, boolean>();
  const conflictItemIds: string[] = [];
  for (const [itemId, flags] of seen) {
    if (flags.size > 1) conflictItemIds.push(itemId);
    else desiredByItem.set(itemId, [...flags][0]);
  }
  return { desiredByItem, conflictItemIds };
}

type ItemObject = Extract<Square.CatalogObject, { type: "ITEM" }>;

export function itemsNeedingAlcoholChange(
  items: Square.CatalogObject[],
  desiredByItem: Map<string, boolean>
): ItemObject[] {
  return items.flatMap((obj) => {
    if (obj.type !== "ITEM" || !obj.id || !obj.itemData) return [];
    const desired = desiredByItem.get(obj.id);
    if (desired === undefined || Boolean(obj.itemData.isAlcoholic) === desired) return [];
    return [{ ...obj, itemData: { ...obj.itemData, isAlcoholic: desired } }];
  });
}

export type AlcoholPushResult = {
  updated: number;
  alreadyRight: number;
  conflicts: number;
  missing: number;
  failed: { name: string; message: string }[];
};

const GET_LIMIT = 1000;
const WRITE_BATCH = 10;

async function batchGet(ids: string[]): Promise<Square.CatalogObject[]> {
  const objects: Square.CatalogObject[] = [];
  for (let i = 0; i < ids.length; i += GET_LIMIT) {
    const res = await squareClient.catalog.batchGet({
      objectIds: ids.slice(i, i + GET_LIMIT),
      includeRelatedObjects: false,
      includeDeletedObjects: false,
    });
    objects.push(...(res.objects ?? []));
  }
  return objects;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function pushAlcoholFlagsToSquare(
  serves: ServeAlcoholRow[],
  idempotencyBase: string
): Promise<AlcoholPushResult> {
  const result: AlcoholPushResult = { updated: 0, alreadyRight: 0, conflicts: 0, missing: 0, failed: [] };
  const variationIds = [...new Set(serves.map((serve) => serve.variationId))];
  if (variationIds.length === 0) return result;

  const itemIdByVariation = new Map<string, string>();
  for (const obj of await batchGet(variationIds)) {
    if (obj.type === "ITEM_VARIATION" && obj.id && obj.itemVariationData?.itemId) {
      itemIdByVariation.set(obj.id, obj.itemVariationData.itemId);
    }
  }
  result.missing = variationIds.filter((id) => !itemIdByVariation.has(id)).length;

  const plan = planAlcoholByItem(serves, itemIdByVariation);
  result.conflicts = plan.conflictItemIds.length;

  const items = await batchGet([...plan.desiredByItem.keys()]);
  const changes = itemsNeedingAlcoholChange(items, plan.desiredByItem);
  result.alreadyRight = plan.desiredByItem.size - changes.length;

  for (let i = 0; i < changes.length; i += WRITE_BATCH) {
    const batch = changes.slice(i, i + WRITE_BATCH);
    try {
      await squareClient.catalog.batchUpsert({
        idempotencyKey: `${idempotencyBase}-${i / WRITE_BATCH}`,
        batches: [{ objects: batch }],
      });
      result.updated += batch.length;
    } catch (err) {
      const message = errorMessage(err);
      result.failed.push(...batch.map((item) => ({ name: item.itemData?.name ?? item.id ?? "item", message })));
    }
  }
  return result;
}
