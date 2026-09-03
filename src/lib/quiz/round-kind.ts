/* Which of the three shapes a quiz round takes. Derived from the category
   config, never stored - a round is a picture round because it is flagged one,
   not because something wrote "picture" against it. */

export type RoundKind = "question" | "picture" | "song";

export function roundKind(args: { isPicture: boolean; includeSpotify: boolean }): RoundKind {
  if (args.isPicture) return "picture";
  return args.includeSpotify ? "song" : "question";
}

export function roundNoun(kind: RoundKind): string {
  if (kind === "picture") return "picture";
  return kind === "song" ? "song" : "question";
}

/* The one choice the categories sheet offers in place of the three flags.
   "default" is an ordinary question round with none of them set; Higher or
   Lower is a Spotify round as well, so picking it sets both. */
export type RoundType = "default" | "spotify" | "higher_lower" | "picture";

export const ROUND_TYPES: readonly RoundType[] = ["default", "spotify", "higher_lower", "picture"];

export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  default: "Default",
  spotify: "Music Snippet",
  higher_lower: "Higher or Lower",
  picture: "Picture",
};

export type RoundFlags = {
  include_spotify: boolean;
  is_higher_lower: boolean;
  is_picture: boolean;
};

export function isRoundType(value: unknown): value is RoundType {
  return typeof value === "string" && (ROUND_TYPES as readonly string[]).includes(value);
}

export function roundTypeFor(flags: RoundFlags): RoundType {
  if (flags.is_picture) return "picture";
  if (!flags.include_spotify) return "default";
  return flags.is_higher_lower ? "higher_lower" : "spotify";
}

export function roundTypeFlags(type: RoundType): RoundFlags {
  return {
    include_spotify: type === "spotify" || type === "higher_lower",
    is_higher_lower: type === "higher_lower",
    is_picture: type === "picture",
  };
}
