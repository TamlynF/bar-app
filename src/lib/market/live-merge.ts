import type { StockState } from "./types";
import type { MarketStatePayload } from "./tick";
import { withMixer, withMixerOrNull } from "./mixer";

/* The fields the engine rewrites every tick. Everything else on an
   instrument row only changes through a staff action, and those actions
   refresh the page themselves. */
export type LiveInstrumentFields = {
  id: number;
  currentPrice: number;
  stockState: StockState;
  demandUnits: number;
  pace: number | null;
  rankPos: number | null;
  tierPct: number | null;
  targetPrice: number | null;
  normalUnitsPerNight: number | null;
  stockQty?: number | null;
  simPending?: number;
  mixerPrice?: number | null;
};

/* Lays the polled market state over the instruments the page rendered with,
   so a tick moves the table without a server round trip. Rows the payload
   does not know stay as they were. Queued simulated sales are consumed by
   the tick that overtakes the page's session, so they clear once the polled
   tick number is ahead. The payload quotes spirit + mixer for the public;
   staff rows carry the spirit price the engine and the till variation use,
   so the mixer comes back off. */
export function mergeLiveInstruments<T extends LiveInstrumentFields>(
  rows: T[],
  payload: MarketStatePayload | null,
  sessionId: number,
  sessionTickNo: number
): T[] {
  if (!payload || payload.status !== "live" || payload.sessionId !== sessionId || !payload.instruments) {
    return rows;
  }
  const byId = new Map(payload.instruments.map((instrument) => [instrument.id, instrument]));
  const tickAdvanced = (payload.tickNo ?? sessionTickNo) > sessionTickNo;
  return rows.map((row) => {
    const live = byId.get(row.id);
    if (!live) return row;
    const spiritOnly = -(live.mixerPrice ?? 0);
    return {
      ...row,
      currentPrice: withMixer(live.price, spiritOnly),
      stockState: live.stock,
      demandUnits: live.demandUnits,
      pace: live.pace,
      rankPos: live.rankPos,
      tierPct: live.tierPct,
      targetPrice: withMixerOrNull(live.targetPrice, spiritOnly),
      normalUnitsPerNight: live.normalUnitsPerNight,
      ...("stockQty" in row && live.stockQty !== undefined ? { stockQty: live.stockQty } : {}),
      ...("simPending" in row && tickAdvanced ? { simPending: 0 } : {}),
      ...("mixerPrice" in row ? { mixerPrice: live.mixerPrice } : {}),
    };
  });
}
