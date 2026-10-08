import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACT_IMAGES_BUCKET,
  ACT_IMAGE_MAX_BYTES,
  ACT_IMAGE_SELECT,
  isImageContentType,
  type ActImage,
  type ActImageSource,
} from "@/lib/act-images";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function loadActImages(supabase: SupabaseClient, actId: string): Promise<ActImage[]> {
  const { data, error } = await supabase
    .from("music_act_images")
    .select(ACT_IMAGE_SELECT)
    .eq("music_acts_id", actId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadActImages failed:", error.message);
    return [];
  }
  return (data ?? []) as ActImage[];
}

export async function loadActImagesForActs(
  supabase: SupabaseClient,
  actIds: string[]
): Promise<Record<string, ActImage[]>> {
  const ids = [...new Set(actIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("music_act_images")
    .select(ACT_IMAGE_SELECT)
    .in("music_acts_id", ids)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadActImagesForActs failed:", error.message);
    return {};
  }
  const byAct: Record<string, ActImage[]> = {};
  for (const row of (data ?? []) as ActImage[]) {
    (byAct[row.music_acts_id] ??= []).push(row);
  }
  return byAct;
}

export type StoredImage = { url: string; path: string };

/* Writes image bytes into the public act-images bucket under
   <folder>/<source>-<random>.<ext>. Returns null (and logs) rather than
   throwing, so a missing picture never blocks the thing that asked for it. */
export async function storeActImageBytes(
  folder: string,
  bytes: Buffer | ArrayBuffer | Uint8Array,
  contentType: string,
  source: ActImageSource
): Promise<StoredImage | null> {
  if (!isImageContentType(contentType)) return null;
  const body = bytes instanceof Buffer ? bytes : Buffer.from(bytes as ArrayBuffer);
  if (body.byteLength === 0 || body.byteLength > ACT_IMAGE_MAX_BYTES) return null;
  const ext = EXT_BY_TYPE[contentType.toLowerCase()] ?? "jpg";
  const path = `${folder}/${source}-${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(ACT_IMAGES_BUCKET)
    .upload(path, body, { contentType, cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("storeActImageBytes upload failed:", error.message);
    return null;
  }
  return { url: admin.storage.from(ACT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl, path };
}

export async function storeActImageFromUrl(
  actId: string,
  sourceUrl: string,
  source: ActImageSource
): Promise<StoredImage | null> {
  try {
    const res = await fetch(sourceUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    return storeActImageBytes(actId, await res.arrayBuffer(), contentType, source);
  } catch (err) {
    console.error("storeActImageFromUrl failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export type NewActImage = {
  actId: string;
  requestId?: string | null;
  url: string;
  storagePath?: string | null;
  source: ActImageSource;
  emailMessageId?: string | null;
  createdBy?: number | null;
};

export async function insertActImage(supabase: SupabaseClient, input: NewActImage): Promise<ActImage | null> {
  const { data, error } = await supabase
    .from("music_act_images")
    .insert({
      music_acts_id: input.actId,
      band_booking_request_id: input.requestId ?? null,
      url: input.url,
      storage_path: input.storagePath ?? null,
      source: input.source,
      email_message_id: input.emailMessageId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(ACT_IMAGE_SELECT)
    .single();
  if (error) {
    console.error("insertActImage failed:", error.message);
    return null;
  }
  return data as ActImage;
}

/* Fetches a picture from a URL, keeps a copy and records it against the act.
   One call for Spotify, Meta profile pictures and the like. */
export async function captureActImage(
  supabase: SupabaseClient,
  input: Omit<NewActImage, "url" | "storagePath"> & { sourceUrl: string }
): Promise<ActImage | null> {
  const stored = await storeActImageFromUrl(input.actId, input.sourceUrl, input.source);
  if (!stored) return null;
  return insertActImage(supabase, { ...input, url: stored.url, storagePath: stored.path });
}

export async function actHasImageFromSource(
  supabase: SupabaseClient,
  actId: string,
  source: ActImageSource,
  sourceUrlMarker?: string | null
): Promise<boolean> {
  let q = supabase.from("music_act_images").select("id", { count: "exact", head: true }).eq("music_acts_id", actId).eq("source", source);
  if (sourceUrlMarker) q = q.eq("url", sourceUrlMarker);
  const { count } = await q;
  return (count ?? 0) > 0;
}

export async function setActCover(
  supabase: SupabaseClient,
  actId: string,
  coverId: string | null,
  employeeId: number | null = null
): Promise<string | null> {
  const { error } = await supabase
    .from("music_acts")
    .update({ cover_image_id: coverId, updated_at: new Date().toISOString(), updated_by: employeeId })
    .eq("id", actId);
  if (error) {
    console.error("setActCover failed:", error.message);
    return error.message;
  }
  return null;
}

export async function setRequestCover(
  supabase: SupabaseClient,
  requestId: string,
  coverId: string | null,
  employeeId: number | null = null
): Promise<string | null> {
  const { error } = await supabase
    .from("band_booking_requests")
    .update({ cover_image_id: coverId, updated_at: new Date().toISOString(), updated_by: employeeId })
    .eq("id", requestId);
  if (error) {
    console.error("setRequestCover failed:", error.message);
    return error.message;
  }
  return null;
}

export async function setRequestCovers(
  supabase: SupabaseClient,
  requestIds: string[],
  coverId: string | null,
  employeeId: number | null = null
): Promise<string | null> {
  if (requestIds.length === 0) return null;
  const { error } = await supabase
    .from("band_booking_requests")
    .update({ cover_image_id: coverId, updated_at: new Date().toISOString(), updated_by: employeeId })
    .in("id", requestIds);
  if (error) {
    console.error("setRequestCovers failed:", error.message);
    return error.message;
  }
  return null;
}
