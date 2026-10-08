import { describe, expect, it } from "vitest";
import {
  BAND_OFFER_REPLIES,
  bandOfferAckText,
  bandOfferMessageText,
  bandOfferPayload,
  bandOfferQuickReplies,
  parseBandOfferPayload,
} from "@/lib/band-offer-message";

const ID = "47942ad5-9e17-4e94-867e-951e4d329c30";

describe("quick reply payloads", () => {
  it("round-trip the request id and the answer", () => {
    for (const r of ["accept", "discuss", "withdraw"] as const) {
      expect(parseBandOfferPayload(bandOfferPayload(ID, r))).toEqual({ requestId: ID, response: r });
    }
  });

  it("ignore anything that is not an offer answer", () => {
    expect(parseBandOfferPayload(null)).toBeNull();
    expect(parseBandOfferPayload("hello")).toBeNull();
    expect(parseBandOfferPayload(`band_offer:${ID}:maybe`)).toBeNull();
    expect(parseBandOfferPayload("band_offer:not-a-uuid:accept")).toBeNull();
  });

  it("keep titles inside Instagram's 20-character limit", () => {
    for (const r of BAND_OFFER_REPLIES) expect(r.title.length).toBeLessThanOrEqual(20);
    expect(bandOfferQuickReplies(ID).map((q) => q.payload)).toEqual([
      `band_offer:${ID}:accept`,
      `band_offer:${ID}:discuss`,
      `band_offer:${ID}:withdraw`,
    ]);
  });
});

describe("bandOfferMessageText", () => {
  const base = {
    name: "Ginger Fourie",
    groupName: "Dandy",
    venueName: "Don Fenticas",
    date: "2026-10-31",
    startTime: "22:00",
    endTime: "23:30",
    paymentAmount: 120,
    offerUrl: `https://example.test/band-offer/${ID}`,
  };

  it("greets by first name and states the slot, the fee and the offer link", () => {
    const text = bandOfferMessageText(base);
    expect(text).toContain("Hi Ginger!");
    expect(text).toContain("have Dandy play at Don Fenticas");
    expect(text).toContain("When: Saturday, 31 October 2026, 10:00 PM – 11:30 PM");
    expect(text).toContain("Fee: £120");
    expect(text).not.toContain("updated from");
    expect(text).toContain(base.offerUrl);
  });

  it("says when the fee changed and copes with no fee or no slot", () => {
    expect(bandOfferMessageText({ ...base, previousPaymentAmount: 100 })).toContain("Fee: £120 (updated from £100)");
    expect(bandOfferMessageText({ ...base, previousPaymentAmount: 120 })).toContain("Fee: £120\n");
    const bare = bandOfferMessageText({ ...base, paymentAmount: null, date: null, startTime: null, endTime: null, groupName: null });
    expect(bare).not.toContain("Fee:");
    expect(bare).toContain("When: date and time to be arranged");
    expect(bare).toContain("have you play");
  });
});

describe("bandOfferAckText", () => {
  it("tells them whether the yes booked them straight away", () => {
    expect(bandOfferAckText("accept", "booked", "Don Fenticas")).toContain("you're booked at Don Fenticas");
    expect(bandOfferAckText("accept", "offered", "Don Fenticas")).toContain("confirm by email shortly");
    expect(bandOfferAckText("withdraw", "declined", "Don Fenticas")).toContain("withdrawn your application");
  });
});
