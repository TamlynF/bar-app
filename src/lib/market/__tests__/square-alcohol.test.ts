import { describe, expect, it } from "vitest";
import type { Square } from "square";
import { itemsNeedingAlcoholChange, planAlcoholByItem } from "../square-alcohol";

const itemIdByVariation = new Map([
  ["V-PINT", "I-GUINNESS"],
  ["V-HALF", "I-GUINNESS"],
  ["V-COKE", "I-COKE"],
  ["V-ODD1", "I-ODD"],
  ["V-ODD2", "I-ODD"],
]);

function item(id: string, isAlcoholic: boolean | undefined): Square.CatalogObject {
  return {
    type: "ITEM",
    id,
    version: BigInt(7),
    itemData: {
      name: id,
      isAlcoholic,
      variations: [{ type: "ITEM_VARIATION", id: `${id}-V`, itemVariationData: { name: "each" } }],
    },
  } as Square.CatalogObject;
}

describe("planAlcoholByItem", () => {
  it("gives each Square item its serves' flag", () => {
    const plan = planAlcoholByItem(
      [
        { variationId: "V-PINT", isAlcoholic: true },
        { variationId: "V-HALF", isAlcoholic: true },
        { variationId: "V-COKE", isAlcoholic: false },
      ],
      itemIdByVariation
    );
    expect(plan.desiredByItem).toEqual(
      new Map([
        ["I-GUINNESS", true],
        ["I-COKE", false],
      ])
    );
    expect(plan.conflictItemIds).toEqual([]);
  });

  it("leaves an item alone when its serves disagree", () => {
    const plan = planAlcoholByItem(
      [
        { variationId: "V-ODD1", isAlcoholic: true },
        { variationId: "V-ODD2", isAlcoholic: false },
      ],
      itemIdByVariation
    );
    expect(plan.desiredByItem.size).toBe(0);
    expect(plan.conflictItemIds).toEqual(["I-ODD"]);
  });

  it("skips serves whose variation Square no longer has", () => {
    const plan = planAlcoholByItem([{ variationId: "V-GONE", isAlcoholic: true }], itemIdByVariation);
    expect(plan.desiredByItem.size).toBe(0);
  });
});

describe("itemsNeedingAlcoholChange", () => {
  it("changes only items whose flag differs, keeping the rest of the item", () => {
    const desired = new Map([
      ["I-GUINNESS", true],
      ["I-COKE", false],
    ]);
    const changed = itemsNeedingAlcoholChange([item("I-GUINNESS", undefined), item("I-COKE", false)], desired);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe("I-GUINNESS");
    expect(changed[0].version).toBe(BigInt(7));
    expect(changed[0].itemData?.isAlcoholic).toBe(true);
    expect(changed[0].itemData?.variations).toHaveLength(1);
  });
});
