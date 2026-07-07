import { createClient } from "@/lib/supabase/server";
import type { MarketingSettings } from "./types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const FALLBACK_AREA = "your local area";

/**
 * Best-effort area from the venue's freeform `company_information.address`
 * (no structured town/postcode field exists). Takes the last comma-separated
 * segment that isn't a UK postcode, e.g. "Regent Street, Hinckley" → "Hinckley".
 */
export function deriveAreaFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const postcode = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const segments = address
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s && !postcode.test(s));
  return segments.length ? segments[segments.length - 1] : null;
}

/** Read the single marketing_settings row (null if not created yet). */
export async function readMarketingSettings(
  supabase: ServerClient,
): Promise<MarketingSettings | null> {
  const { data } = await supabase
    .from("marketing_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MarketingSettings | null) ?? null;
}

/**
 * Read the single marketing_settings row, creating it if missing so callers
 * always have a stable id to update. Call only from Server Actions (it writes).
 */
export async function ensureMarketingSettings(
  supabase: ServerClient,
  defaultArea?: string | null,
): Promise<MarketingSettings | null> {
  const existing = await readMarketingSettings(supabase);
  if (existing) return existing;
  const { data } = await supabase
    .from("marketing_settings")
    .insert({ comparison_area: defaultArea ?? null })
    .select("*")
    .maybeSingle();
  return (data as MarketingSettings | null) ?? null;
}

/** Read the venue's freeform address for area derivation. */
export async function readCompanyAddress(supabase: ServerClient): Promise<string | null> {
  const { data } = await supabase
    .from("company_information")
    .select("address")
    .limit(1)
    .maybeSingle();
  return (data?.address as string | undefined) ?? null;
}

/**
 * The effective comparison area: explicit setting → derived from address →
 * a readable fallback. Never empty, so prompts always have a locality.
 */
export function resolveComparisonArea(
  settings: MarketingSettings | null,
  address: string | null,
): string {
  return settings?.comparison_area?.trim() || deriveAreaFromAddress(address) || FALLBACK_AREA;
}
