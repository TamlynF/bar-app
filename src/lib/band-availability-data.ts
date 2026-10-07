import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { heldPrivateHireSlots } from "./private-hire-flow";
import { heldSlotsAsEvents } from "./private-hire-details";
import { getCompanyInfo } from "./company-info";
import { bandDateRules, computeAvailableBandDates, type BandDateRules, type BandEvent } from "./band-availability";
import type { OpeningHours } from "./opening-hours";
import { addDaysUTC, fromISODate, toISODate } from "./uk-holidays";

export const BAND_BOOKING_HORIZON_DAYS = 365;

export function bandBookingWindow(today: Date = new Date()): { from: string; to: string } {
  const from = toISODate(today);
  return { from, to: toISODate(addDaysUTC(fromISODate(from), BAND_BOOKING_HORIZON_DAYS)) };
}

type Behavior = { behavior: string | null } | { behavior: string | null }[] | null;

function behaviorOf(join: Behavior): string | null {
  return (Array.isArray(join) ? join[0] : join)?.behavior ?? null;
}

export async function getBandAvailability(): Promise<{ dates: string[]; rules: BandDateRules }> {
  const { from, to } = bandBookingWindow();
  const supabase = await createClient();
  const companyInfo = await getCompanyInfo();
  const rules = bandDateRules(companyInfo);

  const [{ data: eventRows, error }, held] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, date, start_time, end_time, is_active, event_subtypes(behavior)")
      .gte("date", from)
      .lte("date", to),
    heldPrivateHireSlots(createAdminClient(), { from, to }),
  ]);

  if (error) throw new Error(`Couldn't load events for band availability: ${error.message}`);

  const events: BandEvent[] = (eventRows ?? []).map(({ event_subtypes, ...event }) => ({
    ...event,
    is_music: behaviorOf(event_subtypes as Behavior) === "music_act",
  }));

  const dates = computeAvailableBandDates({
    from,
    to,
    openingHours: (companyInfo?.opening_hours ?? null) as OpeningHours | null,
    events: [...events, ...heldSlotsAsEvents(held)],
    rules,
  });

  return { dates, rules };
}

export async function getAvailableBandDates(): Promise<string[]> {
  return (await getBandAvailability()).dates;
}
