/* How many more alerts one subscriber may receive this trading night. The
   counter on the row belongs to sentNight; a new night starts from zero. */
export function alertsLeftTonight(
  sentNight: string | null,
  sentCount: number,
  tonight: string,
  maxPerNight: number
): number {
  const used = sentNight === tonight ? sentCount : 0;
  return Math.max(0, maxPerNight - used);
}
