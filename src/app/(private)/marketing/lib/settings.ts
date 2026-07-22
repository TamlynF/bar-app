import { createClient } from "@/lib/supabase/server";
import type { MarketingSettings } from "./types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const FALLBACK_AREA = "your local area";

export function deriveAreaFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const postcode = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const segments = address
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s && !postcode.test(s));
  return segments.length ? segments[segments.length - 1] : null;
}

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

export async function readCompanyAddress(supabase: ServerClient): Promise<string | null> {
  const { data } = await supabase
    .from("company_information")
    .select("address")
    .limit(1)
    .maybeSingle();
  return (data?.address as string | undefined) ?? null;
}

export function resolveComparisonArea(
  settings: MarketingSettings | null,
  address: string | null,
): string {
  return settings?.comparison_area?.trim() || deriveAreaFromAddress(address) || FALLBACK_AREA;
}
