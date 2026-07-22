import type { SupabaseClient } from "@supabase/supabase-js";


export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
};

export interface MusicActRow {
  id: string;
  group_name: string;
  type: string | null;
  genre: string | null;
  introduction: string | null;
  spotify_url: string | null;
  cover_image_url: string | null;
  image_urls: string[];
  social_links: SocialLinks | null;
  video_urls: string[];
  video_descriptions: string[];
  web_url: string | null;
  contact_id: number | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_payment_ref: string | null;
  internal_notes: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
  created_by: number | null;
}

export interface BandSharedActFields {
  group_name: string;
  type?: string | null;
  genre?: string | null;
  spotify_url?: string | null;
  social_links?: SocialLinks | null;
  video_urls?: string[] | null;
  video_descriptions?: string[] | null;
}

export async function upsertContactByEmail(
  supabase: SupabaseClient,
  contact: { booker_name?: string | null; email: string; phone_no?: string | null },
  employeeId: number | null = null
): Promise<number | null> {
  const email = contact.email?.trim().toLowerCase();
  if (!email) return null;

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return existing.id as number;

  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      full_name: contact.booker_name?.trim() || email,
      email,
      phone_no: contact.phone_no?.trim() || null,
      created_by: employeeId,
      updated_by: employeeId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("upsertContactByEmail insert failed:", error);
    return null;
  }
  return created.id as number;
}

function actPayloadFromShared(fields: BandSharedActFields) {
  return {
    group_name: fields.group_name?.trim() || "Unnamed act",
    type: fields.type ?? null,
    genre: fields.genre ?? null,
    spotify_url: fields.spotify_url?.trim() || null,
    social_links: fields.social_links ?? {},
    video_urls: (fields.video_urls ?? []).filter(Boolean),
    video_descriptions: fields.video_descriptions ?? [],
  };
}

export async function upsertMusicActFromBand(
  supabase: SupabaseClient,
  args: BandSharedActFields & { contactId: number | null },
  employeeId: number | null = null
): Promise<string | null> {
  const payload = actPayloadFromShared(args);

  let existingId: string | null = null;
  if (args.contactId != null) {
    const { data: match } = await supabase
      .from("music_acts")
      .select("id")
      .eq("contact_id", args.contactId)
      .ilike("group_name", payload.group_name)
      .maybeSingle();
    if (match) existingId = match.id as string;
  }

  if (existingId) {
    const { error } = await supabase
      .from("music_acts")
      .update({
        ...payload,
        contact_id: args.contactId,
        updated_at: new Date().toISOString(),
        updated_by: employeeId,
      })
      .eq("id", existingId);
    if (error) {
      console.error("upsertMusicActFromBand update failed:", error);
      return existingId; // still linkable
    }
    return existingId;
  }

  const { data: created, error } = await supabase
    .from("music_acts")
    .insert({
      ...payload,
      contact_id: args.contactId,
      created_by: employeeId,
      updated_by: employeeId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("upsertMusicActFromBand insert failed:", error);
    return null;
  }
  return created.id as string;
}

export async function syncMusicActFields(
  supabase: SupabaseClient,
  actId: string,
  fields: BandSharedActFields & {
    bank_account_no?: string | null;
    bank_account_name?: string | null;
    bank_sort_code?: string | null;
    bank_payment_ref?: string | null;
  },
  employeeId: number | null = null
): Promise<void> {
  const { error } = await supabase
    .from("music_acts")
    .update({
      ...actPayloadFromShared(fields),
      bank_account_no: fields.bank_account_no ?? null,
      bank_account_name: fields.bank_account_name ?? null,
      bank_sort_code: fields.bank_sort_code ?? null,
      bank_payment_ref: fields.bank_payment_ref ?? null,
      updated_at: new Date().toISOString(),
      updated_by: employeeId,
    })
    .eq("id", actId);
  if (error) console.error("syncMusicActFields failed:", error);
}
