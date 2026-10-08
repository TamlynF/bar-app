"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { coverUrlFromJoin } from "@/lib/act-images";

export type ExistingPoster = { imageId: string; url: string };

/* The poster an act already has with us, found the same way the application
   is filed: the contact's email plus the act name. Both must match before
   anything comes back, and only the picture does. */
export async function findActPoster(email: string, groupName: string): Promise<ExistingPoster | null> {
  const address = email.trim().toLowerCase();
  const name = groupName.trim();
  if (!address || !name) return null;

  const admin = createAdminClient();
  const { data: contact } = await admin.from("contacts").select("id").eq("email", address).maybeSingle();
  if (!contact) return null;

  const { data: act } = await admin
    .from("music_acts")
    .select("cover_image_id, cover_image:music_act_images!music_acts_cover_image_id_fkey(url)")
    .eq("contact_id", contact.id)
    .ilike("group_name", name)
    .maybeSingle();
  const url = coverUrlFromJoin(act?.cover_image as { url: string | null } | { url: string | null }[] | null);
  if (!act?.cover_image_id || !url) return null;
  return { imageId: act.cover_image_id as string, url };
}
