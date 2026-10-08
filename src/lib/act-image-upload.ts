import { createClient } from "@/lib/supabase/client";
import { ACT_IMAGES_BUCKET, ACT_IMAGE_MAX_BYTES, isActImageType } from "@/lib/act-images";

export type UploadedActImage = { url: string; path: string };

const EXT_BY_TYPE: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function actImageFileProblem(file: File): string | null {
  if (!isActImageType(file.type)) return "Please choose a JPEG, PNG or WebP image.";
  if (file.size > ACT_IMAGE_MAX_BYTES) return `That image is too large (max ${Math.round(ACT_IMAGE_MAX_BYTES / 1024 / 1024)} MB).`;
  return null;
}

/* Browser-side upload straight into the public act-images bucket, the same
   way the form sends videos, so the server only ever receives a URL. */
export async function uploadActImage(file: File, folder: string): Promise<UploadedActImage> {
  const problem = actImageFileProblem(file);
  if (problem) throw new Error(problem);
  const supabase = createClient();
  const path = `${folder}/upload-${crypto.randomUUID()}.${EXT_BY_TYPE[file.type] ?? "jpg"}`;
  const { data, error } = await supabase.storage
    .from(ACT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return { url: supabase.storage.from(ACT_IMAGES_BUCKET).getPublicUrl(data.path).data.publicUrl, path: data.path };
}
