import type { ImageSize } from "./poster-image-quality";

/* Browser-only: reads the pixel size of a picked file before upload. Falls
   back to null for anything the browser can't decode, so callers just skip
   the check rather than blocking the upload. */
export async function readImageFileDimensions(file: File): Promise<ImageSize | null> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) return null;
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      /* fall through to the <img> route for formats createImageBitmap rejects */
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
