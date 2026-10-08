"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { revalidatePublicEventPages } from "@/lib/revalidate-public";
import { upsertContactByEmail, type SocialLinks } from "@/lib/music-acts";
import { sanitizeBankAccounts, type BankAccount } from "@/lib/bank-accounts";
import { setRequestCovers } from "@/lib/act-images-server";

export interface MusicActInput {
  id?: string;
  group_name: string;
  type?: string | null;
  genre?: string | null;
  introduction?: string | null;
  spotify_url?: string | null;
  web_url?: string | null;
  cover_image_id?: string | null;
  cover_booking_ids?: string[];
  social_links?: SocialLinks;
  video_urls?: string[];
  video_descriptions?: string[];
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_payment_ref?: string | null;
  extra_bank_accounts?: BankAccount[];
  is_favorite?: boolean;
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
    cover_image_id: input.cover_image_id ?? null,
    social_links: input.social_links ?? {},
    video_urls: (input.video_urls ?? []).filter(Boolean),
    video_descriptions: input.video_descriptions ?? [],
    bank_account_no: input.bank_account_no?.trim() || null,
    bank_account_name: input.bank_account_name?.trim() || null,
    bank_sort_code: input.bank_sort_code?.trim() || null,
    bank_payment_ref: input.bank_payment_ref?.trim() || null,
    ...(input.extra_bank_accounts ? { extra_bank_accounts: sanitizeBankAccounts(input.extra_bank_accounts) } : {}),
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
      const coverError = await setRequestCovers(supabase, input.cover_booking_ids ?? [], input.cover_image_id ?? null, empId);
      if (coverError) throw new Error(coverError);
      revalidatePath("/settings/music-acts");
      revalidatePath("/event-bookings/music-bookings");
      revalidatePath("/event-setups/events");
      revalidatePublicEventPages();
      return { success: true, id: input.id };
    }

    const { data, error } = await supabase
      .from("music_acts")
      .insert({ ...payload, created_by: empId, updated_by: empId })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/settings/music-acts");
    revalidatePublicEventPages();
    return { success: true, id: data.id as string };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505") return { error: "A music act with these details already exists." };
    console.error("Error saving music act:", error);
    return { error: error instanceof Error ? error.message : "Failed to save music act." };
  }
}

async function patchMusicAct(
  id: string,
  patch: Record<string, unknown>
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const empId = await currentEmployeeId(supabase);

  const { error } = await supabase
    .from("music_acts")
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: empId })
    .eq("id", id);

  if (error) {
    console.error("Error updating music act:", error);
    return { error: error.message };
  }

  revalidatePath("/settings/music-acts");
  return { success: true };
}

export async function setMusicActFavoriteAction(id: string, isFavorite: boolean) {
  return patchMusicAct(id, { is_favorite: isFavorite });
}

export async function addMusicActNote(actId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("A note can't be empty.");

  const supabase = await createClient();
  const empId = await currentEmployeeId(supabase);
  const { error } = await supabase
    .from("music_act_notes")
    .insert({ act_id: actId, body: text, created_by: empId, updated_by: empId });

  if (error) throw new Error("Failed to add the note.");
  revalidatePath("/settings/music-acts");
}

export async function updateMusicActNote(noteId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("A note can't be empty.");

  const supabase = await createClient();
  const empId = await currentEmployeeId(supabase);
  const { error } = await supabase
    .from("music_act_notes")
    .update({ body: text, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", noteId);

  if (error) throw new Error("Failed to save the note.");
  revalidatePath("/settings/music-acts");
}

export async function deleteMusicActNote(noteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("music_act_notes").delete().eq("id", noteId);

  if (error) throw new Error("Failed to delete the note.");
  revalidatePath("/settings/music-acts");
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
