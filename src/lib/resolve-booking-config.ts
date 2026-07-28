import type { BookingConfig } from "@/lib/booking-config";
import type { BookingGrouping } from "@/lib/booking-grouping";

export function resolveOwningBookingConfig(opts: {
  grouping: BookingGrouping | null | undefined;
  eventConfig?: BookingConfig | null;
  typeConfig?: BookingConfig | null;
  subtypeConfig?: BookingConfig | null;
}): BookingConfig {
  if (opts.grouping === "per_type") return opts.typeConfig ?? {};
  if (opts.grouping === "per_subtype") return opts.subtypeConfig ?? {};
  return opts.eventConfig ?? {};
}
