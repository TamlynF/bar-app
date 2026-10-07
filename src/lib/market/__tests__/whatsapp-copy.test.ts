import { describe, expect, it } from "vitest";
import { marketWhatsappBody, marketWhatsappTemplateVariables, WHATSAPP_MAX_LINES } from "../whatsapp-copy";

const urls = { marketUrl: "https://donfenticas.co.uk/market", stopUrl: "https://donfenticas.co.uk/market/stop?t=0a1b2c3d4e5f&c=w" };

describe("marketWhatsappBody", () => {
  it("lists every drink as a bullet with the board and stop links", () => {
    const body = marketWhatsappBody({ lines: ["Fireball down to £2.80 (-30.0%)", "Hooch running low"], crash: false, ...urls });
    expect(body).toBe(
      [
        "*Market Night - prices just moved*",
        "",
        "• Fireball down to £2.80 (-30.0%)",
        "• Hooch running low",
        "",
        `Live board: ${urls.marketUrl}`,
        `Stop these: ${urls.stopUrl}`,
      ].join("\n")
    );
  });

  it("caps very long lists and says how many more are on the board", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Drink ${i + 1} down`);
    const body = marketWhatsappBody({ lines, crash: false, ...urls });
    expect(body.split("\n").filter((l) => l.startsWith("• ")).length).toBe(WHATSAPP_MAX_LINES);
    expect(body).toContain("+5 more on the board");
  });

  it("leads with the crash", () => {
    expect(marketWhatsappBody({ lines: ["x"], crash: true, ...urls })).toMatch(/^\*Market crash/);
  });
});

describe("marketWhatsappTemplateVariables", () => {
  it("joins the lines into one variable and keeps the links separate", () => {
    const vars = marketWhatsappTemplateVariables({ lines: ["a", "b"], crash: false, ...urls });
    expect(vars).toEqual({
      "1": "Market Night - prices just moved",
      "2": "a · b",
      "3": urls.marketUrl,
      "4": urls.stopUrl,
    });
    expect(Object.values(vars).some((v) => v.includes("\n"))).toBe(false);
  });
});
