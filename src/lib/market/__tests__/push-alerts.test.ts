import { describe, expect, it } from "vitest";
import { relevantTo, type MarketPushEvent } from "../push-alerts";

const drop = (instrument_id: number): MarketPushEvent => ({ instrument_id, kind: "price_drop", payload: {} });
const crash: MarketPushEvent = { instrument_id: null, kind: "crash", payload: {} };

describe("relevantTo", () => {
  it("sends nothing to a subscriber who hasn't tapped any bells", () => {
    expect(relevantTo({ watched_instrument_ids: [] }, [drop(1), drop(2), crash])).toEqual([]);
    expect(relevantTo({ watched_instrument_ids: null }, [drop(1), crash])).toEqual([]);
  });

  it("sends only the watched drinks plus a crash", () => {
    expect(relevantTo({ watched_instrument_ids: [2] }, [drop(1), drop(2), crash])).toEqual([drop(2), crash]);
  });

  it("sends nothing when none of the watched drinks moved", () => {
    expect(relevantTo({ watched_instrument_ids: [9] }, [drop(1), drop(2)])).toEqual([]);
  });
});
