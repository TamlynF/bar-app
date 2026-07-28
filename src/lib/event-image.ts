export type EventImageSource = "event" | "act" | "subtype" | "none";

export type ResolvedEventImage = {
  url: string | null;
  source: EventImageSource;
};

export type EventImageInput = {
  eventImageUrl?: string | null;
  actCoverUrl?: string | null;
  subtypeDefaultUrl?: string | null;
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveEventImage({
  eventImageUrl,
  actCoverUrl,
  subtypeDefaultUrl,
}: EventImageInput): ResolvedEventImage {
  const own = nonEmpty(eventImageUrl);
  if (own) return { url: own, source: "event" };

  const act = nonEmpty(actCoverUrl);
  if (act) return { url: act, source: "act" };

  const subtype = nonEmpty(subtypeDefaultUrl);
  if (subtype) return { url: subtype, source: "subtype" };

  return { url: null, source: "none" };
}
