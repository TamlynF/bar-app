/* One clock for every surface that shows the market's "next update": the
   phone feed, the TV board and the admin trade floor all format the same
   whole-second figure the same way, so they never disagree by a second. */
export function secondsLeft(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

export function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
