export type BookingGroupKey = "pub_games" | "live_music" | "featured_nights" | "more";

export const BOOKING_GROUP_ORDER: BookingGroupKey[] = ["pub_games", "live_music", "featured_nights", "more"];

export const BOOKING_GROUP_LABELS: Record<BookingGroupKey, string> = {
  pub_games: "Pub Games",
  live_music: "Live Music",
  featured_nights: "Featured Nights",
  more: "More Nights",
};

/* Live music is a behaviour, not a type: a band, DJ or singer night lands
   here whatever its type is called. Games and parties go by type name. */
export function bookingGroupFor(typeName: string | null | undefined, behavior: string | null | undefined): BookingGroupKey {
  if (behavior === "music_act") return "live_music";
  const type = (typeName ?? "").trim().toLowerCase();
  if (type === "games" || type === "game") return "pub_games";
  if (type === "party" || type === "parties") return "featured_nights";
  return "more";
}

export type BookingGroup<T> = { key: BookingGroupKey; label: string; cards: T[] };

export function groupBookingCards<T extends { group: BookingGroupKey; date: string | null }>(cards: T[]): BookingGroup<T>[] {
  return BOOKING_GROUP_ORDER.map((key) => ({
    key,
    label: BOOKING_GROUP_LABELS[key],
    cards: cards.filter((c) => c.group === key).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
  })).filter((g) => g.cards.length > 0);
}
