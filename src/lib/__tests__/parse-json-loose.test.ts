import { describe, expect, it } from "vitest";
import { parseJsonLoose } from "@/lib/gemini";

describe("parseJsonLoose", () => {
  it("returns the object, not its inner array, for an object wrapping an array", () => {
    const text = `{
  "categories": [
    { "name": "WHITE WINES", "items": [ { "name": "Pinot Grigio", "price_text": "£5.50", "serves": [ { "serve": "glass", "amount": 5.5 } ] } ] }
  ]
}`;
    const parsed = parseJsonLoose<{ categories?: unknown[] }>(text);
    expect(Array.isArray(parsed)).toBe(false);
    expect(parsed?.categories).toHaveLength(1);
  });

  it("returns a top-level array of objects as an array", () => {
    const parsed = parseJsonLoose<unknown[]>(`[{"title": "a"}, {"title": "b"}]`);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it("prefers a fenced block and tolerates prose around it", () => {
    const parsed = parseJsonLoose<{ ok: boolean }>("Here you go:\n```json\n{\"ok\": true}\n```\nAnything else?");
    expect(parsed).toEqual({ ok: true });
  });

  it("falls back to the other bracket when the first slice is not valid JSON", () => {
    const parsed = parseJsonLoose<{ items: number[] }>(`note [draft] {"items": [1, 2]}`);
    expect(parsed).toEqual({ items: [1, 2] });
  });

  it("returns null when nothing parses", () => {
    expect(parseJsonLoose("no json here")).toBeNull();
  });
});
