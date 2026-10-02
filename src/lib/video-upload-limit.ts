/* Used when the band-videos bucket's limit can't be read. Matches the bucket's
   limit on the live project. */
export const DEFAULT_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024;

export function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}
