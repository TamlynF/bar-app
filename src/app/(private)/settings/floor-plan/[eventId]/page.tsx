import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FloorPlanClient from "./_components/floor-plan-client";
import type { CalcTable } from "@/lib/floor-plan/calculator";
import type { Feature, Fixture, Obstacle, RoomOutline } from "@/lib/floor-plan/types";

export default async function FloorPlanPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = Number(eventId);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();

  // Venue geometry (single company row), the event, confirmed tables, and the
  // count of bookable tables — fetched in parallel.
  const [companyRes, eventRes, mappingRes, availableRes] = await Promise.all([
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
    supabase
      .from("booking_table_mappings")
      .select(
        "id, add_seat, table_id, bookings!inner(status), tables!inner(id, name, shape, diameter, width, length, max_capacity)"
      )
      .eq("event_id", id)
      .eq("bookings.status", "confirmed"),
    supabase.from("tables").select("id", { count: "exact", head: true }).eq("available", true),
  ]);

  if (eventRes.error || !eventRes.data) notFound();
  if (companyRes.error) console.error("Error loading venue geometry:", companyRes.error);
  if (mappingRes.error) console.error("Error loading confirmed tables:", mappingRes.error);

  const company = companyRes.data;
  const event = eventRes.data;

  // Normalise the joined mapping rows into CalcTable[].
  const rawMappings = (mappingRes.data ?? []) as unknown as Array<{
    id: number;
    add_seat: number | null;
    table_id: number;
    tables:
      | { id: number; name: string; shape: string | null; diameter: number | null; width: number | null; length: number | null; max_capacity: number | null }
      | Array<{ id: number; name: string; shape: string | null; diameter: number | null; width: number | null; length: number | null; max_capacity: number | null }>;
  }>;

  const tables: CalcTable[] = rawMappings.map((m) => {
    const t = Array.isArray(m.tables) ? m.tables[0] : m.tables;
    return {
      mappingId: m.id,
      tableId: m.table_id,
      name: t?.name ?? `Table ${m.table_id}`,
      shape: t?.shape === "rect" ? "rect" : "round",
      diameter: t?.diameter ?? null,
      width: t?.width ?? null,
      length: t?.length ?? null,
      baseSeats: t?.max_capacity ?? 0,
      extraChairs: Number(m.add_seat ?? 0),
    };
  });

  return (
    <FloorPlanClient
      event={{ id: event.id, title: event.title ?? "Event", date: event.date }}
      room={(company?.room_outline as RoomOutline | null) ?? null}
      obstacles={(company?.obstacles as Obstacle[] | null) ?? []}
      fixtures={(company?.fixtures as Fixture[] | null) ?? []}
      features={(company?.features as Feature[] | null) ?? []}
      tables={tables}
      availableCount={availableRes.count ?? 0}
      savedLayout={event.floor_plan_layout ?? null}
    />
  );
}
