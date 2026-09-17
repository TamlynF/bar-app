import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ymd } from "./normal-units";

const GOV_UK_URL = "https://www.gov.uk/bank-holidays.json";
const DIVISION = "england-and-wales";
const REFRESH_AFTER_DAYS = 30;

type GovUkFeed = Record<string, { events?: { date?: string; title?: string }[] }>;

export type BankHoliday = { date: Ymd; title: string };

export function parseGovUkFeed(feed: unknown, division: string = DIVISION): BankHoliday[] {
  const events = (feed as GovUkFeed | null)?.[division]?.events ?? [];
  return events
    .filter((e): e is { date: string; title: string } => typeof e.date === "string" && typeof e.title === "string")
    .map((e) => ({ date: e.date, title: e.title }));
}

export async function fetchUkBankHolidays(fetchImpl: typeof fetch = fetch): Promise<BankHoliday[]> {
  const res = await fetchImpl(GOV_UK_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`gov.uk bank holidays responded ${res.status}`);
  return parseGovUkFeed(await res.json());
}

type CachedRow = { date: string; fetched_at: string };

function isStale(rows: CachedRow[], now: Date): boolean {
  if (rows.length === 0) return true;
  const newest = rows.reduce((max, r) => Math.max(max, new Date(r.fetched_at).getTime()), 0);
  return now.getTime() - newest > REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/* The cached set of bank-holiday dates, refreshed from gov.uk at most once a
   month. A failed refresh keeps whatever is cached rather than throwing — a
   missing holiday only means one night is sampled as an ordinary weekday. */
export async function ensureBankHolidays(supabase: SupabaseClient, now: Date = new Date()): Promise<Set<Ymd>> {
  const { data } = await supabase.from("uk_bank_holidays").select("date, fetched_at");
  const rows = (data ?? []) as CachedRow[];
  if (isStale(rows, now)) {
    try {
      const fresh = await fetchUkBankHolidays();
      if (fresh.length > 0) {
        const { error } = await supabase
          .from("uk_bank_holidays")
          .upsert(fresh.map((h) => ({ date: h.date, title: h.title, fetched_at: now.toISOString() })), { onConflict: "date" });
        if (error) console.error("[market] bank holiday cache write failed:", error);
        else return new Set(fresh.map((h) => h.date));
      }
    } catch (err) {
      console.error("[market] bank holiday refresh failed, using cache:", err);
    }
  }
  return new Set(rows.map((r) => r.date));
}
