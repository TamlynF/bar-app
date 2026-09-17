import { describe, it, expect } from "vitest";
import { itemIdsToDelete, planSandboxSeed } from "../square-sandbox";

type Row = Parameters<typeof planSandboxSeed>[0][number];

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 1,
    display_name: "Hawkstone Cider",
    serve: "pint",
    base_price: 5.25,
    opening_price: 5.25,
    sandbox_item_id: null,
    menu_variation_id: null,
    ...overrides,
  };
}

describe("planSandboxSeed", () => {
  it("reuses the menu's variation when one is mapped", () => {
    const plan = planSandboxSeed([row({ menu_variation_id: "VAR_REAL" })], "reuse");
    expect(plan).toEqual([{ instrumentId: 1, action: "reuse", variationId: "VAR_REAL" }]);
  });

  it("creates a temporary item for a drink with no mapping", () => {
    const plan = planSandboxSeed([row()], "reuse");
    expect(plan).toEqual([{ instrumentId: 1, action: "create" }]);
  });

  it("ignores mappings in temp mode so every drink is recreated", () => {
    const plan = planSandboxSeed([row({ menu_variation_id: "VAR_REAL" })], "temp");
    expect(plan).toEqual([{ instrumentId: 1, action: "create" }]);
  });
});

describe("itemIdsToDelete", () => {
  it("returns previously seeded items in temp mode", () => {
    const rows = [row({ id: 1, sandbox_item_id: "ITEM_A" }), row({ id: 2, sandbox_item_id: null })];
    expect(itemIdsToDelete(rows, "temp")).toEqual(["ITEM_A"]);
  });

  it("never deletes anything in reuse mode", () => {
    const rows = [row({ sandbox_item_id: "ITEM_A" })];
    expect(itemIdsToDelete(rows, "reuse")).toEqual([]);
  });
});
