import { describe, it, expect } from "vitest";
import { escapeHtml, escapeAttr, safeUrl } from "@/lib/email/escape";

describe("escapeHtml", () => {
  it("neutralises the characters that can break out of a text node", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapes the apostrophe a group name is most likely to contain", () => {
    expect(escapeHtml("O'Malley's Crew")).toBe("O&#39;Malley&#39;s Crew");
  });

  it("escapes ampersands once, not twice", () => {
    expect(escapeHtml("Smith & Sons")).toBe("Smith &amp; Sons");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("The Quizzards")).toBe("The Quizzards");
  });
});

describe("escapeAttr", () => {
  it("escapes the quotes that would close an attribute", () => {
    expect(escapeAttr(`" onload="steal()`)).toBe("&quot; onload=&quot;steal()");
  });
});

describe("safeUrl", () => {
  it("passes an https link through", () => {
    expect(safeUrl("https://example.test/manage-booking/42")).toBe(
      "https://example.test/manage-booking/42",
    );
  });

  it("allows mailto, which the contact links use", () => {
    expect(safeUrl("mailto:admin@example.test")).toBe("mailto:admin@example.test");
  });

  it("allows a site-relative path", () => {
    expect(safeUrl("/book/quiz")).toBe("/book/quiz");
  });

  it("refuses a javascript: href", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
  });

  it("refuses a data: href", () => {
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe("#");
  });

  it("refuses anything it cannot parse", () => {
    expect(safeUrl("not a url")).toBe("#");
    expect(safeUrl("")).toBe("#");
  });

  it("escapes quotes in an otherwise valid url", () => {
    expect(safeUrl('https://example.test/a"onmouseover="x')).toContain("&quot;");
  });
});
