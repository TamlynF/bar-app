export const ALL_SUBTYPES = "__all__";

export const BOOKING_GROUPINGS = ["per_type", "per_subtype","per_event"] as const;

export type BookingGrouping = (typeof BOOKING_GROUPINGS)[number];

export const BOOKING_GROUPING_LABELS: Record<BookingGrouping, string> = {
  per_event: "Per Individual Event",
  per_subtype: "Per Sub-Category",
  per_type: "Per Category",
};

export const BOOKING_GROUPING_OPTIONS: { value: BookingGrouping; label: string }[] =
  BOOKING_GROUPINGS.map((value) => ({ value, label: BOOKING_GROUPING_LABELS[value] }));

export function isBookingGrouping(value: unknown): value is BookingGrouping {
  return (
    typeof value === "string" &&
    (BOOKING_GROUPINGS as readonly string[]).includes(value)
  );
}
