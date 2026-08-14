import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CONTACT_EMAIL } from "@/lib/email";

export type DayHours = { open?: string | null; close?: string | null };
export type OpeningHours = Partial<Record<string, DayHours>>;

export type CompanyInfoRow = {
  id: number;
  name: string | null;
  logo_url: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  tiktok: string | null;
  youtube: string | null;
  max_capacity: number | null;
  private_hire_min_capacity: number | null;
  description: string | null;
  opening_hours: OpeningHours | null;
  tagline: string | null;
  tagline_accent: string | null;
  room_outline: unknown;
  obstacles: unknown;
  fixtures: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export type CompanyInfo = CompanyInfoRow | null;

export const getCompanyInfo = cache(async (): Promise<CompanyInfo> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_information")
    .select("*")
    .maybeSingle();

  return (data ?? null) as CompanyInfo;
});

export async function getContactEmail(): Promise<string> {
  const info = await getCompanyInfo();
  return info?.email?.trim() || DEFAULT_CONTACT_EMAIL;
}

export function instagramUrl(handle: string | null | undefined): string | null {
  const value = handle?.trim();
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return `https://instagram.com/${value.replace("@", "")}`;
}
