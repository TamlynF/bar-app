import { describe, it, expect } from "vitest";
import { planServeWrites, type StoredServe } from "@/lib/menu-price";

function stored(overrides: Partial<StoredServe> & Pick<StoredServe, "id" | "serve">): StoredServe {
  return { amount: 5, display_order: 1, show_on_menu: true, ...overrides };
}

describe("planServeWrites", () => {
  it("keeps the row of a serve whose price changed", () => {
    const plan = planServeWrites([stored({ id: 1, serve: "pint", amount: 5 })], [{ serve: "pint", amount: 5.5 }]);
    expect(plan).toEqual({
      updates: [{ id: 1, amount: 5.5, display_order: 1, show_on_menu: true }],
      inserts: [],
      deletes: [],
    });
  });

  it("writes nothing when the editor sends the serves unchanged", () => {
    const plan = planServeWrites(
      [stored({ id: 1, serve: "pint", amount: 5, display_order: 1 }), stored({ id: 2, serve: "half pint", amount: 3, display_order: 2 })],
      [
        { serve: "pint", amount: 5 },
        { serve: "half pint", amount: 3 },
      ]
    );
    expect(plan).toEqual({ updates: [], inserts: [], deletes: [] });
  });

  it("reads amounts that arrive as strings", () => {
    const plan = planServeWrites(
      [stored({ id: 1, serve: "pint", amount: "5.00" as unknown as number })],
      [{ serve: "pint", amount: 5 }]
    );
    expect(plan.updates).toEqual([]);
  });

  it("inserts new serves, deletes dropped ones and follows the editor's order", () => {
    const plan = planServeWrites(
      [stored({ id: 1, serve: "pint", display_order: 1 }), stored({ id: 2, serve: "half pint", display_order: 2 })],
      [
        { serve: "bottle", amount: 4 },
        { serve: "pint", amount: 5 },
      ]
    );
    expect(plan.inserts).toEqual([{ serve: "bottle", amount: 4, display_order: 1, show_on_menu: true }]);
    expect(plan.updates).toEqual([{ id: 1, amount: 5, display_order: 2, show_on_menu: true }]);
    expect(plan.deletes).toEqual([2]);
  });

  it("leaves serves hidden from the menu alone", () => {
    const plan = planServeWrites(
      [stored({ id: 1, serve: "pint" }), stored({ id: 9, serve: "pitcher", amount: 15, show_on_menu: false })],
      [{ serve: "pint", amount: 5 }]
    );
    expect(plan).toEqual({ updates: [], inserts: [], deletes: [] });
  });

  it("brings a hidden serve back onto the menu when the editor lists it", () => {
    const plan = planServeWrites(
      [stored({ id: 9, serve: "bottle", amount: 15, show_on_menu: false, display_order: 4 })],
      [{ serve: "bottle", amount: 16 }]
    );
    expect(plan).toEqual({
      updates: [{ id: 9, amount: 16, display_order: 1, show_on_menu: true }],
      inserts: [],
      deletes: [],
    });
  });

  it("keeps a serve hidden when the editor says so", () => {
    const plan = planServeWrites(
      [stored({ id: 9, serve: "pitcher", amount: 15, show_on_menu: false })],
      [{ serve: "pitcher", amount: 15, show_on_menu: false }]
    );
    expect(plan).toEqual({ updates: [], inserts: [], deletes: [] });
  });

  it("hides a listed serve and inserts a hidden one", () => {
    const plan = planServeWrites(
      [stored({ id: 1, serve: "pint", amount: 5 })],
      [
        { serve: "pint", amount: 5, show_on_menu: false },
        { serve: "pitcher", amount: 15, show_on_menu: false },
      ]
    );
    expect(plan.updates).toEqual([{ id: 1, amount: 5, display_order: 1, show_on_menu: false }]);
    expect(plan.inserts).toEqual([{ serve: "pitcher", amount: 15, display_order: 2, show_on_menu: false }]);
  });

  it("deletes a hidden serve the full set leaves out", () => {
    const plan = planServeWrites(
      [stored({ id: 1, serve: "pint" }), stored({ id: 9, serve: "pitcher", show_on_menu: false })],
      [{ serve: "pint", amount: 5 }],
      { fullSet: true }
    );
    expect(plan.deletes).toEqual([9]);
  });

  it("deletes every listed serve when the editor sends none", () => {
    const plan = planServeWrites([stored({ id: 1, serve: "pint" }), stored({ id: 2, serve: "half pint" })], []);
    expect(plan.deletes).toEqual([1, 2]);
  });
});
