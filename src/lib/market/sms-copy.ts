import { alertsLeftTonight } from "./alert-quota";

/* One text per tick, kept inside a single 160-character GSM segment so every
   alert costs one message. The stop link always survives; after that the
   board link, then the drink lines from the end, are dropped until it fits. */
export const SMS_SEGMENT_LIMIT = 160;
export const SMS_MAX_PER_NIGHT = 4;

export function marketSmsBody(p: { lines: string[]; marketUrl: string; stopUrl: string; crash: boolean }): string {
  const heading = p.crash ? "Market crash - buy the dip" : null;
  const stop = `Stop texts: ${p.stopUrl}`;
  const compose = (lines: string[], board: boolean) => {
    const extra = p.lines.length - lines.length;
    return [heading, ...lines, extra > 0 && lines.length > 0 ? `+${extra} more` : null, board ? p.marketUrl : null, stop]
      .filter(Boolean)
      .join("\n");
  };
  for (const board of [true, false]) {
    const kept = [...p.lines];
    while (kept.length > 0) {
      const body = compose(kept, board);
      if (body.length <= SMS_SEGMENT_LIMIT) return body;
      kept.pop();
    }
  }
  return compose([], false);
}

export function textsLeftTonight(sentNight: string | null, sentCount: number, tonight: string): number {
  return alertsLeftTonight(sentNight, sentCount, tonight, SMS_MAX_PER_NIGHT);
}
