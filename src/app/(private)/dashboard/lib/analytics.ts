

type JoinOneOrMany<T> = T | T[] | null;

function one<T>(v: JoinOneOrMany<T>): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type AnalyticsBookingRow = {
  created_at: string;
  paid_amount: number | null;
  total_amount: number | null;
  status: string;
  payment_status: string;
  group_size: number | null;
  contact_id: number | null;
  events: JoinOneOrMany<{
    date: string;
    event_types: JoinOneOrMany<{ name: string }>;
  }>;
};

export type PrivateHireRevenueRow = {
  paid_amount: number | null;
  status: string;
  created_at: string;
};

export type BandCostRow = {
  payment_amount: number | null;
  status: string;
  selected_date: string | null;
};


function weekStart(d: Date): Date {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7; // Mon=0 … Sun=6
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export type WeeklyPoint = {
  week: string;      // label for the X axis
  revenue: number;   // £ paid in bookings created that week
  bookings: number;  // bookings created that week (non-cancelled)
  guests: number;    // sum of group_size
};

export function weeklyTrend(
  bookings: AnalyticsBookingRow[],
  weeks = 12,
  now: Date = new Date()
): WeeklyPoint[] {
  const buckets = new Map<number, WeeklyPoint>();
  const latest = weekStart(now);

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(latest);
    start.setDate(start.getDate() - i * 7);
    buckets.set(start.getTime(), {
      week: weekLabel(start),
      revenue: 0,
      bookings: 0,
      guests: 0,
    });
  }

  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const key = weekStart(new Date(b.created_at)).getTime();
    const bucket = buckets.get(key);
    if (!bucket) continue; // outside the window
    bucket.revenue += b.paid_amount ?? 0;
    bucket.bookings += 1;
    bucket.guests += b.group_size ?? 0;
  }

  return [...buckets.values()].map((p) => ({
    ...p,
    revenue: Math.round(p.revenue * 100) / 100,
  }));
}


export type MonthStats = {
  collected: number;
  outstanding: number;
  bookings: number;
  guests: number;
};

export function monthStats(bookings: AnalyticsBookingRow[]): MonthStats {
  let collected = 0;
  let outstanding = 0;
  let count = 0;
  let guests = 0;
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    collected += b.paid_amount ?? 0;
    if (b.payment_status === "unpaid") {
      outstanding += (b.total_amount ?? 0) - (b.paid_amount ?? 0);
    }
    count += 1;
    guests += b.group_size ?? 0;
  }
  return {
    collected: Math.round(collected * 100) / 100,
    outstanding: Math.round(Math.max(0, outstanding) * 100) / 100,
    bookings: count,
    guests,
  };
}

export type Delta = {
  pct: number | null;
  direction: "up" | "down" | "flat";
};

export function delta(current: number, previous: number): Delta {
  if (previous === 0) {
    return { pct: null, direction: current > 0 ? "up" : "flat" };
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  return { pct, direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}


export type RevenueByType = { type: string; revenue: number };

export function revenueByEventType(
  bookings: AnalyticsBookingRow[],
  privateHires: PrivateHireRevenueRow[] = []
): RevenueByType[] {
  const totals = new Map<string, number>();

  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const paid = b.paid_amount ?? 0;
    if (paid <= 0) continue;
    const ev = one(b.events);
    const typeName = one(ev?.event_types ?? null)?.name ?? "Other";
    totals.set(typeName, (totals.get(typeName) ?? 0) + paid);
  }

  const hireTotal = privateHires
    .filter((h) => h.status !== "cancelled")
    .reduce((s, h) => s + (h.paid_amount ?? 0), 0);
  if (hireTotal > 0) {
    totals.set("Private Hire", (totals.get("Private Hire") ?? 0) + hireTotal);
  }

  return [...totals.entries()]
    .map(([type, revenue]) => ({ type, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function entertainmentSpend(bands: BandCostRow[]): number {
  const total = bands
    .filter((b) => b.status === "booked")
    .reduce((s, b) => s + (b.payment_amount ?? 0), 0);
  return Math.round(total * 100) / 100;
}


export type GuestSplit = { newGuests: number; returning: number; returningPct: number };

export function newVsReturning(
  monthBookings: AnalyticsBookingRow[],
  priorContactIds: Set<number>
): GuestSplit {
  const seen = new Set<number>();
  let newGuests = 0;
  let returning = 0;

  for (const b of monthBookings) {
    if (b.status === "cancelled" || b.contact_id == null) continue;
    if (seen.has(b.contact_id)) continue; // count each guest once per month
    seen.add(b.contact_id);
    if (priorContactIds.has(b.contact_id)) returning += 1;
    else newGuests += 1;
  }

  const total = newGuests + returning;
  return {
    newGuests,
    returning,
    returningPct: total === 0 ? 0 : Math.round((returning / total) * 100),
  };
}


export function cancellationRate(bookings: AnalyticsBookingRow[]): number {
  if (bookings.length === 0) return 0;
  const cancelled = bookings.filter((b) => b.status === "cancelled").length;
  return Math.round((cancelled / bookings.length) * 100);
}

export function medianLeadTimeDays(bookings: AnalyticsBookingRow[]): number {
  const leads: number[] = [];
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const ev = one(b.events);
    if (!ev?.date) continue;
    const diff =
      (new Date(ev.date).getTime() - new Date(b.created_at).getTime()) / 86_400_000;
    if (diff >= 0) leads.push(diff);
  }
  if (leads.length === 0) return 0;
  leads.sort((a, b) => a - b);
  const mid = Math.floor(leads.length / 2);
  const median =
    leads.length % 2 === 0 ? (leads[mid - 1] + leads[mid]) / 2 : leads[mid];
  return Math.round(median * 10) / 10;
}

export function bookingsByDayOfWeek(
  bookings: AnalyticsBookingRow[]
): { day: string; bookings: number }[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = new Array(7).fill(0);
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const ev = one(b.events);
    if (!ev?.date) continue;
    counts[(new Date(ev.date).getDay() + 6) % 7] += 1;
  }
  return days.map((day, i) => ({ day, bookings: counts[i] }));
}


const BOOKING_SELECT =
  "created_at, paid_amount, total_amount, status, payment_status, group_size, contact_id, events!bookings_event_id_fkey(date, event_types(name))";

type SupabaseLike = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type DashboardAnalytics = {
  weekly: WeeklyPoint[];
  thisMonth: MonthStats;
  lastMonth: MonthStats;
  deltas: { collected: Delta; bookings: Delta; guests: Delta };
  revenueByType: RevenueByType[];
  bandSpendThisMonth: number;
  guestSplit: GuestSplit;
  cancellationPct: number;
  medianLeadDays: number;
  byDayOfWeek: { day: string; bookings: number }[];
};

export async function fetchDashboardAnalytics(
  supabase: SupabaseLike,
  now: Date = new Date()
): Promise<DashboardAnalytics> {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const twelveWeeksAgo = new Date(weekStart(now));
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 11 * 7);

  const windowStart = new Date(
    Math.min(twelveWeeksAgo.getTime(), firstOfPrevMonth.getTime())
  ).toISOString();

  const [
    { data: windowBookings },
    { data: priorContacts },
    { data: monthHires },
    { data: monthBands },
  ] = await Promise.all([
    supabase.from("bookings").select(BOOKING_SELECT).gte("created_at", windowStart),
    supabase
      .from("bookings")
      .select("contact_id")
      .lt("created_at", firstOfMonth.toISOString())
      .neq("status", "cancelled")
      .not("contact_id", "is", null),
    supabase
      .from("private_hire_requests")
      .select("paid_amount, status, created_at")
      .gte("created_at", firstOfMonth.toISOString()),
    supabase
      .from("band_booking_requests")
      .select("payment_amount, status, selected_date")
      .gte("selected_date", firstOfMonth.toISOString().split("T")[0]),
  ]);

  const all = (windowBookings ?? []) as AnalyticsBookingRow[];
  const inRange = (b: AnalyticsBookingRow, from: Date, to?: Date) => {
    const t = new Date(b.created_at).getTime();
    return t >= from.getTime() && (to === undefined || t < to.getTime());
  };

  const thisMonthRows = all.filter((b) => inRange(b, firstOfMonth));
  const lastMonthRows = all.filter((b) => inRange(b, firstOfPrevMonth, firstOfMonth));

  const thisMonth = monthStats(thisMonthRows);
  const lastMonth = monthStats(lastMonthRows);

  const priorContactIds = new Set<number>(
    ((priorContacts ?? []) as { contact_id: number }[]).map((c) => c.contact_id)
  );

  return {
    weekly: weeklyTrend(all, 12, now),
    thisMonth,
    lastMonth,
    deltas: {
      collected: delta(thisMonth.collected, lastMonth.collected),
      bookings: delta(thisMonth.bookings, lastMonth.bookings),
      guests: delta(thisMonth.guests, lastMonth.guests),
    },
    revenueByType: revenueByEventType(
      thisMonthRows,
      (monthHires ?? []) as PrivateHireRevenueRow[]
    ),
    bandSpendThisMonth: entertainmentSpend((monthBands ?? []) as BandCostRow[]),
    guestSplit: newVsReturning(thisMonthRows, priorContactIds),
    cancellationPct: cancellationRate(thisMonthRows),
    medianLeadDays: medianLeadTimeDays(thisMonthRows),
    byDayOfWeek: bookingsByDayOfWeek(thisMonthRows),
  };
}