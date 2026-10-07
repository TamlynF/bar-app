import { describe, expect, it } from "vitest";
import { alertsLeftTonight } from "../alert-quota";
import {
  marketEmailHtml,
  marketEmailSubject,
  marketEmailText,
  verificationEmailHtml,
  verificationEmailSubject,
} from "../email-copy";
import {
  generateVerificationCode,
  hashVerificationCode,
  normaliseEmail,
  verificationCodeMatches,
} from "../verification-code";

const urls = { marketUrl: "https://donfenticas.co.uk/market", unsubscribeUrl: "https://donfenticas.co.uk/market/unsubscribe?e=a%40b.co&t=tok" };

describe("market email copy", () => {
  it("names a single drink in the subject and counts several", () => {
    expect(marketEmailSubject(["Fireball down to £2.80 (-30.0%)"], false)).toBe("Market Night: Fireball down to £2.80 (-30.0%)");
    expect(marketEmailSubject(["a", "b", "c"], false)).toBe("Market Night: 3 drinks on the move");
    expect(marketEmailSubject(["a"], true)).toMatch(/crash/i);
  });

  it("escapes drink names and always links the board and unsubscribe", () => {
    const html = marketEmailHtml({ lines: ["Tom & Jerry <pint> down to £3"], crash: false, ...urls });
    expect(html).toContain("Tom &amp; Jerry &lt;pint&gt; down to £3");
    expect(html).toContain(urls.marketUrl);
    expect(html).toContain("a%40b.co&amp;t=tok");
    expect(html).toContain("Unsubscribe");
  });

  it("has a plain-text twin with every line", () => {
    const text = marketEmailText({ lines: ["one", "two"], crash: true, ...urls });
    expect(text).toContain("- one");
    expect(text).toContain("- two");
    expect(text).toContain(`Unsubscribe: ${urls.unsubscribeUrl}`);
  });

  it("puts the code in the verification subject and body", () => {
    expect(verificationEmailSubject("123456")).toBe("123456 is your Market Night code");
    expect(verificationEmailHtml("123456")).toContain("123456");
  });
});

describe("verification codes", () => {
  it("are six digits", () => {
    for (let i = 0; i < 20; i += 1) expect(generateVerificationCode()).toMatch(/^\d{6}$/);
  });

  it("match only the address and code they were hashed for", () => {
    const hash = hashVerificationCode("Guest@Example.com", "246810");
    expect(verificationCodeMatches("guest@example.com", "246810", hash)).toBe(true);
    expect(verificationCodeMatches("guest@example.com", "246811", hash)).toBe(false);
    expect(verificationCodeMatches("other@example.com", "246810", hash)).toBe(false);
    expect(verificationCodeMatches("guest@example.com", "246810", null)).toBe(false);
  });
});

describe("normaliseEmail", () => {
  it("lower-cases and trims a sensible address", () => {
    expect(normaliseEmail("  Guest@Example.COM ")).toBe("guest@example.com");
  });

  it("rejects junk", () => {
    expect(normaliseEmail("guest@example")).toBeNull();
    expect(normaliseEmail("guest example.com")).toBeNull();
    expect(normaliseEmail("")).toBeNull();
  });
});

describe("alertsLeftTonight", () => {
  it("honours the channel's own cap", () => {
    expect(alertsLeftTonight("2026-10-07", 2, "2026-10-07", 6)).toBe(4);
    expect(alertsLeftTonight("2026-10-06", 6, "2026-10-07", 6)).toBe(6);
    expect(alertsLeftTonight("2026-10-07", 9, "2026-10-07", 6)).toBe(0);
  });
});
