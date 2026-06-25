import { describe, it, expect } from "vitest";
import {
  seatingApplies,
  computeAddSeat,
  pickSmallestFittingTable,
  pickTighterFreeTable,
  findUpsizeSwap,
  findDownsizeSwap,
  decideCreate,
  decideSizeChange,
  type FreeTable,
  type MappedBooking,
} from "@/lib/table-allocation";

// Small builders to keep the cases readable.
const t = (id: number, max_capacity: number): FreeTable => ({ id, max_capacity });
const mb = (
  bookingId: number,
  groupSize: number,
  tableId: number,
  tableCapacity: number
): MappedBooking => ({ bookingId, groupSize, tableId, tableCapacity });

describe("seatingApplies", () => {
  it("requires both seating_required and is_bookable", () => {
    expect(seatingApplies({ id: 1, seating_required: true, is_bookable: true })).toBe(true);
    expect(seatingApplies({ id: 1, seating_required: true, is_bookable: false })).toBe(false);
    expect(seatingApplies({ id: 1, seating_required: false, is_bookable: true })).toBe(false);
    expect(seatingApplies({ id: 1, seating_required: false, is_bookable: false })).toBe(false);
  });
});

describe("computeAddSeat", () => {
  it("is the overflow beyond capacity, never negative", () => {
    expect(computeAddSeat(5, 4)).toBe(1);
    expect(computeAddSeat(4, 4)).toBe(0);
    expect(computeAddSeat(2, 6)).toBe(0);
    expect(computeAddSeat(10, 6)).toBe(4);
  });
});

describe("pickSmallestFittingTable", () => {
  it("picks the smallest table that still seats the group", () => {
    const tables = [t(1, 10), t(2, 4), t(3, 6)];
    expect(pickSmallestFittingTable(tables, 5)?.id).toBe(3); // 6-seat is tightest fit for 5
    expect(pickSmallestFittingTable(tables, 4)?.id).toBe(2); // exact fit
    expect(pickSmallestFittingTable(tables, 2)?.id).toBe(2); // smallest overall
  });

  it("returns null when nothing fits", () => {
    expect(pickSmallestFittingTable([t(1, 2), t(2, 4)], 6)).toBeNull();
    expect(pickSmallestFittingTable([], 1)).toBeNull();
  });

  it("breaks capacity ties deterministically by lowest id", () => {
    const tables = [t(5, 6), t(2, 6), t(9, 6)];
    expect(pickSmallestFittingTable(tables, 4)?.id).toBe(2);
  });

  it("does not assume input ordering", () => {
    const tables = [t(1, 12), t(2, 8), t(3, 4), t(4, 6)];
    expect(pickSmallestFittingTable(tables, 5)?.id).toBe(4); // 6-seat
  });
});

describe("pickTighterFreeTable", () => {
  it("finds the tightest free table smaller than current that still fits", () => {
    // group dropped to 4, currently on a 10-seat; a free 6-seat is the tightest fit.
    const free = [t(1, 6), t(2, 8), t(3, 4)];
    // 4-seat (id 3) is tighter and fits 4 — closest to newSize.
    expect(pickTighterFreeTable(free, 4, 10)?.id).toBe(3);
  });

  it("requires the table to be strictly smaller than current capacity", () => {
    const free = [t(1, 10), t(2, 12)]; // none smaller than 10
    expect(pickTighterFreeTable(free, 4, 10)).toBeNull();
  });

  it("requires the table to still seat the group", () => {
    const free = [t(1, 6), t(2, 5)];
    // newSize 6: the 5-seat is too small; 6-seat fits and is tighter than 10.
    expect(pickTighterFreeTable(free, 6, 10)?.id).toBe(1);
  });

  it("steps up to the next higher free capacity when the lowest isn't available, capped below current", () => {
    // group dropped to 4 from a 10-seat; no free 4/5-seat, so take the 6-seat
    // (lowest available that fits) — never the 8 over the 6, never >= current 10.
    const free = [t(1, 8), t(2, 6)];
    expect(pickTighterFreeTable(free, 4, 10)?.id).toBe(2);
  });

  it("never picks a table larger than the current one", () => {
    // newSize fits these, but both are >= current capacity → keep current (null)
    const free = [t(1, 10), t(2, 12)];
    expect(pickTighterFreeTable(free, 4, 8)).toBeNull();
  });

  it("returns null when no tighter fitting table exists", () => {
    expect(pickTighterFreeTable([], 4, 10)).toBeNull();
  });
});

describe("findUpsizeSwap (3a.2)", () => {
  it("swaps with a smaller group sitting on a bigger, fitting table", () => {
    // current: group now 6 on a 6-seat table -> still fits? No: newSize 8 > cap 6.
    const current = mb(1, 6, 100, 6);
    const candidates = [
      mb(2, 4, 200, 10), // smaller group on a 10-seat that fits 8, and 4 fits current's 6 -> valid
      mb(3, 9, 300, 12), // group too large (9 >= 8) -> invalid
    ];
    const swap = findUpsizeSwap(current, candidates, 8);
    expect(swap?.bookingId).toBe(2);
  });

  it("requires the other booking to still fit current's table", () => {
    const current = mb(1, 5, 100, 6);
    const candidates = [mb(2, 7, 200, 10)]; // 7 > current cap 6 -> can't move here
    expect(findUpsizeSwap(current, candidates, 8)).toBeNull();
  });

  it("requires the swapped table to be bigger than current and fit newSize", () => {
    const current = mb(1, 5, 100, 6);
    const candidates = [mb(2, 3, 200, 6)]; // same capacity, not bigger
    expect(findUpsizeSwap(current, candidates, 8)).toBeNull();
  });

  it("picks the smallest qualifying table deterministically", () => {
    const current = mb(1, 6, 100, 6);
    const candidates = [
      mb(2, 4, 200, 12),
      mb(3, 4, 300, 8), // smallest table that still fits 8
      mb(4, 4, 400, 10),
    ];
    expect(findUpsizeSwap(current, candidates, 8)?.bookingId).toBe(3);
  });

  it("returns null when no neighbour qualifies", () => {
    const current = mb(1, 6, 100, 6);
    expect(findUpsizeSwap(current, [], 8)).toBeNull();
  });
});

describe("findDownsizeSwap (3b.2)", () => {
  it("hands the big table to a larger group on a tighter table", () => {
    // current: 8 -> 4 on a 10-seat. B is 6 people on a 6-seat.
    const current = mb(1, 8, 100, 10);
    const candidates = [mb(2, 6, 200, 6)];
    const swap = findDownsizeSwap(current, candidates, 4);
    expect(swap?.bookingId).toBe(2); // B takes the 10-seat, A takes the 6-seat
  });

  it("requires B to be a larger group than the new size", () => {
    const current = mb(1, 8, 100, 10);
    const candidates = [mb(2, 4, 200, 6)]; // B group 4 is not > newSize 4
    expect(findDownsizeSwap(current, candidates, 4)).toBeNull();
  });

  it("requires B's table to be tighter than current and still fit newSize", () => {
    const current = mb(1, 8, 100, 10);
    const candidates = [
      mb(2, 9, 200, 12), // table bigger than current -> invalid
      mb(3, 5, 300, 3), // table too small for newSize 4 -> invalid
    ];
    expect(findDownsizeSwap(current, candidates, 4)).toBeNull();
  });

  it("picks the table closest to newSize deterministically", () => {
    const current = mb(1, 9, 100, 12);
    const candidates = [
      mb(2, 8, 200, 8),
      mb(3, 7, 300, 6), // closest to newSize 4
      mb(4, 8, 400, 10),
    ];
    expect(findDownsizeSwap(current, candidates, 4)?.bookingId).toBe(3);
  });
});

describe("decideCreate", () => {
  it("confirms onto the tightest fitting table", () => {
    // tightest fit for 5 is the 6-seat (id 2)
    const res = decideCreate([t(1, 10), t(2, 6), t(3, 4)], 5);
    expect(res).toEqual({ status: "confirmed", table: { id: 2, max_capacity: 6 } });
  });

  it("waitlists when no table fits", () => {
    expect(decideCreate([t(1, 2), t(2, 4)], 6)).toEqual({ status: "waitlisted" });
    expect(decideCreate([], 1)).toEqual({ status: "waitlisted" });
  });
});

describe("decideSizeChange — increase (3a)", () => {
  const booking = mb(1, 4, 100, 6); // 4 people on a 6-seat

  it("keeps the table when the new size still fits", () => {
    const res = decideSizeChange(booking, 6, [t(2, 10)], []);
    expect(res).toEqual({ outcome: "kept", tableId: 100, addSeat: 0 });
  });

  it("reassigns to a free bigger table when it overflows", () => {
    const res = decideSizeChange(booking, 8, [t(2, 8), t(3, 12)], []);
    expect(res).toEqual({ outcome: "reassigned", tableId: 2, addSeat: 0 });
  });

  it("swaps when no free table fits but a neighbour's does", () => {
    const candidates = [mb(2, 3, 200, 10)]; // smaller group on a 10-seat
    const res = decideSizeChange(booking, 8, [], candidates);
    expect(res).toEqual({
      outcome: "swapped",
      tableId: 200,
      addSeat: 0,
      swappedBookingId: 2,
      swappedToTableId: 100,
    });
  });

  it("returns no_space when neither a free table nor a swap exists", () => {
    const candidates = [mb(2, 9, 200, 10)]; // neighbour group too big to move off
    const res = decideSizeChange(booking, 8, [], candidates);
    expect(res).toEqual({ outcome: "no_space" });
  });
});

describe("decideSizeChange — decrease (3b)", () => {
  const booking = mb(1, 8, 100, 10); // 8 people on a 10-seat, dropping

  it("relocates to a tighter free table (worked example)", () => {
    // drops to 4; a free 6-seat is the tightest fit -> move there, free the 10.
    const res = decideSizeChange(booking, 4, [t(2, 6), t(3, 8)], []);
    expect(res).toEqual({ outcome: "reassigned", tableId: 2, addSeat: 0 });
  });

  it("tightens via swap when no free tighter table exists", () => {
    // no free table; B is 6 people on a 6-seat -> B takes the 10, A takes the 6.
    const candidates = [mb(2, 6, 200, 6)];
    const res = decideSizeChange(booking, 4, [], candidates);
    expect(res).toEqual({
      outcome: "swapped",
      tableId: 200,
      addSeat: 0,
      swappedBookingId: 2,
      swappedToTableId: 100,
    });
  });

  it("keeps the current table when nothing tighter is free or swappable", () => {
    // no free table, and the only neighbour is a smaller group -> stay put.
    const candidates = [mb(2, 3, 200, 6)];
    const res = decideSizeChange(booking, 4, [], candidates);
    expect(res).toEqual({ outcome: "kept", tableId: 100, addSeat: 0 });
  });
});

describe("decideSizeChange — unchanged size", () => {
  it("keeps the table and recomputes add_seat", () => {
    const booking = mb(1, 8, 100, 6); // overflowing table
    const res = decideSizeChange(booking, 8, [], []);
    expect(res).toEqual({ outcome: "kept", tableId: 100, addSeat: 2 });
  });
});
