import type { SupabaseClient } from "@supabase/supabase-js";

export interface SeatingEvent {
  id: number;
  seating_required: boolean;
  is_bookable: boolean;
}

export interface FreeTable {
  id: number;
  max_capacity: number;
  name?: string | null;
}

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

export function seatingApplies(event: SeatingEvent): boolean {
  return event.seating_required === true && event.is_bookable === true;
}

export function computeAddSeat(groupSize: number, tableCapacity: number): number {
  return Math.max(0, groupSize - tableCapacity);
}

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

export function pickTighterFreeTable(
  freeTables: FreeTable[],
  newSize: number,
  currentCapacity: number
): FreeTable | null {
  const tighter = freeTables.filter(
    (t) => t.max_capacity >= newSize && t.max_capacity < currentCapacity
  );
  if (tighter.length === 0) return null;
  return tighter.reduce((best, t) =>
    t.max_capacity < best.max_capacity ||
    (t.max_capacity === best.max_capacity && t.id < best.id)
      ? t
      : best
  );
}

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

export function decideCreate(freeTables: FreeTable[], groupSize: number): CreateOutcome {
  const table = pickSmallestFittingTable(freeTables, groupSize);
  return table ? { status: "confirmed", table } : { status: "waitlisted" };
}

export function decideSizeChange(
  booking: MappedBooking,
  newSize: number,
  freeTables: FreeTable[],
  candidates: MappedBooking[]
): SizeChangeOutcome {
  if (newSize > booking.groupSize) {
    if (newSize <= booking.tableCapacity) {
      return { outcome: "kept", tableId: booking.tableId, addSeat: 0 };
    }
    const reassign = pickSmallestFittingTable(freeTables, newSize);
    if (reassign) {
      return {
        outcome: "reassigned",
        tableId: reassign.id,
        addSeat: computeAddSeat(newSize, reassign.max_capacity),
      };
    }
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
    return { outcome: "no_space" };
  }

  if (newSize < booking.groupSize) {
    const tighter = pickTighterFreeTable(freeTables, newSize, booking.tableCapacity);
    if (tighter) {
      return { outcome: "reassigned", tableId: tighter.id, addSeat: 0 };
    }
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
    return {
      outcome: "kept",
      tableId: booking.tableId,
      addSeat: computeAddSeat(newSize, booking.tableCapacity),
    };
  }

  return {
    outcome: "kept",
    tableId: booking.tableId,
    addSeat: computeAddSeat(newSize, booking.tableCapacity),
  };
}

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

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

export async function allocateOnCreate(
  supabase: SupabaseClient,
  args: { eventId: number; groupSize: number }
): Promise<CreateOutcome> {
  const freeTables = await getFreeTablesForEvent(supabase, args.eventId, {
    groupSize: args.groupSize,
  });
  return decideCreate(freeTables, args.groupSize);
}

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
      return;
    }
  }
}

export async function planConfirmSeating(
  supabase: SupabaseClient,
  args: { eventId: number; bookingId: IdRef; groupSize: number }
): Promise<{ ok: true; tableToAssign: FreeTable | null } | { ok: false }> {
  const { data: event } = await supabase
    .from("events")
    .select("id, seating_required, is_bookable")
    .eq("id", args.eventId)
    .single();

  if (!event || !seatingApplies(event as SeatingEvent)) {
    return { ok: true, tableToAssign: null };
  }

  const { data: existing } = await supabase
    .from("booking_table_mappings")
    .select("table_id")
    .eq("booking_id", args.bookingId)
    .not("table_id", "is", null)
    .limit(1);
  if (existing && existing.length > 0) return { ok: true, tableToAssign: null };

  const freeTables = await getFreeTablesForEvent(supabase, args.eventId, {
    groupSize: args.groupSize,
    excludeBookingId: args.bookingId,
  });
  const table = pickSmallestFittingTable(freeTables, args.groupSize);
  return table ? { ok: true, tableToAssign: table } : { ok: false };
}

export async function clearMappingOnStatusChange(
  supabase: SupabaseClient,
  bookingId: IdRef
): Promise<void> {
  await supabase.from("booking_table_mappings").delete().eq("booking_id", bookingId);
}

export function seatingErrorMessage(reason: "no_table" | "double_booked" | "unavailable"): string {
  if (reason === "no_table") {
    return "Cannot confirm this booking — no available table for this group size. Free up a table or adjust the group size first.";
  }
  if (reason === "double_booked") {
    return "That table was just taken by another booking for this event.";
  }
  return "That table is not available.";
}

async function getCurrentMapping(
  supabase: SupabaseClient,
  bookingId: IdRef
): Promise<{ tableId: number; capacity: number } | null> {
  const { data } = await supabase
    .from("booking_table_mappings")
    .select("table_id, tables(max_capacity)")
    .eq("booking_id", bookingId)
    .not("table_id", "is", null)
    .maybeSingle();
  if (!data?.table_id) return null;
  const t = Array.isArray(data.tables) ? data.tables[0] : data.tables;
  return { tableId: data.table_id as number, capacity: (t?.max_capacity as number) ?? 0 };
}

export async function reconcileSeatedBookingTable(
  supabase: SupabaseClient,
  args: {
    bookingId: IdRef;
    eventId: number | null;
    oldSize: number;
    newSize: number;
    finalStatus: string; // lowercased resolved status after this edit
    tableFieldPresent: boolean; // was table_id part of the update payload?
    tableId: number | null; // explicit table id; null when empty/absent
  }
): Promise<{ ok: true } | { ok: false; reason: "no_table" | "double_booked" | "unavailable" }> {
  const { bookingId, eventId, oldSize, newSize, finalStatus, tableFieldPresent, tableId } = args;
  if (eventId == null) return { ok: true };

  const confirming = finalStatus === "confirmed";

  if (!confirming) {
    if (tableFieldPresent) await clearMappingOnStatusChange(supabase, bookingId);
    return { ok: true };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, seating_required, is_bookable")
    .eq("id", eventId)
    .single();
  const seated = !!event && seatingApplies(event as SeatingEvent);
  const current = await getCurrentMapping(supabase, bookingId);

  if (!seated) {
    if (tableFieldPresent && tableId != null) {
      return assignTableDirect(supabase, { bookingId, eventId, tableId, groupSize: newSize });
    }
    if (tableFieldPresent && tableId == null && current) {
      await clearMappingOnStatusChange(supabase, bookingId);
    }
    return { ok: true };
  }

  if (tableId != null && (!current || current.tableId !== tableId)) {
    return assignTableDirect(supabase, { bookingId, eventId, tableId, groupSize: newSize });
  }

  if (!current) {
    const plan = await planConfirmSeating(supabase, { eventId, bookingId, groupSize: newSize });
    if (!plan.ok) return { ok: false, reason: "no_table" };
    if (plan.tableToAssign) {
      return assignTableDirect(supabase, { bookingId, eventId, tableId: plan.tableToAssign.id, groupSize: newSize });
    }
    return { ok: true };
  }

  if (newSize < oldSize) {
    const freeTables = await getFreeTablesForEvent(supabase, eventId, {
      groupSize: newSize,
      excludeBookingId: bookingId,
    });
    const tighter = pickTighterFreeTable(freeTables, newSize, current.capacity);
    if (tighter) {
      return assignTableDirect(supabase, { bookingId, eventId, tableId: tighter.id, groupSize: newSize });
    }
  }

  await supabase
    .from("booking_table_mappings")
    .update({ add_seat: computeAddSeat(newSize, current.capacity) })
    .eq("booking_id", bookingId);
  return { ok: true };
}

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

export async function countSeatableWaitlist(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, group_size, event_id, events!bookings_event_id_fkey!inner(id, seating_required, is_bookable)")
    .eq("status", "waitlisted")
    .eq("events.seating_required", true)
    .eq("events.is_bookable", true);

  if (error || !data) {
    if (error) console.error("countSeatableWaitlist error:", error);
    return 0;
  }

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
