export const POSTER_MIN_WIDTH = 1600;

export type ImageSize = { width: number; height: number };

/* The home page hero stretches an event poster across the whole screen, so a
   small upload turns to mush on anything bigger than a phone. Returns the
   wording for the admin warning, or null when the picture is big enough (or
   its size could not be read). */
export function posterSizeWarning(size: ImageSize | null, minWidth: number = POSTER_MIN_WIDTH): string | null {
  if (!size || size.width <= 0 || size.height <= 0) return null;
  if (size.width >= minWidth) return null;
  return `This picture is only ${size.width} × ${size.height}px. It fills the whole screen as the home page poster and will look blurry on tablets and desktops - use one at least ${minWidth}px wide.`;
}
