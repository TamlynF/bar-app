import type { PricingMode } from "./types";

/* What still stands between a stock market event and its first tick. Only
   the drinks step is a hard gate (openStockMarketEventAction refuses an event
   with nothing tradeable); the other two are strongly advised, because an
   unlinked serve never sees till demand and unread normals fall back to the
   pace floor, but neither stops the market opening. */

export type ReadinessStep = "done" | "todo" | "optional";

export type EventReadiness = {
  drinks: number;
  tradeable: number;
  linked: number;
  normalsRead: number;
  normalsComputedAt: string | null;
  canOpen: boolean;
  ready: boolean;
  steps: { drinks: ReadinessStep; links: ReadinessStep; normals: ReadinessStep };
};

type IdSet = Set<number> | number[];

function toSet(ids: IdSet): Set<number> {
  return ids instanceof Set ? ids : new Set(ids);
}

export function eventReadiness({
  menuItemPriceIds,
  tradeableIds,
  linkedIds,
  normalsReadIds,
  normalsComputedAt,
  pricingMode,
}: {
  menuItemPriceIds: number[];
  tradeableIds: IdSet;
  linkedIds: IdSet;
  normalsReadIds: IdSet;
  normalsComputedAt: string | null;
  pricingMode: PricingMode;
}): EventReadiness {
  const ids = [...new Set(menuItemPriceIds)];
  const tradeable = toSet(tradeableIds);
  const linked = toSet(linkedIds);
  const normals = toSet(normalsReadIds);

  const drinks = ids.length;
  const tradeableCount = ids.filter((id) => tradeable.has(id)).length;
  const linkedCount = ids.filter((id) => linked.has(id)).length;
  const normalsReadCount = ids.filter((id) => normals.has(id)).length;
  const normalsDone = normalsReadCount > 0 && normalsComputedAt != null;

  const steps: EventReadiness["steps"] = {
    drinks: tradeableCount > 0 ? "done" : "todo",
    links: drinks > 0 && linkedCount === drinks ? "done" : "todo",
    normals: normalsDone ? "done" : pricingMode === "demand" ? "optional" : "todo",
  };

  return {
    drinks,
    tradeable: tradeableCount,
    linked: linkedCount,
    normalsRead: normalsReadCount,
    normalsComputedAt,
    canOpen: tradeableCount > 0,
    ready: Object.values(steps).every((step) => step !== "todo"),
    steps,
  };
}

/* The one-line summary a list row shows: what is on the board and what is
   still missing, in the order the checklist walks through it. */
export function readinessParts(readiness: EventReadiness): string[] {
  const parts = [`${readiness.drinks} ${readiness.drinks === 1 ? "drink" : "drinks"}`];
  if (readiness.drinks > 0) {
    parts.push(
      readiness.linked === readiness.drinks
        ? "all linked to Square"
        : `${readiness.drinks - readiness.linked} not linked`
    );
  }
  if (readiness.steps.normals === "todo") parts.push("sales not read");
  return parts;
}
