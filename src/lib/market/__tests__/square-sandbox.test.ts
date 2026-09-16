import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/square", () => ({ squareClient: {} }));

import { assertSandbox, inventoryAdditionChange, squareSimEnvironment } from "../square-sandbox";

const ENV_KEYS = ["SQUARE_ENVIRONMENT", "SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("inventoryAdditionChange", () => {
  it("builds an additive NONE → IN_STOCK adjustment with a whole quantity", () => {
    const change = inventoryAdditionChange("LOC", "VAR", 12.7, "2026-09-17T10:00:00.000Z");
    expect(change).toEqual({
      type: "ADJUSTMENT",
      adjustment: {
        catalogObjectId: "VAR",
        fromState: "NONE",
        toState: "IN_STOCK",
        fromLocationId: "LOC",
        toLocationId: "LOC",
        quantity: "12",
        occurredAt: "2026-09-17T10:00:00.000Z",
      },
    });
  });
});

describe("assertSandbox", () => {
  it("refuses production outright", () => {
    process.env.SQUARE_ENVIRONMENT = "production";
    process.env.SQUARE_ACCESS_TOKEN = "t";
    process.env.SQUARE_LOCATION_ID = "L";
    expect(assertSandbox()).toHaveProperty("error");
  });

  it("needs a token and a location in sandbox", () => {
    process.env.SQUARE_ENVIRONMENT = "sandbox";
    expect(assertSandbox()).toHaveProperty("error");
    process.env.SQUARE_ACCESS_TOKEN = "t";
    expect(assertSandbox()).toHaveProperty("error");
    process.env.SQUARE_LOCATION_ID = "L";
    expect(assertSandbox()).toEqual({ locationId: "L" });
  });
});

describe("squareSimEnvironment", () => {
  it("only counts as sandbox when a token is present", () => {
    process.env.SQUARE_ENVIRONMENT = "sandbox";
    expect(squareSimEnvironment().isSandbox).toBe(false);
    process.env.SQUARE_ACCESS_TOKEN = "t";
    expect(squareSimEnvironment().isSandbox).toBe(true);
    process.env.SQUARE_ENVIRONMENT = "production";
    expect(squareSimEnvironment().environment).toBe("production");
    expect(squareSimEnvironment().isSandbox).toBe(false);
  });
});
