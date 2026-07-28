import { describe, it, expect } from "vitest";
import { resolveEventImage } from "@/lib/event-image";

const EVENT = "https://cdn.test/event.png";
const ACT = "https://cdn.test/act.png";
const SUBTYPE = "https://cdn.test/subtype.png";

describe("resolveEventImage", () => {
  it("prefers the event's own image over everything else", () => {
    expect(
      resolveEventImage({
        eventImageUrl: EVENT,
        actCoverUrl: ACT,
        subtypeDefaultUrl: SUBTYPE,
      })
    ).toEqual({ url: EVENT, source: "event" });
  });

  it("falls back to the act cover when the event has none", () => {
    expect(
      resolveEventImage({
        eventImageUrl: null,
        actCoverUrl: ACT,
        subtypeDefaultUrl: SUBTYPE,
      })
    ).toEqual({ url: ACT, source: "act" });
  });

  it("falls back to the subtype default when event and act have none", () => {
    expect(
      resolveEventImage({
        eventImageUrl: null,
        actCoverUrl: null,
        subtypeDefaultUrl: SUBTYPE,
      })
    ).toEqual({ url: SUBTYPE, source: "subtype" });
  });

  it("reports none when nothing resolves", () => {
    expect(resolveEventImage({})).toEqual({ url: null, source: "none" });
  });

  it("treats an empty string as absent and keeps falling through", () => {
    expect(
      resolveEventImage({ eventImageUrl: "", subtypeDefaultUrl: SUBTYPE })
    ).toEqual({ url: SUBTYPE, source: "subtype" });
  });

  it("treats a whitespace-only string as absent", () => {
    expect(
      resolveEventImage({ eventImageUrl: "   ", actCoverUrl: ACT })
    ).toEqual({ url: ACT, source: "act" });
  });

  it("trims a surrounding-whitespace url rather than rejecting it", () => {
    expect(resolveEventImage({ eventImageUrl: `  ${EVENT}  ` })).toEqual({
      url: EVENT,
      source: "event",
    });
  });

  it("handles undefined the same as null", () => {
    expect(
      resolveEventImage({
        eventImageUrl: undefined,
        actCoverUrl: undefined,
        subtypeDefaultUrl: SUBTYPE,
      })
    ).toEqual({ url: SUBTYPE, source: "subtype" });
  });

  it("returns none when every tier is blank rather than absent", () => {
    expect(
      resolveEventImage({
        eventImageUrl: "",
        actCoverUrl: "  ",
        subtypeDefaultUrl: "",
      })
    ).toEqual({ url: null, source: "none" });
  });
});
