import { describe, expect, it } from "vitest";
import { hostOf, normaliseBaseUrl, normaliseOptionalBaseUrl, resolveBaseUrl } from "@/lib/ai/endpoints";

describe("normaliseBaseUrl", () => {
  it("trims and strips trailing slashes", () => {
    expect(normaliseBaseUrl("  https://generativelanguage.googleapis.com/v1beta/  ")).toEqual({
      url: "https://generativelanguage.googleapis.com/v1beta",
    });
  });

  it("rejects blanks, http and junk", () => {
    expect(normaliseBaseUrl("")).toHaveProperty("error");
    expect(normaliseBaseUrl("http://example.com")).toHaveProperty("error");
    expect(normaliseBaseUrl("not a url")).toHaveProperty("error");
    expect(normaliseBaseUrl("https://example.com/v1?key=x")).toHaveProperty("error");
  });

  it("treats a blank optional URL as no override", () => {
    expect(normaliseOptionalBaseUrl("")).toEqual({ url: null });
    expect(normaliseOptionalBaseUrl(undefined)).toEqual({ url: null });
    expect(normaliseOptionalBaseUrl("https://example.com/v2/")).toEqual({ url: "https://example.com/v2" });
  });
});

describe("resolveBaseUrl", () => {
  it("prefers the area, then the provider, then the default", () => {
    expect(resolveBaseUrl("https://a", "https://p", "https://d")).toBe("https://a");
    expect(resolveBaseUrl(null, "https://p", "https://d")).toBe("https://p");
    expect(resolveBaseUrl("  ", "", "https://d")).toBe("https://d");
  });
});

describe("hostOf", () => {
  it("reads the host and falls back to the input", () => {
    expect(hostOf("https://generativelanguage.googleapis.com/v1beta")).toBe("generativelanguage.googleapis.com");
    expect(hostOf("nope")).toBe("nope");
  });
});
