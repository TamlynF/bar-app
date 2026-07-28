export interface RawBookingRowIds {
  id: number | string;
  event_id?: number | string | null;
  booking_table_mappings?: ({ tables?: { tables_id?: number | string | null } | null } | null)[] | null;
}

export function withStringBookingIds<T extends RawBookingRowIds>(row: T) {
  return {
    ...row,
    id: String(row.id),
    event_id: row.event_id == null ? null : String(row.event_id),
    booking_table_mappings: (row.booking_table_mappings ?? []).map((mapping) =>
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
