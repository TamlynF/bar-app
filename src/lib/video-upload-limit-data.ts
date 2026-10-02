import { createAdminClient } from "./supabase/admin";
import { DEFAULT_VIDEO_UPLOAD_BYTES } from "./video-upload-limit";

/* The band-videos bucket's file_size_limit as set in Supabase, so raising it
   in the dashboard updates the forms without a code change. A bucket can't
   exceed the project's global cap, so its own limit is the one that applies. */
export async function getVideoUploadLimitBytes(): Promise<number> {
  const { data, error } = await createAdminClient().storage.getBucket("band-videos");
  if (error) console.error("Couldn't read the band-videos upload limit:", error);
  const limit = Number(data?.file_size_limit);
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_VIDEO_UPLOAD_BYTES;
}
