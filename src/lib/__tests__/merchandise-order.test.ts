import { describe, it, expect } from "vitest";
import {
  planSave,
  planDelete,
  describeChanges,
  nextPosition,
  type OrderRow,
} from "@/lib/merchandise-order";

function row(
  id: number,
  name: string,
  display_order: number,
  is_active = true
): OrderRow {
  return { id, name, display_order, is_active };
}

const ABC = [row(1, "A", 1), row(2, "B", 2), row(3, "C", 3)];

describe("planSave - creating", () => {
  it("appends a new active item after the last active one", () => {
    const plan = planSave(ABC, { id: null, isActive: true, targetPosition: null });
    expect(plan.position).toBe(4);
    expect(plan.changes).toEqual([]);
  });

  it("appends to an empty list at position 1", () => {
    const plan = planSave([], { id: null, isActive: true, targetPosition: null });
    expect(plan.position).toBe(1);
    expect(plan.changes).toEqual([]);
  });

  it("gives a new inactive item position 0", () => {
    const plan = planSave(ABC, { id: null, isActive: false, targetPosition: null });
    expect(plan.position).toBe(0);
    expect(plan.changes).toEqual([]);
  });

  it("ignores a requested position on create and still appends", () => {
    const plan = planSave(ABC, { id: null, isActive: true, targetPosition: 1 });
    expect(plan.position).toBe(4);
    expect(plan.changes).toEqual([]);
  });
});

describe("planSave - deactivating", () => {
  it("moves the row to 0 and closes the gap above it", () => {
    const plan = planSave(ABC, { id: 2, isActive: false, targetPosition: 2 });
    expect(plan.position).toBe(0);
    expect(plan.changes).toEqual([{ id: 3, display_order: 2 }]);
  });

  it("leaves rows below the deactivated one untouched", () => {
    const plan = planSave(ABC, { id: 3, isActive: false, targetPosition: 3 });
    expect(plan.position).toBe(0);
    expect(plan.changes).toEqual([]);
  });
});

describe("planSave - reactivating", () => {
  it("appends a previously inactive row to the end", () => {
    const rows = [row(1, "A", 1), row(3, "C", 2), row(2, "B", 0, false)];
    const plan = planSave(rows, { id: 2, isActive: true, targetPosition: 0 });
    expect(plan.position).toBe(3);
    expect(plan.changes).toEqual([]);
  });
});

describe("planSave - moving", () => {
  it("shifts rather than swaps when moving down", () => {
    const plan = planSave(ABC, { id: 1, isActive: true, targetPosition: 3 });
    expect(plan.position).toBe(3);
    expect(plan.changes).toEqual([
      { id: 2, display_order: 1 },
      { id: 3, display_order: 2 },
    ]);
  });

  it("shifts rather than swaps when moving up", () => {
    const plan = planSave(ABC, { id: 3, isActive: true, targetPosition: 1 });
    expect(plan.position).toBe(1);
    expect(plan.changes).toEqual([
      { id: 1, display_order: 2 },
      { id: 2, display_order: 3 },
    ]);
  });

  it("handles the adjacent move from the brief", () => {
    const plan = planSave(ABC, { id: 1, isActive: true, targetPosition: 2 });
    expect(plan.position).toBe(2);
    expect(plan.changes).toEqual([{ id: 2, display_order: 1 }]);
  });

  it("reports no changes when the position is unchanged", () => {
    const plan = planSave(ABC, { id: 2, isActive: true, targetPosition: 2 });
    expect(plan.position).toBe(2);
    expect(plan.changes).toEqual([]);
  });

  it("clamps a position above the active count", () => {
    const plan = planSave(ABC, { id: 1, isActive: true, targetPosition: 99 });
    expect(plan.position).toBe(3);
  });

  it("clamps a position below 1", () => {
    const plan = planSave(ABC, { id: 3, isActive: true, targetPosition: 0 });
    expect(plan.position).toBe(1);
  });

  it("falls back to appending when the position is not a number", () => {
    const plan = planSave(ABC, { id: 1, isActive: true, targetPosition: NaN });
    expect(plan.position).toBe(3);
  });
});

describe("planSave - self-healing", () => {
  it("renumbers gappy positions into a contiguous run", () => {
    const rows = [row(1, "A", 5), row(2, "B", 9), row(3, "C", 40)];
    const plan = planSave(rows, { id: 2, isActive: true, targetPosition: 2 });
    expect(plan.position).toBe(2);
    expect(plan.changes).toEqual([
      { id: 1, display_order: 1 },
      { id: 3, display_order: 3 },
    ]);
  });

  it("pulls a stray non-zero inactive row back to 0", () => {
    const rows = [row(1, "A", 1), row(2, "B", 7, false)];
    const plan = planSave(rows, { id: 1, isActive: true, targetPosition: 1 });
    expect(plan.changes).toEqual([{ id: 2, display_order: 0 }]);
  });

  it("is idempotent - a second identical save changes nothing", () => {
    const first = planSave(ABC, { id: 1, isActive: true, targetPosition: 3 });
    const settled: OrderRow[] = ABC.map((r) => {
      if (r.id === 1) return { ...r, display_order: first.position };
      const change = first.changes.find((c) => c.id === r.id);
      return change ? { ...r, display_order: change.display_order } : r;
    });

    const second = planSave(settled, { id: 1, isActive: true, targetPosition: 3 });
    expect(second.position).toBe(3);
    expect(second.changes).toEqual([]);
  });

  it("returns nothing to do when every row is inactive", () => {
    const rows = [row(1, "A", 0, false), row(2, "B", 0, false)];
    const plan = planSave(rows, { id: 1, isActive: false, targetPosition: null });
    expect(plan.position).toBe(0);
    expect(plan.changes).toEqual([]);
  });
});

describe("planDelete", () => {
  it("closes the gap left by a deleted row", () => {
    expect(planDelete(ABC, 1)).toEqual([
      { id: 2, display_order: 1 },
      { id: 3, display_order: 2 },
    ]);
  });

  it("changes nothing when the last row is deleted", () => {
    expect(planDelete(ABC, 3)).toEqual([]);
  });

  it("changes nothing when an inactive row is deleted", () => {
    const rows = [row(1, "A", 1), row(2, "B", 0, false)];
    expect(planDelete(rows, 2)).toEqual([]);
  });
});

describe("describeChanges", () => {
  it("maps changes back to names and old positions, ordered by new position", () => {
    const plan = planSave(ABC, { id: 1, isActive: true, targetPosition: 3 });
    expect(describeChanges(ABC, plan.changes)).toEqual([
      { id: 2, name: "B", from: 2, to: 1 },
      { id: 3, name: "C", from: 3, to: 2 },
    ]);
  });

  it("skips changes with no matching row", () => {
    expect(describeChanges(ABC, [{ id: 99, display_order: 1 }])).toEqual([]);
  });
});

describe("nextPosition", () => {
  it("counts only active rows", () => {
    const rows = [row(1, "A", 1), row(2, "B", 0, false), row(3, "C", 2)];
    expect(nextPosition(rows)).toBe(3);
  });

  it("starts at 1 for an empty list", () => {
    expect(nextPosition([])).toBe(1);
  });
});
