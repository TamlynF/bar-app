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

export const BEHAVIOR_OPTIONS: { value: EventBehavior; label: string }[] =
  EVENT_BEHAVIORS.map((value) => ({ value, label: BEHAVIOR_LABELS[value] }));

export function isEventBehavior(value: unknown): value is EventBehavior {
  return (
    typeof value === "string" &&
    (EVENT_BEHAVIORS as readonly string[]).includes(value)
  );
}
