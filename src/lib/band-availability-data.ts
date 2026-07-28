import { createClient } from "./supabase/server";
import { getCompanyInfo } from "./company-info";
import { computeAvailableBandDates } from "./band-availability";
import type { EventClashCandidate } from "./event-form-validation";
import type { OpeningHours } from "./opening-hours";
import { addDaysUTC, fromISODate, toISODate } from "./uk-holidays";

export const BAND_BOOKING_HORIZON_DAYS = 365;

export function bandBookingWindow(today: Date = new Date()): { from: string; to: string } {
  const from = toISODate(today);
  return { from, to: toISODate(addDaysUTC(fromISODate(from), BAND_BOOKING_HORIZON_DAYS)) };
}

export async function getAvailableBandDates(): Promise<string[]> {
  const { from, to } = bandBookingWindow();
  const supabase = await createClient();
  const companyInfo = await getCompanyInfo();

  const { data: eventRows } = await supabase
    .from("events")
    .select("id, title, date, start_time, end_time, is_active")
    .gte("date", from)
    .lte("date", to);

  return computeAvailableBandDates({
    from,
    to,
    openingHours: (companyInfo?.opening_hours ?? null) as OpeningHours | null,
    events: (eventRows ?? []) as EventClashCandidate[],
  });
}
