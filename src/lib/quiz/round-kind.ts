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
