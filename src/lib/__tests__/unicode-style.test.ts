import { describe, expect, it } from "vitest";
import { plainText, styleText } from "@/lib/unicode-style";

describe("styleText", () => {
  it("swaps letters and digits for the bold lookalikes and leaves punctuation alone", () => {
    expect(styleText("Fee: £120", "bold")).toBe("\u{1D5D9}\u{1D5F2}\u{1D5F2}: £\u{1D7ED}\u{1D7EE}\u{1D7EC}");
    expect(styleText("ok", "italic")).toBe("\u{1D630}\u{1D62C}");
  });

  it("underlines every character except whitespace", () => {
    expect(styleText("a b", "underline")).toBe("a\u0332 b\u0332");
  });

  it("restyles rather than stacking, and plainText undoes everything", () => {
    const bold = styleText("Dandy", "bold");
    expect(styleText(bold, "italic")).toBe(styleText("Dandy", "italic"));
    expect(plainText(styleText(bold, "underline"))).toBe("Dandy");
  });
});
