import * as tus from "tus-js-client";

/**
 * Resumable (TUS) upload to Supabase Storage, used by the public band booking
 * form for large performance videos. Standard `.upload()` is unreliable for big
 * files; the TUS protocol chunks the file and survives transient network drops.
 *
 * Auth uses the public anon key (this is an unauthenticated public form). Whatever
 * storage policy permits anon inserts on the bucket in prod is what allows this.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "band-videos";

export interface ResumableHandle {
  /** Abort the in-flight upload (also terminates it server-side). */
  abort: () => void;
}

export interface ResumableCallbacks {
  onProgress?: (percent: number) => void;
  onSuccess: (publicUrl: string) => void;
  onError: (message: string) => void;
}

export function uploadVideoResumable(
  file: File,
  path: string,
  { onProgress, onSuccess, onError }: ResumableCallbacks
): ResumableHandle {
  const upload = new tus.Upload(file, {
    endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
    retryDelays: [0, 1000, 3000, 5000],
    headers: {
      authorization: `Bearer ${ANON_KEY}`,
      "x-upsert": "true",
    },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    // Supabase requires a fixed 6 MB chunk size for resumable uploads.
    chunkSize: 6 * 1024 * 1024,
    metadata: {
      bucketName: BUCKET,
      objectName: path,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    },
    onError(error) {
      onError(error instanceof Error ? error.message : "Upload failed");
    },
    onProgress(bytesUploaded, bytesTotal) {
      if (onProgress && bytesTotal > 0) {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      }
    },
    onSuccess() {
      onSuccess(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`);
    },
  });

  upload.start();

  return { abort: () => void upload.abort(true) };
}
