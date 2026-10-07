import { describe, expect, it } from "vitest";
import { activeFilterCount, applyDrinkFilters, DEFAULT_FILTERS, EMPTY_FILTERS, isFiltered } from "@/app/(public)/market/drink-filters";
import type { MarketInstrumentPayload } from "../tick";

const drink = (over: Partial<MarketInstrumentPayload>): MarketInstrumentPayload =>
  ({
    id: 1,
    name: "Grey Goose",
    serve: "single + mixer",
    category: "Vodka",
    stock: "ok",
    tierPct: 0,
    changePct: 0,
    ...over,
  }) as MarketInstrumentPayload;

const board = [
  drink({ id: 1, name: "Grey Goose", category: "Vodka", tierPct: -0.3, changePct: -21.6 }),
  drink({ id: 2, name: "Beefeater Dry", serve: "double + mixer", category: "Gin", stock: "out" }),
  drink({ id: 3, name: "Hooch", serve: "each", category: "Alcopops", changePct: 10 }),
];

describe("applyDrinkFilters", () => {
  it("shows everything with no filters", () => {
    expect(applyDrinkFilters(board, EMPTY_FILTERS, []).map((d) => d.id)).toEqual([1, 2, 3]);
  });

  it("searches name, serve and category, ignoring case", () => {
    expect(applyDrinkFilters(board, { ...EMPTY_FILTERS, query: "gin" }, []).map((d) => d.id)).toEqual([2]);
    expect(applyDrinkFilters(board, { ...EMPTY_FILTERS, query: "DOUBLE" }, []).map((d) => d.id)).toEqual([2]);
    expect(applyDrinkFilters(board, { ...EMPTY_FILTERS, query: "hoo" }, []).map((d) => d.id)).toEqual([3]);
  });

  it("hides sold out, keeps deals, and narrows to watched", () => {
    expect(applyDrinkFilters(board, { ...EMPTY_FILTERS, hideSoldOut: true }, []).map((d) => d.id)).toEqual([1, 3]);
    expect(applyDrinkFilters(board, { ...EMPTY_FILTERS, dealsOnly: true }, []).map((d) => d.id)).toEqual([1]);
    expect(applyDrinkFilters(board, { ...EMPTY_FILTERS, watchedOnly: true }, [3]).map((d) => d.id)).toEqual([3]);
  });

  it("combines filters", () => {
    const filters = { query: "e", hideSoldOut: true, dealsOnly: true, watchedOnly: false };
    expect(applyDrinkFilters(board, filters, []).map((d) => d.id)).toEqual([1]);
    expect(activeFilterCount(filters)).toBe(1);
  });

  it("hides sold out by default and only counts changes from that", () => {
    expect(applyDrinkFilters(board, DEFAULT_FILTERS, []).map((d) => d.id)).toEqual([1, 3]);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, hideSoldOut: false })).toBe(1);
    expect(isFiltered({ ...DEFAULT_FILTERS, query: "gin" })).toBe(true);
  });
});
