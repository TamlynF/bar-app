import { describe, expect, it } from "vitest";
import { isStockTrackedAt } from "../square-stock-tracking";

describe("isStockTrackedAt", () => {
  it("follows the variation's own flag", () => {
    expect(isStockTrackedAt({ trackInventory: true }, "LOC1")).toBe(true);
    expect(isStockTrackedAt({ trackInventory: false }, "LOC1")).toBe(false);
  });

  it("treats an unset flag as not tracked", () => {
    expect(isStockTrackedAt({}, "LOC1")).toBe(false);
    expect(isStockTrackedAt(undefined, "LOC1")).toBe(false);
  });

  it("lets this location's override win", () => {
    const variation = {
      trackInventory: true,
      locationOverrides: [
        { locationId: "LOC2", trackInventory: true },
        { locationId: "LOC1", trackInventory: false },
      ],
    };
    expect(isStockTrackedAt(variation, "LOC1")).toBe(false);
    expect(isStockTrackedAt(variation, "LOC2")).toBe(true);
    expect(isStockTrackedAt({ trackInventory: false, locationOverrides: [{ locationId: "LOC1", trackInventory: true }] }, "LOC1")).toBe(true);
  });

  it("ignores an override that does not set tracking", () => {
    expect(isStockTrackedAt({ trackInventory: true, locationOverrides: [{ locationId: "LOC1" }] }, "LOC1")).toBe(true);
  });
});
