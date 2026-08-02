export type MediaKind = "image" | "video";

export type QualityLevel = "good" | "warn" | "reject";

export type MediaQuality = {
  level: QualityLevel;
  longEdge: number;
  message: string;
};

export const LIGHTBOX_IDEAL_EDGE = 1920;

export const LIGHTBOX_MIN_EDGE: Record<MediaKind, number> = {
  image: 1200,
  video: 1280,
};

const KIND_LABEL: Record<MediaKind, string> = {
  image: "Image",
  video: "Video",
};

export const QUALITY_BADGE: Record<QualityLevel, string> = {
  good: "Sharp",
  warn: "Soft",
  reject: "Low res",
};

export const QUALITY_SUMMARY: Record<QualityLevel, string> = {
  good: "sharp fullscreen",
  warn: "soft on large screens",
  reject: "too small for fullscreen",
};

export function gradeGalleryMedia({
  width,
  height,
  kind,
}: {
  width: number;
  height: number;
  kind: MediaKind;
}): MediaQuality {
  const usable =
    Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;

  if (!usable) {
    return {
      level: "warn",
      longEdge: 0,
      message: `Could not read the ${kind} dimensions. Check how it looks on the public gallery after saving.`,
    };
  }

  const longEdge = Math.max(width, height);
  const size = `${width} x ${height}`;
  const minimum = LIGHTBOX_MIN_EDGE[kind];

  if (longEdge < minimum) {
    return {
      level: "reject",
      longEdge,
      message: `${KIND_LABEL[kind]} is too small for the fullscreen gallery (${size}). The longest side must be at least ${minimum}px - ${LIGHTBOX_IDEAL_EDGE}px is ideal.`,
    };
  }

  if (longEdge < LIGHTBOX_IDEAL_EDGE) {
    return {
      level: "warn",
      longEdge,
      message: `${size} will look soft when opened fullscreen on a large screen. ${LIGHTBOX_IDEAL_EDGE}px on the longest side is recommended.`,
    };
  }

  return {
    level: "good",
    longEdge,
    message: `${size} - sharp at fullscreen.`,
  };
}
