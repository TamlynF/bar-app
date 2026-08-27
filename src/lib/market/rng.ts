/* Deterministic randomness so a retried tick recomputes identical prices -
   the unique (instrument_id, tick_no) constraint then acts as a true
   idempotency backstop instead of masking divergent reruns. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function tickSeed(sessionId: number, tickNo: number): number {
  let h = 0x811c9dc5;
  h = Math.imul(h ^ sessionId, 0x01000193);
  h = Math.imul(h ^ tickNo, 0x01000193);
  h = Math.imul(h ^ 0x9e3779b9, 0x01000193);
  return h >>> 0;
}

export function tickRng(sessionId: number, tickNo: number): () => number {
  return mulberry32(tickSeed(sessionId, tickNo));
}
