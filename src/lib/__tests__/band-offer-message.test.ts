import { describe, expect, it } from "vitest";
import {
  BAND_OFFER_REPLIES,
  bandOfferAckText,
  bandOfferCard,
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

  it("greets by first name and lays the slot and fee out under capital labels between dotted rules", () => {
    const text = bandOfferMessageText(base);
    expect(text).toContain("Hi Ginger!");
    expect(text).toContain("have Dandy play at Don Fenticas");
    expect(text).toContain(
      "- - - - - - - - - - - - - - -\nWHEN\nSaturday, 31 October 2026\n10:00 PM – 11:30 PM\n\nFEE\n£120.00\n- - - - - - - - - - - - - - -\n\nClick on the link below"
    );
    expect(text).not.toContain("updated from");
    expect(text).not.toContain("http");
    expect(text).not.toContain("Once you confirm");
    const card = bandOfferCard(base);
    expect(card).toEqual({
      title: "Your offer from Don Fenticas",
      subtitle: "Saturday, 31 October 2026, 10:00 PM – 11:30 PM · Fee: £120.00",
      buttonTitle: "View band offer",
      url: base.offerUrl,
    });
  });

  it("keeps the card's lines inside Meta's 80 characters", () => {
    const card = bandOfferCard({ ...base, venueName: "A".repeat(90), previousPaymentAmount: 90 });
    expect(card.title.length).toBeLessThanOrEqual(80);
    expect(card.subtitle.length).toBeLessThanOrEqual(80);
    expect(card.subtitle.endsWith("…")).toBe(true);
  });

  it("says when the fee changed and copes with no fee or no slot", () => {
    expect(bandOfferMessageText({ ...base, previousPaymentAmount: 100 })).toContain("FEE\n£120.00 (updated from £100.00)");
    expect(bandOfferMessageText({ ...base, previousPaymentAmount: 120 })).toContain("FEE\n£120.00\n");
    const bare = bandOfferMessageText({ ...base, paymentAmount: null, date: null, startTime: null, endTime: null, groupName: null });
    expect(bare).not.toContain("FEE");
    expect(bare).toContain("WHEN\nDate and time to be arranged\n- - -");
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
