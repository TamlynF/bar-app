import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FloorPlanClient, { type AvailableTable } from "./_components/floor-plan-client";
import type { CalcTable } from "@/lib/floor-plan/calculator";
import { chairLayoutSeatCount } from "@/lib/floor-plan/chairs";
import type { ChairLayout, Feature, Fixture, Obstacle, RoomOutline } from "@/lib/floor-plan/types";

type TableRow = {
  id: number;
  name: string;
  shape: string | null;
  diameter: number | null;
  width: number | null;
  length: number | null;
  max_capacity: number | null;
  chair_layout?: ChairLayout | null;
};

function toSpec(t: TableRow | undefined) {
  const chairLayout = (t?.chair_layout as ChairLayout | null) ?? null;
  return {
    name: t?.name ?? "Table",
    shape: (t?.shape === "rect" ? "rect" : "round") as "round" | "rect",
    diameter: t?.diameter ?? null,
    width: t?.width ?? null,
    length: t?.length ?? null,
    baseSeats: chairLayoutSeatCount(chairLayout, t?.max_capacity ?? 0),
    chairLayout,
  };
}

export default async function FloorPlanPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = Number(eventId);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();

  const TABLE_COLS = "id, name, shape, diameter, width, length, max_capacity, chair_layout";
  const TABLE_COLS_FALLBACK = "id, name, shape, diameter, width, length, max_capacity";

  const loadMappings = (cols: string) =>
    supabase
      .from("booking_table_mappings")
      .select(`id, add_seat, table_id, booking_id, bookings(status), tables!inner(${cols})`)
      .eq("event_id", id);
  const loadAvailable = (cols: string) =>
    supabase.from("tables").select(cols).eq("available", true).order("id", { ascending: true });

  const [companyRes, eventRes] = await Promise.all([
    supabase
      .from("company_information")
      .select("room_outline, obstacles, fixtures, features")
      .order("id", { ascending: true })
      .limit(1)
      .single(),
    supabase
      .from("events")
      .select("id, title, date, seating_required, floor_plan_layout")
      .eq("id", id)
      .single(),
  ]);

  let mappingRes = await loadMappings(TABLE_COLS);
  if (mappingRes.error) mappingRes = await loadMappings(TABLE_COLS_FALLBACK);

  let availableRes = await loadAvailable(TABLE_COLS);
  if (availableRes.error) availableRes = await loadAvailable(TABLE_COLS_FALLBACK);

  if (eventRes.error || !eventRes.data) notFound();
  if (companyRes.error) console.error("Error loading venue geometry:", companyRes.error);
  if (mappingRes.error) console.error("Error loading confirmed tables:", mappingRes.error);

  const company = companyRes.data;
  const event = eventRes.data;

  const rawMappings = (mappingRes.data ?? []) as unknown as Array<{
    id: number;
    add_seat: number | null;
    table_id: number;
    booking_id: number | null;
    bookings: { status: string } | { status: string }[] | null;
    tables: TableRow | TableRow[];
  }>;

  const tables: CalcTable[] = rawMappings
    .filter((m) => {
      if (m.booking_id == null) return true;
      const bk = Array.isArray(m.bookings) ? m.bookings[0] : m.bookings;
      return bk?.status === "confirmed";
    })
    .map((m) => {
      const t = Array.isArray(m.tables) ? m.tables[0] : m.tables;
      const spec = toSpec(t);
      return {
        mappingId: m.id,
        tableId: m.table_id,
        ...spec,
        extraChairs: Number(m.add_seat ?? 0),
        isManual: m.booking_id == null,
      };
    });

  const usedTableIds = new Set(tables.map((t) => t.tableId));
  const availableRows = (availableRes.data ?? []) as unknown as TableRow[];
  const availableTables: AvailableTable[] = availableRows.map((t) => {
    const spec = toSpec(t);
    return { tableId: t.id, ...spec, inUse: usedTableIds.has(t.id) };
  });

  return (
    <FloorPlanClient
      event={{ id: event.id, title: event.title ?? "Event", date: event.date }}
      room={(company?.room_outline as RoomOutline | null) ?? null}
      obstacles={(company?.obstacles as Obstacle[] | null) ?? []}
      fixtures={(company?.fixtures as Fixture[] | null) ?? []}
      features={(company?.features as Feature[] | null) ?? []}
      tables={tables}
      availableTables={availableTables}
      availableCount={availableTables.length}
      savedLayout={event.floor_plan_layout ?? null}
    />
  );
}
