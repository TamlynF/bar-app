/**
 * The single discriminator for "what kind of night" an event sub-type is.
 *
 * Replaces the old per-subtype boolean kind-flags (`is_quiz`, `is_karaoke`,
 * `is_private`, `is_music_act`) and the hardcoded type/subtype name-string
 * checks (`name === "bingo"`, `event_types.name === "games"`, etc.) with one
 * mutually-exclusive value stored on `event_subtypes.behavior`.
 *
 * Capability flags (`is_bookable`, `host_required`, `seating_required`,
 * `payment_required`) are independent and stay separate — they are NOT part of
 * this enum.
 */
export const EVENT_BEHAVIORS = [
  "standard",
  "quiz",
  "bingo",
  "karaoke",
  "music_act",
  "private",
] as const;

export type EventBehavior = (typeof EVENT_BEHAVIORS)[number];

export const BEHAVIOR_LABELS: Record<EventBehavior, string> = {
  standard: "Standard",
  quiz: "Quiz",
  bingo: "Bingo",
  karaoke: "Karaoke",
  music_act: "Music Act",
  private: "Private Hire",
};

/** Ordered options for the subtype editor's behaviour selector. */
export const BEHAVIOR_OPTIONS: { value: EventBehavior; label: string }[] =
  EVENT_BEHAVIORS.map((value) => ({ value, label: BEHAVIOR_LABELS[value] }));

/** Narrow an unknown value (e.g. a DB column or form field) to EventBehavior. */
export function isEventBehavior(value: unknown): value is EventBehavior {
  return (
    typeof value === "string" &&
    (EVENT_BEHAVIORS as readonly string[]).includes(value)
  );
}
