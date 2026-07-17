"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { upsertContactByEmail, type SocialLinks } from "@/lib/music-acts";

export interface MusicActInput {
  id?: string;
  group_name: string;
  type?: string | null;
  genre?: string | null;
  introduction?: string | null;
  spotify_url?: string | null;
  web_url?: string | null;
  cover_image_url?: string | null;
  image_urls?: string[];
  social_links?: SocialLinks;
  video_urls?: string[];
  video_descriptions?: string[];
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_payment_ref?: string | null;
  internal_notes?: string | null;
  is_favorite?: boolean;
  /** Contact fields — upserted to `contacts` (matched by email) and linked. */
  contact?: { booker_name?: string | null; email?: string | null; phone_no?: string | null };
}

async function currentEmployeeId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  return emp?.id ?? null;
}

export async function saveMusicActAction(
  input: MusicActInput
): Promise<{ success: true; id: string } | { error: string }> {
  const supabase = await createClient();

  const group_name = input.group_name?.trim();
  if (!group_name) return { error: "Group name is required." };

  const empId = await currentEmployeeId(supabase);

  // Link a contact when an email is given (matched by the UNIQUE email column).
  let contactId: number | null = null;
  if (input.contact?.email?.trim()) {
    contactId = await upsertContactByEmail(
      supabase,
      {
        booker_name: input.contact.booker_name ?? group_name,
        email: input.contact.email,
        phone_no: input.contact.phone_no,
      },
      empId
    );
  }

  const payload = {
    group_name,
    type: input.type?.trim() || null,
    genre: input.genre?.trim() || null,
    introduction: input.introduction?.trim() || null,
    spotify_url: input.spotify_url?.trim() || null,
    web_url: input.web_url?.trim() || null,
    cover_image_url: input.cover_image_url?.trim() || null,
    image_urls: (input.image_urls ?? []).filter(Boolean),
    social_links: input.social_links ?? {},
    video_urls: (input.video_urls ?? []).filter(Boolean),
    video_descriptions: input.video_descriptions ?? [],
    bank_account_no: input.bank_account_no?.trim() || null,
    bank_account_name: input.bank_account_name?.trim() || null,
    bank_sort_code: input.bank_sort_code?.trim() || null,
    bank_payment_ref: input.bank_payment_ref?.trim() || null,
    internal_notes: input.internal_notes?.trim() || null,
    is_favorite: !!input.is_favorite,
    ...(contactId != null ? { contact_id: contactId } : {}),
  };

  try {
    if (input.id) {
      const { error } = await supabase
        .from("music_acts")
        .update({ ...payload, updated_at: new Date().toISOString(), updated_by: empId })
        .eq("id", input.id);
      if (error) throw error;
      revalidatePath("/settings/music-acts");
      return { success: true, id: input.id };
    }

    const { data, error } = await supabase
      .from("music_acts")
      .insert({ ...payload, created_by: empId, updated_by: empId })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/settings/music-acts");
    return { success: true, id: data.id as string };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505") return { error: "A music act with these details already exists." };
    console.error("Error saving music act:", error);
    return { error: error instanceof Error ? error.message : "Failed to save music act." };
  }
}

export async function deleteMusicActAction(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  try {
    const { error } = await supabase.from("music_acts").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/settings/music-acts");
    return { success: true };
  } catch (error) {
    console.error("Error deleting music act:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete music act." };
  }
}
