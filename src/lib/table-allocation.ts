/**
 * Centralised, single-source-of-truth table-allocation logic for seated bookings.
 *
 * Every booking flow (create / update size / status change / admin table-edit,
 * public + admin, quiz / event / bingo / general) routes through this module so
 * the seating algorithm stays consistent. See `table-allocation-prompt.md` for
 * the full ruleset; the pure decision helpers below are unit-tested in
 * `src/lib/__tests__/table-allocation.test.ts`.
 *
 * This only governs bookings whose linked event has `seating_required = true`
 * AND `is_bookable = true` (see `seatingApplies`). For any other event, seating
 * logic is skipped and the booking is confirmed as-is.
 *
 * Source of truth for "which tables are taken for an event": `booking_table_mappings`
 * rows for that `event_id` with `booking_id IS NOT NULL`. Rows with a null
 * booking_id are event-level floor-plan placements (a table placed on the layout
 * but not occupied) and are NOT treated as taken.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SeatingEvent {
  id: number;
  seating_required: boolean;
  is_bookable: boolean;
}

/** A free/available table the algorithm can hand out. */
export interface FreeTable {
  id: number;
  max_capacity: number;
  name?: string | null;
}

/** A confirmed booking together with the table it currently holds. */
export interface MappedBooking {
  bookingId: number;
  groupSize: number;
  tableId: number;
  tableCapacity: number;
}

export type CreateOutcome =
  | { status: "confirmed"; table: FreeTable }
  | { status: "waitlisted" };

export type SizeChangeOutcome =
  | { outcome: "kept"; tableId: number; addSeat: number }
  | { outcome: "reassigned"; tableId: number; addSeat: number }
  | {
      outcome: "swapped";
      tableId: number;
      addSeat: number;
      swappedBookingId: number;
      swappedToTableId: number;
    }
  | { outcome: "no_space" };

type IdRef = number | string;

// ─── Guard ──────────────────────────────────────────────────────────────────

/** Seating logic only applies to bookable, seating-required events. */
export function seatingApplies(event: SeatingEvent): boolean {
  return event.seating_required === true && event.is_bookable === true;
}

// ─── Pure decision helpers (no Supabase — unit-tested) ───────────────────────

/** Extra chairs needed when a group overflows a table's capacity. Never negative. */
export function computeAddSeat(groupSize: number, tableCapacity: number): number {
  return Math.max(0, groupSize - tableCapacity);
}

/**
 * The available table with the smallest `max_capacity` that still seats the
 * group (`>= groupSize`), or null. Input order is not assumed.
 */
export function pickSmallestFittingTable(
  freeTables: FreeTable[],
  groupSize: number
): FreeTable | null {
  const fitting = freeTables.filter((t) => t.max_capacity >= groupSize);
  if (fitting.length === 0) return null;
  return fitting.reduce((best, t) =>
    t.max_capacity < best.max_capacity ||
    (t.max_capacity === best.max_capacity && t.id < best.id)
      ? t
      : best
  );
}

/**
 * The tightest free table strictly smaller than the current one that still
 * seats `newSize` — i.e. `newSize <= max_capacity < currentCapacity`, closest
 * to `newSize`. Used by the downsize relocation rule (3b.1). Null if none.
 */
export function pickTighterFreeTable(
  freeTables: FreeTable[],
  newSize: number,
  currentCapacity: number
): FreeTable | null {
  const tighter = freeTables.filter(
    (t) => t.max_capacity >= newSize && t.max_capacity < currentCapacity
  );
  if (tighter.length === 0) return null;
  // All candidates fit, so closest-to-newSize === smallest max_capacity.
  return tighter.reduce((best, t) =>
    t.max_capacity < best.max_capacity ||
    (t.max_capacity === best.max_capacity && t.id < best.id)
      ? t
      : best
  );
}

/**
 * Upsize swap (rule 3a.2). `current` grew to `newSize` and outgrew its table,
 * and no free table fits. Find another confirmed mapped booking B to trade
 * tables with, where:
 *   - B's group is now smaller than this one (`B.groupSize < newSize`), and
 *   - B's table is bigger than current's AND actually fits `newSize`
 *     (`B.tableCapacity > current.tableCapacity` && `>= newSize`), and
 *   - B still fits on current's table (`B.groupSize <= current.tableCapacity`).
 * Deterministic pick: smallest qualifying B-table (tie-break by bookingId). Null if none.
 */
export function findUpsizeSwap(
  current: MappedBooking,
  candidates: MappedBooking[],
  newSize: number
): MappedBooking | null {
  const valid = candidates.filter(
    (b) =>
      b.bookingId !== current.bookingId &&
      b.groupSize < newSize &&
      b.tableCapacity > current.tableCapacity &&
      b.tableCapacity >= newSize &&
      b.groupSize <= current.tableCapacity
  );
  if (valid.length === 0) return null;
  return valid.reduce((best, b) =>
    b.tableCapacity < best.tableCapacity ||
    (b.tableCapacity === best.tableCapacity && b.bookingId < best.bookingId)
      ? b
      : best
  );
}

/**
 * Downsize swap (rule 3b.2). `current` shrank to `newSize` and no tighter free
 * table exists. Find a confirmed booking B sitting at a table tighter than
 * current's that we should hand the big table to, where:
 *   - B's table is tighter than current's but still fits `newSize`
 *     (`newSize <= B.tableCapacity < current.tableCapacity`), and
 *   - B is the larger group (`B.groupSize > newSize`) — so B benefits from the
 *     bigger table current is vacating, and B still fits current's table
 *     (guaranteed since `B.groupSize <= B.tableCapacity < current.tableCapacity`).
 * Deterministic pick: B-table closest to `newSize` (tie-break by bookingId). Null if none.
 */
export function findDownsizeSwap(
  current: MappedBooking,
  candidates: MappedBooking[],
  newSize: number
): MappedBooking | null {
  const valid = candidates.filter(
    (b) =>
      b.bookingId !== current.bookingId &&
      b.tableCapacity >= newSize &&
      b.tableCapacity < current.tableCapacity &&
      b.groupSize > newSize &&
      b.groupSize <= current.tableCapacity
  );
  if (valid.length === 0) return null;
  return valid.reduce((best, b) =>
    b.tableCapacity < best.tableCapacity ||
    (b.tableCapacity === best.tableCapacity && b.bookingId < best.bookingId)
      ? b
      : best
  );
}

/** Pure CREATE decision: smallest fitting free table → confirmed, else waitlisted. */
export function decideCreate(freeTables: FreeTable[], groupSize: number): CreateOutcome {
  const table = pickSmallestFittingTable(freeTables, groupSize);
  return table ? { status: "confirmed", table } : { status: "waitlisted" };
}

/**
 * Pure UPDATE decision for a confirmed, mapped booking whose group_size changed.
 * `freeTables` = available tables for the event (excluding this booking's own),
 * unfiltered by size. `candidates` = other confirmed mapped bookings on the event.
 * Implements rules 3a (increase) and 3b (decrease).
 */
export function decideSizeChange(
  booking: MappedBooking,
  newSize: number,
  freeTables: FreeTable[],
  candidates: MappedBooking[]
): SizeChangeOutcome {
  // ── INCREASE ──────────────────────────────────────────────────────────────
  if (newSize > booking.groupSize) {
    if (newSize <= booking.tableCapacity) {
      // Still fits its current table.
      return { outcome: "kept", tableId: booking.tableId, addSeat: 0 };
    }
    // Needs a bigger table. 1) reassign to a free fitting table.
    const reassign = pickSmallestFittingTable(freeTables, newSize);
    if (reassign) {
      return {
        outcome: "reassigned",
        tableId: reassign.id,
        addSeat: computeAddSeat(newSize, reassign.max_capacity),
      };
    }
    // 2) swap with a confirmed neighbour holding a bigger table.
    const swap = findUpsizeSwap(booking, candidates, newSize);
    if (swap) {
      return {
        outcome: "swapped",
        tableId: swap.tableId,
        addSeat: computeAddSeat(newSize, swap.tableCapacity),
        swappedBookingId: swap.bookingId,
        swappedToTableId: booking.tableId,
      };
    }
    // 3) no space.
    return { outcome: "no_space" };
  }

  // ── DECREASE ──────────────────────────────────────────────────────────────
  if (newSize < booking.groupSize) {
    // 1) relocate to a tighter free table.
    const tighter = pickTighterFreeTable(freeTables, newSize, booking.tableCapacity);
    if (tighter) {
      return { outcome: "reassigned", tableId: tighter.id, addSeat: 0 };
    }
    // 2) tighten via swap with a larger group on a tighter table.
    const swap = findDownsizeSwap(booking, candidates, newSize);
    if (swap) {
      return {
        outcome: "swapped",
        tableId: swap.tableId,
        addSeat: 0,
        swappedBookingId: swap.bookingId,
        swappedToTableId: booking.tableId,
      };
    }
    // 3) keep on current table.
    return {
      outcome: "kept",
      tableId: booking.tableId,
      addSeat: computeAddSeat(newSize, booking.tableCapacity),
    };
  }

  // ── UNCHANGED ─────────────────────────────────────────────────────────────
  return {
    outcome: "kept",
    tableId: booking.tableId,
    addSeat: computeAddSeat(newSize, booking.tableCapacity),
  };
}

// ─── Data access (Supabase) ──────────────────────────────────────────────────

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

/** Table ids held by *booking* mappings (booking_id not null) for an event. */
async function getTakenTableIds(
  supabase: SupabaseClient,
  eventId: number,
  excludeBookingId?: IdRef
): Promise<number[]> {
  let query = supabase
    .from("booking_table_mappings")
    .select("table_id, booking_id")
    .eq("event_id", eventId)
    .not("booking_id", "is", null);

  if (excludeBookingId !== undefined && excludeBookingId !== null) {
    query = query.neq("booking_id", excludeBookingId);
  }

  const { data } = await query;
  return (data ?? []).map((m) => m.table_id as number);
}

/**
 * Tables with `available = true` not currently held by a booking mapping for the
 * event, capacity `>= groupSize` (when given), ordered smallest-fit first.
 *   - `excludeBookingId` ignores that booking's own mapping (for re-allocation).
 *   - `excludeTableId` re-includes a specific table even if held (used by the
 *     admin edit dropdown to keep the booking's current table selectable).
 */
export async function getFreeTablesForEvent(
  supabase: SupabaseClient,
  eventId: number,
  opts: { groupSize?: number; excludeBookingId?: IdRef; excludeTableId?: number } = {}
): Promise<FreeTable[]> {
  let takenIds = await getTakenTableIds(supabase, eventId, opts.excludeBookingId);
  if (opts.excludeTableId !== undefined) {
    takenIds = takenIds.filter((id) => id !== opts.excludeTableId);
  }

  let query = supabase
    .from("tables")
    .select("id, name, max_capacity")
    .eq("available", true);

  if (opts.groupSize !== undefined) {
    query = query.gte("max_capacity", opts.groupSize);
  }
  if (takenIds.length > 0) {
    query = query.not("id", "in", `(${takenIds.join(",")})`);
  }

  const { data, error } = await query.order("max_capacity", { ascending: true });
  if (error) {
    console.error("getFreeTablesForEvent error:", error);
    return [];
  }
  return (data ?? []) as FreeTable[];
}

/**
 * Confirmed bookings for the event that currently hold a table, as
 * `MappedBooking[]` — the candidate pool for upsize/downsize swaps.
 */
export async function getMappedBookingsForEvent(
  supabase: SupabaseClient,
  eventId: number,
  opts: { excludeBookingId?: IdRef } = {}
): Promise<MappedBooking[]> {
  let query = supabase
    .from("booking_table_mappings")
    .select("booking_id, table_id, bookings!inner(group_size, status), tables!inner(max_capacity)")
    .eq("event_id", eventId)
    .not("booking_id", "is", null)
    .eq("bookings.status", "confirmed");

  if (opts.excludeBookingId !== undefined && opts.excludeBookingId !== null) {
    query = query.neq("booking_id", opts.excludeBookingId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getMappedBookingsForEvent error:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    // Supabase joins can come back as object OR single-element array.
    const b = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
    const t = Array.isArray(row.tables) ? row.tables[0] : row.tables;
    return {
      bookingId: row.booking_id as number,
      tableId: row.table_id as number,
      groupSize: (b?.group_size as number) ?? 0,
      tableCapacity: (t?.max_capacity as number) ?? 0,
    };
  });
}

// ─── Orchestrators (the things server actions call) ──────────────────────────

/**
 * CREATE allocation. Returns the decision; the caller inserts the booking row
 * with the returned status, then calls `commitMapping` for a confirmed result.
 */
export async function allocateOnCreate(
  supabase: SupabaseClient,
  args: { eventId: number; groupSize: number }
): Promise<CreateOutcome> {
  const freeTables = await getFreeTablesForEvent(supabase, args.eventId, {
    groupSize: args.groupSize,
  });
  return decideCreate(freeTables, args.groupSize);
}

/**
 * Inserts the confirmed booking→table mapping. The DB's partial unique index
 * (`booking_table_mappings_event_table_uq`) is the authoritative concurrency
 * backstop: a lost race surfaces as a unique violation and is reported as
 * `table_taken` so the caller can waitlist the loser.
 */
export async function commitMapping(
  supabase: SupabaseClient,
  args: { bookingId: IdRef; eventId: number; tableId: number; groupSize: number }
): Promise<{ ok: true; addSeat: number } | { ok: false; reason: "table_taken" }> {
  const { data: table } = await supabase
    .from("tables")
    .select("max_capacity")
    .eq("id", args.tableId)
    .single();
  const addSeat = computeAddSeat(args.groupSize, (table?.max_capacity as number) ?? 0);

  const { error } = await supabase.from("booking_table_mappings").insert({
    booking_id: args.bookingId,
    table_id: args.tableId,
    event_id: args.eventId,
    add_seat: addSeat,
  });

  if (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "table_taken" };
    throw new Error(`Failed to map table: ${error.message}`);
  }
  return { ok: true, addSeat };
}

/**
 * Read-only PLAN for a group_size change on a confirmed, mapped booking. Does
 * no writes, so admin UI can preview/warn before saving. Pair with `applySizeChange`.
 */
export async function planSizeChange(
  supabase: SupabaseClient,
  args: { booking: MappedBooking; newSize: number }
): Promise<SizeChangeOutcome> {
  const eventId = await getEventIdForBooking(supabase, args.booking.bookingId);
  if (eventId === null) return { outcome: "no_space" };

  const [freeTables, candidates] = await Promise.all([
    getFreeTablesForEvent(supabase, eventId, { excludeBookingId: args.booking.bookingId }),
    getMappedBookingsForEvent(supabase, eventId, { excludeBookingId: args.booking.bookingId }),
  ]);

  return decideSizeChange(args.booking, args.newSize, freeTables, candidates);
}

/**
 * Executes a `planSizeChange` plan's writes.
 *   - kept       → refresh add_seat on the existing mapping
 *   - reassigned → move this booking's mapping to the new table
 *   - swapped    → trade tables between this booking and the swapped one
 *   - no_space   → public: no-op (caller blocks); admin: demote to `pending`
 *                  and delete the mapping.
 *
 * Swaps and reassigns delete-then-insert mappings (no multi-row transaction in
 * the JS client), so there's a brief window where a table is free; the partial
 * unique index still prevents a third party from double-booking either table.
 */
export async function applySizeChange(
  supabase: SupabaseClient,
  plan: SizeChangeOutcome,
  args: { bookingId: IdRef; eventId: number; surface: "public" | "admin" }
): Promise<void> {
  switch (plan.outcome) {
    case "kept": {
      await supabase
        .from("booking_table_mappings")
        .update({ add_seat: plan.addSeat })
        .eq("booking_id", args.bookingId);
      return;
    }
    case "reassigned": {
      await supabase.from("booking_table_mappings").delete().eq("booking_id", args.bookingId);
      await supabase.from("booking_table_mappings").insert({
        booking_id: args.bookingId,
        table_id: plan.tableId,
        event_id: args.eventId,
        add_seat: plan.addSeat,
      });
      return;
    }
    case "swapped": {
      // Free both rows first, then re-insert with traded tables.
      await supabase
        .from("booking_table_mappings")
        .delete()
        .in("booking_id", [args.bookingId, plan.swappedBookingId]);
      await supabase.from("booking_table_mappings").insert([
        {
          booking_id: args.bookingId,
          table_id: plan.tableId,
          event_id: args.eventId,
          add_seat: plan.addSeat,
        },
        {
          booking_id: plan.swappedBookingId,
          table_id: plan.swappedToTableId,
          event_id: args.eventId,
          add_seat: 0, // swapped booking always fits the vacated table
        },
      ]);
      return;
    }
    case "no_space": {
      if (args.surface === "admin") {
        await supabase.from("bookings").update({ status: "pending" }).eq("id", args.bookingId);
        await supabase.from("booking_table_mappings").delete().eq("booking_id", args.bookingId);
      }
      // public: leave booking + mapping untouched; caller surfaces the block.
      return;
    }
  }
}

/** Rule 3c: free a booking's table when it moves away from `confirmed`. */
export async function clearMappingOnStatusChange(
  supabase: SupabaseClient,
  bookingId: IdRef
): Promise<void> {
  await supabase.from("booking_table_mappings").delete().eq("booking_id", bookingId);
}

/**
 * Rule 3d: validate + write an admin's direct table pick for a booking. The
 * table must be available and not already held by another booking on the event;
 * `add_seat` is computed from the overflow. The unique index is the backstop.
 */
export async function assignTableDirect(
  supabase: SupabaseClient,
  args: { bookingId: IdRef; eventId: number; tableId: number; groupSize: number }
): Promise<
  { ok: true; addSeat: number } | { ok: false; reason: "unavailable" | "double_booked" }
> {
  const { data: table } = await supabase
    .from("tables")
    .select("max_capacity, available")
    .eq("id", args.tableId)
    .single();

  if (!table || table.available !== true) {
    return { ok: false, reason: "unavailable" };
  }

  // Already held by a different booking on this event?
  const { data: clash } = await supabase
    .from("booking_table_mappings")
    .select("booking_id")
    .eq("event_id", args.eventId)
    .eq("table_id", args.tableId)
    .not("booking_id", "is", null)
    .neq("booking_id", args.bookingId)
    .limit(1);

  if (clash && clash.length > 0) {
    return { ok: false, reason: "double_booked" };
  }

  const addSeat = computeAddSeat(args.groupSize, (table.max_capacity as number) ?? 0);

  await supabase.from("booking_table_mappings").delete().eq("booking_id", args.bookingId);
  const { error } = await supabase.from("booking_table_mappings").insert({
    booking_id: args.bookingId,
    table_id: args.tableId,
    event_id: args.eventId,
    add_seat: addSeat,
  });

  if (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "double_booked" };
    throw new Error(`Failed to assign table: ${error.message}`);
  }
  return { ok: true, addSeat };
}

/**
 * Rule 3e (dashboard flag): count of `waitlisted` bookings on seated, bookable
 * events that a currently-free table could now seat. Batched per event (no
 * N+1 per booking). Never auto-promotes — this is purely a "needs action" count.
 */
export async function countSeatableWaitlist(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, group_size, event_id, events!inner(id, seating_required, is_bookable)")
    .eq("status", "waitlisted")
    .eq("events.seating_required", true)
    .eq("events.is_bookable", true);

  if (error || !data) {
    if (error) console.error("countSeatableWaitlist error:", error);
    return 0;
  }

  // Group waitlisted bookings by event.
  const byEvent = new Map<number, number[]>();
  for (const b of data) {
    const eventId = b.event_id as number;
    const list = byEvent.get(eventId) ?? [];
    list.push((b.group_size as number) ?? 0);
    byEvent.set(eventId, list);
  }

  let count = 0;
  await Promise.all(
    Array.from(byEvent.entries()).map(async ([eventId, sizes]) => {
      const freeTables = await getFreeTablesForEvent(supabase, eventId);
      const maxFree = freeTables.reduce((m, t) => Math.max(m, t.max_capacity), 0);
      count += sizes.filter((size) => size > 0 && size <= maxFree).length;
    })
  );

  return count;
}

/** Internal helper: resolve a booking's event id. */
async function getEventIdForBooking(
  supabase: SupabaseClient,
  bookingId: IdRef
): Promise<number | null> {
  const { data } = await supabase
    .from("bookings")
    .select("event_id")
    .eq("id", bookingId)
    .single();
  return (data?.event_id as number) ?? null;
}
