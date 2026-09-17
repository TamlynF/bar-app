import { describe, expect, it } from "vitest";
import { eventReadiness, readinessParts } from "../market/event-readiness";

const base = {
  menuItemPriceIds: [1, 2, 3],
  tradeableIds: [1, 2, 3],
  linkedIds: [1, 2, 3],
  normalsReadIds: [1, 2, 3],
  normalsComputedAt: "2026-09-10T10:00:00Z",
  pricingMode: "tiers" as const,
};

describe("eventReadiness", () => {
  it("is ready and can open when every step is done", () => {
    const r = eventReadiness(base);
    expect(r.canOpen).toBe(true);
    expect(r.ready).toBe(true);
    expect(r.steps).toEqual({ drinks: "done", links: "done", normals: "done" });
  });

  it("cannot open with no drinks", () => {
    const r = eventReadiness({ ...base, menuItemPriceIds: [] });
    expect(r.canOpen).toBe(false);
    expect(r.steps.drinks).toBe("todo");
    expect(r.steps.links).toBe("todo");
  });

  it("cannot open when none of the drinks is tradeable", () => {
    const r = eventReadiness({ ...base, tradeableIds: [] });
    expect(r.canOpen).toBe(false);
    expect(r.tradeable).toBe(0);
  });

  it("can open but is not ready with partial Square links", () => {
    const r = eventReadiness({ ...base, linkedIds: [1] });
    expect(r.canOpen).toBe(true);
    expect(r.ready).toBe(false);
    expect(r.linked).toBe(1);
    expect(r.steps.links).toBe("todo");
  });

  it("needs normal sales under tier pricing", () => {
    const r = eventReadiness({ ...base, normalsReadIds: [], normalsComputedAt: null });
    expect(r.steps.normals).toBe("todo");
    expect(r.ready).toBe(false);
  });

  it("treats normal sales as optional under demand pricing", () => {
    const r = eventReadiness({ ...base, pricingMode: "demand", normalsReadIds: [], normalsComputedAt: null });
    expect(r.steps.normals).toBe("optional");
    expect(r.ready).toBe(true);
  });

  it("only counts ids that are on the event", () => {
    const r = eventReadiness({ ...base, menuItemPriceIds: [1], linkedIds: [2, 3] });
    expect(r.drinks).toBe(1);
    expect(r.linked).toBe(0);
  });
});

describe("readinessParts", () => {
  it("names what is missing", () => {
    const r = eventReadiness({ ...base, linkedIds: [1], normalsReadIds: [], normalsComputedAt: null });
    expect(readinessParts(r)).toEqual(["3 drinks", "2 not linked", "sales not read"]);
  });

  it("reads clean when everything is done", () => {
    expect(readinessParts(eventReadiness(base))).toEqual(["3 drinks", "all linked to Square"]);
  });
});
