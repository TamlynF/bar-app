import { describe, expect, it } from "vitest";
import {
  isMixerList,
  isMixerListName,
  mixerChoiceFromRow,
  mixerListPrice,
  mixerServeLabel,
  resolveMixerPrice,
  serveMixerPrice,
  servedChangePct,
  servedEventPayload,
  squareMixerList,
  squareMixerPrice,
  withMixer,
  withMixerOrNull,
  type SquareModifierList,
} from "../mixer";

const mixers: SquareModifierList = { id: "ML1", name: "Mixers", modifierPrices: [1.25, 1.25, 1.25] };
const ice: SquareModifierList = { id: "ML2", name: "Ice & garnish", modifierPrices: [0, 0.5] };
const lists = new Map([
  [mixers.id, mixers],
  [ice.id, ice],
]);

describe("mixer list", () => {
  it("recognises the Mixer list by name", () => {
    expect(isMixerListName("Mixer")).toBe(true);
    expect(isMixerListName("Soft drink mixers")).toBe(true);
    expect(isMixerListName("Ice & garnish")).toBe(false);
    expect(isMixerListName(null)).toBe(false);
  });

  it("quotes the most common modifier price, the lower one on a tie", () => {
    expect(mixerListPrice([1.25, 1.25, 1.5])).toBe(1.25);
    expect(mixerListPrice([1.5, 1.25])).toBe(1.25);
    expect(mixerListPrice([])).toBeNull();
  });
});

describe("resolving a drink's mixer price", () => {
  it("uses Square's Mixer modifier when the item carries it", () => {
    expect(squareMixerPrice(["ML2", "ML1"], lists)).toBe(1.25);
    expect(resolveMixerPrice({ withMixer: false, squareMixerListIds: ["ML1"] }, lists, 1.5)).toBe(1.25);
  });

  it("falls back to the event price for a staff-flagged serve", () => {
    expect(resolveMixerPrice({ withMixer: true, squareMixerListIds: ["ML2"] }, lists, 1.5)).toBe(1.5);
  });

  it("is null for a drink sold on its own", () => {
    expect(resolveMixerPrice({ withMixer: false, squareMixerListIds: ["ML2"] }, lists, 1.25)).toBeNull();
  });
});

describe("choosing the mixer list", () => {
  const softs: SquareModifierList = { id: "ML3", name: "Soft drinks", modifierPrices: [1.25, 1.25] };
  const withSofts = new Map([...lists, [softs.id, softs]]);

  it("reads the saved setting, defaulting to automatic", () => {
    expect(mixerChoiceFromRow(null)).toEqual({ mode: "auto" });
    expect(mixerChoiceFromRow({ mixer_mode: "off" })).toEqual({ mode: "off" });
    expect(mixerChoiceFromRow({ mixer_mode: "list", mixer_modifier_list_id: "ML3", mixer_modifier_list_name: "Soft drinks" })).toEqual({
      mode: "list",
      listId: "ML3",
      listName: "Soft drinks",
    });
    expect(mixerChoiceFromRow({ mixer_mode: "list", mixer_modifier_list_id: null })).toEqual({ mode: "auto" });
  });

  it("uses a chosen list whatever it is called", () => {
    const choice = { mode: "list" as const, listId: "ML3", listName: "Soft drinks" };
    expect(isMixerList(softs, choice)).toBe(true);
    expect(isMixerList(mixers, choice)).toBe(false);
    expect(squareMixerPrice(["ML1", "ML3"], withSofts, choice)).toBe(1.25);
    expect(squareMixerPrice(["ML1"], withSofts, choice)).toBeNull();
  });

  it("ignores Square when switched off, leaving staff ticks", () => {
    const off = { mode: "off" as const };
    expect(squareMixerPrice(["ML1"], withSofts, off)).toBeNull();
    expect(resolveMixerPrice({ withMixer: true, squareMixerListIds: ["ML1"] }, withSofts, 1.25, off)).toBe(1.25);
  });

  it("matches by name only in automatic mode", () => {
    expect(squareMixerPrice(["ML3"], withSofts, { mode: "auto" })).toBeNull();
  });
});

describe("squareMixerList", () => {
  it("returns the item's mixer list for the current choice", () => {
    const withIds = new Map([[mixers.id, { ...mixers, modifierIds: ["M1", "M2"] }], [ice.id, ice]]);
    expect(squareMixerList(["ML2", "ML1"], withIds)?.modifierIds).toEqual(["M1", "M2"]);
    expect(squareMixerList(["ML2"], withIds)).toBeNull();
    expect(squareMixerList(["ML1"], withIds, { mode: "off" })).toBeNull();
  });
});

describe("serveMixerPrice", () => {
  it("prefers Square's price, then the event price for a ticked serve", () => {
    expect(serveMixerPrice({ squareMixerPrice: 1.5, withMixer: true }, 1.25)).toBe(1.5);
    expect(serveMixerPrice({ squareMixerPrice: null, withMixer: true }, 1.25)).toBe(1.25);
    expect(serveMixerPrice({ squareMixerPrice: null, withMixer: false }, 1.25)).toBeNull();
  });
});

describe("served prices", () => {
  it("adds the mixer to the spirit price", () => {
    expect(withMixer(5, 1.25)).toBe(6.25);
    expect(withMixer(3.5, null)).toBe(3.5);
    expect(withMixerOrNull(null, 1.25)).toBeNull();
  });

  it("states the change on what the customer pays", () => {
    expect(servedChangePct(5, 3.5, 1.25)).toBe(-24);
    expect(servedChangePct(5, 3.5, null)).toBe(-30);
  });

  it("labels the serve", () => {
    expect(mixerServeLabel("single", 1.25)).toBe("single + mixer");
    expect(mixerServeLabel("each", 1.25)).toBe("with mixer");
    expect(mixerServeLabel("single", null)).toBe("single");
  });
});

describe("served event payloads", () => {
  it("restates a price alert on spirit + mixer", () => {
    expect(servedEventPayload("price_drop", { serve: "single", from: 5, to: 3.5, pct: -30 }, 1.25)).toEqual({
      serve: "single + mixer",
      from: 6.25,
      to: 4.75,
      pct: -24,
    });
  });

  it("leaves tier fractions alone and restates the % without a base price", () => {
    expect(servedEventPayload("tier_down", { serve: "single", from: 0, to: -0.3, pct: -30 }, 1.25)).toEqual({
      serve: "single + mixer",
      from: 0,
      to: -0.3,
      pct: -30,
    });
  });

  it("scales a tier move to spirit + mixer, as the board's pill shows it", () => {
    expect(servedEventPayload("tier_down", { serve: "single", from: 0, to: -0.3, pct: -30 }, 1.25, 5)).toEqual({
      serve: "single + mixer",
      from: 0,
      to: -0.3,
      pct: -24,
    });
    expect(servedEventPayload("tier_up", { pct: 30 }, null, 5)).toEqual({ pct: 30 });
  });

  it("passes drinks without a mixer through untouched", () => {
    const payload = { serve: "pint", from: 5, to: 4, pct: -20 };
    expect(servedEventPayload("price_drop", payload, null)).toBe(payload);
  });
});
