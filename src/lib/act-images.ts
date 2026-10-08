export const ACT_IMAGES_BUCKET = "act-images";
export const ACT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const ACT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ActImageSource = "upload" | "instagram" | "messenger" | "spotify" | "correspondence" | "migrated";

export type ActImage = {
  id: string;
  music_acts_id: string;
  band_booking_request_id: string | null;
  url: string;
  storage_path: string | null;
  source: ActImageSource;
  email_message_id: string | null;
  created_at: string;
  created_by: number | null;
};

export const ACT_IMAGE_SELECT =
  "id, music_acts_id, band_booking_request_id, url, storage_path, source, email_message_id, created_at, created_by" as const;

export const SOURCE_LABELS: Record<ActImageSource, string> = {
  upload: "Uploaded",
  instagram: "Instagram",
  messenger: "Facebook",
  spotify: "Spotify",
  correspondence: "From a message",
  migrated: "Uploaded",
};

type CoverJoin = { url: string | null } | { url: string | null }[] | null | undefined;

/* Supabase returns an embedded row as an object or a one-item array
   depending on the query, so both are read. */
export function coverUrlFromJoin(join: CoverJoin): string | null {
  const row = Array.isArray(join) ? join[0] : join;
  const url = row?.url?.trim();
  return url ? url : null;
}

export function isActImageType(type: string): boolean {
  return (ACT_IMAGE_TYPES as readonly string[]).includes(type);
}

export function isImageContentType(type: string | null | undefined): boolean {
  return !!type && /^image\/(jpeg|png|webp|gif)$/i.test(type);
}

export function formatFollowers(n: number | null | undefined): string | null {
  if (n == null || n < 0) return null;
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
}

/* How many equal squares of `thumb` px fit across `width` with `gap` px
   between them. Always at least one so the poster slot can show. */
export function fitThumbnails(width: number, thumb: number, gap: number): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + gap) / (thumb + gap)));
}

export type PhotoTile =
  | { kind: "poster"; image: ActImage | null }
  | { kind: "image"; image: ActImage; chip: string | null };

export type PhotoRow = {
  tiles: PhotoTile[];
  overflow: ActImage[];
};

const PROFILE_SOURCES: ActImageSource[] = ["instagram", "messenger"];

function chipFor(image: ActImage): string | null {
  if (image.source === "instagram") return "Instagram";
  if (image.source === "messenger") return "Facebook";
  if (image.source === "spotify") return "Spotify";
  return null;
}

function newestOf(images: ActImage[], source: ActImageSource[]): ActImage | null {
  return (
    [...images]
      .filter((i) => source.includes(i.source))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/* Order of the row, read left to right: an overflow button (when needed),
   the remaining pictures newest first, the Spotify picture, the newest
   profile picture, and the poster at the right end. `capacity` is the number
   of tiles that fit; the poster slot always takes one of them. */
export function arrangePhotoRow(images: ActImage[], coverId: string | null, capacity: number): PhotoRow {
  const cover = images.find((i) => i.id === coverId) ?? null;
  const rest = images.filter((i) => i.id !== cover?.id);
  const profile = newestOf(rest, PROFILE_SOURCES);
  const spotify = newestOf(rest, ["spotify"]);
  const named = new Set([profile?.id, spotify?.id].filter(Boolean));
  const others = rest
    .filter((i) => !named.has(i.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const ordered: ActImage[] = [...others, ...(spotify ? [spotify] : []), ...(profile ? [profile] : [])];
  const slots = Math.max(1, capacity) - 1;
  const fits = ordered.length <= slots;
  const shown = fits ? ordered : ordered.slice(ordered.length - Math.max(0, slots - 1));
  const overflow = fits ? [] : ordered.slice(0, ordered.length - shown.length);

  return {
    tiles: [
      ...shown.map((image): PhotoTile => ({ kind: "image", image, chip: chipFor(image) })),
      { kind: "poster", image: cover },
    ],
    overflow,
  };
}

export const CLOSED_BAND_STATUSES = ["declined", "cancelled"] as const;

export type BookingForCoverCheck = {
  id: string;
  group_name: string;
  status: string;
  selected_date: string | null;
  cover_image_id: string | null;
};

/* Bookings the act sheet asks about when the act's poster changes: still
   open, not yet played (or no date yet), and not already on the new poster. */
export function bookingsToAskAboutCover(
  bookings: BookingForCoverCheck[],
  newCoverId: string | null,
  today: string
): BookingForCoverCheck[] {
  return bookings.filter(
    (b) =>
      !(CLOSED_BAND_STATUSES as readonly string[]).includes(b.status) &&
      (b.selected_date == null || b.selected_date === "" || b.selected_date >= today) &&
      (b.cover_image_id ?? null) !== newCoverId
  );
}

/* The booking sheet asks before touching the act's poster only when the act
   already has a different one; an empty act poster is filled in silently. */
export function shouldAskActCoverUpdate(actCoverId: string | null, newCoverId: string | null): boolean {
  return !!newCoverId && !!actCoverId && actCoverId !== newCoverId;
}
