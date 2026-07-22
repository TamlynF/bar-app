import * as tus from "tus-js-client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "band-videos";

export interface ResumableHandle {
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
