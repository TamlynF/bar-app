export interface RawBookingRowIds {
  id: number | string;
  event_id?: number | string | null;
  booking_table_mappings?: ({ tables?: { tables_id?: number | string | null } | null } | null)[] | null;
}

export function withStringBookingIds<T extends RawBookingRowIds>(row: T) {
  const { id, event_id, booking_table_mappings, ...rest } = row;
  return {
    ...rest,
    id: String(id),
    event_id: event_id == null ? null : String(event_id),
    booking_table_mappings: (booking_table_mappings ?? []).map((mapping) =>
      mapping?.tables
        ? {
            ...mapping,
            tables: {
              ...mapping.tables,
              tables_id: mapping.tables.tables_id == null ? null : String(mapping.tables.tables_id),
            },
          }
        : mapping
    ),
  };
}
