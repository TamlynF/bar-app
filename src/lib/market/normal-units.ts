import type { MarketConfig } from "./types";

/* "What does this serve normally sell on a night like tonight?" — built from
   the Square order lines the nightly sync keeps locally, per weekday
   (docs/market-tier-engine-plan.md §3.4). Everything in this file is pure;
   the Supabase calls live in normal-units-server.ts. */

export const VENUE_TIME_ZONE = "Europe/London";
export const DEFAULT_SAMPLE_NIGHTS = 6;
export const DEFAULT_LOOKBACK_WEEKS = 12;
export const SATURDAY = 6;
/* A trading night runs from this hour to the same hour next morning, so a
   sale rung at 01:45 on Sunday belongs to Saturday. */
export const NIGHT_ROLLOVER_HOUR = 6;

export type Ymd = string;

export type UnitsByVariation = Map<string, number>;

export type NormalUnitsRow = {
  menuItemPriceId: number;
  weekday: number;
  unitsAvg: number;
  nightsSampled: number;
  sampledDates: Ymd[];
};

export type NormalUnitsSource =
  | { kind: "override" }
  | { kind: "square"; weekday: number; nightsSampled: number }
  | { kind: "square_other_weekday"; weekday: number; nightsSampled: number }
  | { kind: "fallback" };

export type ResolvedNormalUnits = {
  value: number;
  source: NormalUnitsSource;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toYmd(date: Date, timeZone: string = VENUE_TIME_ZONE): Ymd {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ymdParts(ymd: Ymd): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const { y, m, d } = ymdParts(ymd);
  const t = Date.UTC(y, m - 1, d) + days * DAY_MS;
  const out = new Date(t);
  return `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`;
}

/* 0 = Sunday … 6 = Saturday, from a calendar date alone. */
export function weekdayOf(ymd: Ymd): number {
  const { y, m, d } = ymdParts(ymd);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/* Wall-clock time in the venue's zone → instant. Two passes settle the
   BST/GMT changeover nights without a timezone library. */
export function zonedTimeToUtc(ymd: Ymd, clock: string, timeZone: string = VENUE_TIME_ZONE): Date {
  const { y, m, d } = ymdParts(ymd);
  const [hh, mm] = clock.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm ?? 0);
  let utc = naive - zoneOffsetMs(naive, timeZone);
  utc = naive - zoneOffsetMs(utc, timeZone);
  return new Date(utc);
}

function clockMinutes(clock: string): number {
  const [hh, mm] = clock.split(":").map(Number);
  return hh * 60 + (mm ?? 0);
}

/* The trading night an instant belongs to: the venue-local date, rolled back
   a day before NIGHT_ROLLOVER_HOUR. Saturday 23:50 and Sunday 01:45 are both
   Saturday; Sunday 11:00 is Sunday. */
export function tradingNightOf(at: Date, timeZone: string = VENUE_TIME_ZONE): Ymd {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return Number(get("hour")) < NIGHT_ROLLOVER_HOUR ? addDays(date, -1) : date;
}

/* The night a session belongs to follows the same rule, so a market opened
   at 00:30 counts as the night before. */
export function nightOf(startedAt: Date, timeZone: string = VENUE_TIME_ZONE): Ymd {
  return tradingNightOf(startedAt, timeZone);
}

export type SampleOptions = {
  today: Ymd;
  count?: number;
  lookbackWeeks?: number;
  exclude?: Set<Ymd>;
};

/* Most recent `count` dates of `weekday` strictly before today, newest first,
   inside the lookback, skipping excluded nights (bank holidays and their
   eves, previous market nights). */
export function sampleNightDates(weekday: number, options: SampleOptions): Ymd[] {
  const count = options.count ?? DEFAULT_SAMPLE_NIGHTS;
  const lookbackWeeks = options.lookbackWeeks ?? DEFAULT_LOOKBACK_WEEKS;
  const latest = addDays(options.today, -1);
  const earliest = addDays(options.today, -7 * lookbackWeeks);

  const out: Ymd[] = [];
  let cursor = latest;
  while (weekdayOf(cursor) !== weekday) cursor = addDays(cursor, -1);
  while (cursor >= earliest && out.length < count) {
    if (!options.exclude?.has(cursor)) out.push(cursor);
    cursor = addDays(cursor, -7);
  }
  return out;
}

/* A bank holiday eve trades like the configured profile weekday (a bank
   holiday Sunday like a Saturday). Bank holidays and their eves are also kept
   OUT of the ordinary samples so they do not inflate a normal weekday. */
export function isBankHolidayNight(night: Ymd, bankHolidays: Set<Ymd>): boolean {
  return bankHolidays.has(night) || bankHolidays.has(addDays(night, 1));
}

export function profileWeekdayFor(
  night: Ymd,
  bankHolidays: Set<Ymd>,
  bankHolidayProfile: number | null | undefined
): number {
  if (bankHolidayProfile != null && bankHolidays.has(addDays(night, 1))) return bankHolidayProfile;
  return weekdayOf(night);
}

export type NightSample = {
  night: Ymd;
  units: UnitsByVariation;
};

export type SaleLineLike = {
  tradingNight: Ymd;
  variationId: string | null;
  quantity: number | string;
};

/* One sample per requested night from the synced order lines. A night with
   no lines at all comes back with an empty map, which summariseSamples
   reads as the bar being closed. */
export function samplesFromLines(nights: Ymd[], lines: SaleLineLike[]): NightSample[] {
  const byNight = new Map<Ymd, UnitsByVariation>(nights.map((night) => [night, new Map()]));
  for (const line of lines) {
    const units = byNight.get(line.tradingNight);
    if (!units || !line.variationId) continue;
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    units.set(line.variationId, (units.get(line.variationId) ?? 0) + qty);
  }
  return nights.map((night) => ({ night, units: byNight.get(night) ?? new Map() }));
}

/* Mean units per sampled night for every mapped serve. A night the bar was
   open (any orders at all) but sold none of a serve counts as zero for it;
   a night with no orders at all is treated as closed and dropped. */
export function summariseSamples(
  weekday: number,
  samples: NightSample[],
  priceIdByVariation: Map<string, number>
): NormalUnitsRow[] {
  const open = samples.filter((s) => s.units.size > 0);
  if (open.length === 0) return [];
  const totals = new Map<number, number>();
  for (const priceId of new Set(priceIdByVariation.values())) totals.set(priceId, 0);
  for (const sample of open) {
    for (const [variationId, units] of sample.units) {
      const priceId = priceIdByVariation.get(variationId);
      if (priceId == null) continue;
      totals.set(priceId, (totals.get(priceId) ?? 0) + units);
    }
  }
  const dates = open.map((s) => s.night);
  return [...totals.entries()].map(([menuItemPriceId, total]) => ({
    menuItemPriceId,
    weekday,
    unitsAvg: Math.round((total / open.length) * 100) / 100,
    nightsSampled: open.length,
    sampledDates: dates,
  }));
}

export type NormalUnitsCache = Map<number, NormalUnitsRow[]>;

/* Resolution at session open: staff override → this serve on the profile
   weekday → this serve on any weekday (flagged) → the pace floor. */
export function resolveNormalUnits(
  menuItemPriceId: number,
  profileWeekday: number,
  override: number | null | undefined,
  cache: NormalUnitsCache,
  config: Pick<MarketConfig, "paceFloorUnits">
): ResolvedNormalUnits {
  if (override != null && Number.isFinite(override) && override > 0) {
    return { value: override, source: { kind: "override" } };
  }
  const rows = cache.get(menuItemPriceId) ?? [];
  const exact = rows.find((r) => r.weekday === profileWeekday && r.nightsSampled > 0);
  if (exact) {
    return { value: exact.unitsAvg, source: { kind: "square", weekday: exact.weekday, nightsSampled: exact.nightsSampled } };
  }
  const other = rows
    .filter((r) => r.nightsSampled > 0)
    .sort((a, b) => b.nightsSampled - a.nightsSampled)[0];
  if (other) {
    return {
      value: other.unitsAvg,
      source: { kind: "square_other_weekday", weekday: other.weekday, nightsSampled: other.nightsSampled },
    };
  }
  return { value: config.paceFloorUnits, source: { kind: "fallback" } };
}

export function describeSource(source: NormalUnitsSource): string {
  switch (source.kind) {
    case "override":
      return "override";
    case "square":
      return `square:${source.weekday}:${source.nightsSampled}`;
    case "square_other_weekday":
      return `square-other:${source.weekday}:${source.nightsSampled}`;
    case "fallback":
      return "fallback";
  }
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* How many ticks a night of these hours lasts — the "÷15" on the workbook. */
export function sessionTicksFor(openTime: string, closeTime: string, tickIntervalSec: number): number {
  let minutes = clockMinutes(closeTime) - clockMinutes(openTime);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.max(1, Math.round((minutes * 60) / Math.max(1, tickIntervalSec)));
}
