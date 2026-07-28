import { describe, it, expect } from "vitest";
import { withStringBookingIds } from "@/lib/booking-row-ids";

describe("withStringBookingIds", () => {
  it("turns the bigint ids PostgREST returns as numbers into strings", () => {
    const row = withStringBookingIds({
      id: 115,
      event_id: 15,
      booking_table_mappings: [{ tables: { tables_id: 2, tables_name: "02" } }],
    });

    expect(row.id).toBe("115");
    expect(row.event_id).toBe("15");
    expect(row.booking_table_mappings[0]?.tables?.tables_id).toBe("2");
  });

  it("leaves ids that are already strings untouched", () => {
    const row = withStringBookingIds({
      id: "115",
      event_id: "15",
      booking_table_mappings: [{ tables: { tables_id: "2" } }],
    });

    expect(row.id).toBe("115");
    expect(row.event_id).toBe("15");
    expect(row.booking_table_mappings[0]?.tables?.tables_id).toBe("2");
  });

  it("keeps a missing event_id as null rather than the string 'null'", () => {
    expect(withStringBookingIds({ id: 1, event_id: null }).event_id).toBeNull();
    expect(withStringBookingIds({ id: 1 }).event_id).toBeNull();
  });

  it("survives bookings with no table mapping", () => {
    expect(withStringBookingIds({ id: 1 }).booking_table_mappings).toEqual([]);
    expect(withStringBookingIds({ id: 1, booking_table_mappings: null }).booking_table_mappings).toEqual([]);
  });

  it("leaves a mapping row whose table is missing alone", () => {
    const row = withStringBookingIds({
      id: 1,
      booking_table_mappings: [{ tables: null }, null],
    });
    expect(row.booking_table_mappings).toEqual([{ tables: null }, null]);
  });

  it("preserves every other field on the row", () => {
    const row = withStringBookingIds({
      id: 115,
      group_name: "Titans",
      group_size: 1,
      status: "confirmed",
    } as { id: number; group_name: string; group_size: number; status: string });

    expect(row).toMatchObject({ group_name: "Titans", group_size: 1, status: "confirmed" });
  });

  it("keeps the id comparable to a url search param", () => {
    const row = withStringBookingIds({ id: 115 });
    expect(row.id === "115").toBe(true);
  });
});
