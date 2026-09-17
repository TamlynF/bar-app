import { describe, expect, it } from "vitest";
import { publicTillPrice } from "../square-confirmation";
import { retryAfterMs } from "../square-price-sync";

describe("publicTillPrice", () => {
  const instrument = { square_synced_price: "6.45", square_confirmed_price: "6.20" };

  it("uses the synced price until a session has ever been confirmed", () => {
    expect(publicTillPrice({ square_last_write_at: "2026-09-19T20:05:00Z", square_catalog_confirmed_at: null }, instrument)).toBe(6.45);
  });

  it("uses the confirmed price once the webhook has spoken", () => {
    expect(
      publicTillPrice(
        { square_last_write_at: "2026-09-19T20:05:00Z", square_catalog_confirmed_at: "2026-09-19T20:04:30Z" },
        instrument
      )
    ).toBe(6.2);
  });

  it("falls back to the synced price if confirmations have gone quiet", () => {
    expect(
      publicTillPrice(
        { square_last_write_at: "2026-09-19T20:10:00Z", square_catalog_confirmed_at: "2026-09-19T20:04:30Z" },
        instrument
      )
    ).toBe(6.45);
  });

  it("is null for a linked drink nothing has been written for yet", () => {
    expect(publicTillPrice({}, { square_synced_price: null, square_confirmed_price: null })).toBeNull();
  });
});

describe("retryAfterMs", () => {
  it("reads Retry-After in seconds from either header shape and caps it", () => {
    expect(retryAfterMs({ rawResponse: { headers: { "retry-after": "1" } } })).toBe(1000);
    expect(retryAfterMs({ headers: { "retry-after": "60" } })).toBe(5000);
    expect(retryAfterMs({})).toBe(2000);
  });
});
