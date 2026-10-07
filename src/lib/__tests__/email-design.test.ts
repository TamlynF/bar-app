import { describe, expect, it } from "vitest";
import {
  EMPTY_BRAND,
  brandFromRow,
  cleanBlockHtml,
  defaultBlocks,
  fillBlocks,
  renderBlocks,
  sanitizeAttachments,
  sanitizeBlocks,
  textOn,
  type EmailBlock,
} from "@/lib/email/design";
import { bandCard, bandLayout, bandNote, brandLayout, plainLayout } from "@/lib/email/layout";
import { bandEmailHtml } from "@/lib/band-email-html";
import { buildBandEmail } from "@/lib/band-emails";
import { findScenario } from "@/lib/email/scenarios";

const BOOKING = findScenario("booking.event.confirmed")!;

describe("brand settings", () => {
  it("leaves each design on its own colours when nothing is set", () => {
    const html = bandLayout({ slots: { ...BOOKING.defaults, design: { brand: EMPTY_BRAND, blocks: null } } });
    expect(html).toContain("background:#34451F");
    expect(html).toContain("color:#FDCC4B");
    expect(html).toContain("Unit 1, Regent St");
  });

  it("applies the header colour, logo, font and footer", () => {
    const brand = brandFromRow({
      logo_url: "https://cdn.example.test/logo.png",
      logo_width: 140,
      font: "georgia",
      header_bg: "#112233",
      header_text: "#ffeedd",
      accent: "#aa0000",
      footer_text: "Don Fenticas & Co",
    });
    const html = brandLayout({ slots: { ...BOOKING.defaults, design: { brand, blocks: null } }, bodyHtml: "" });
    expect(html).toContain("background-color: #112233");
    expect(html).toContain('src="https://cdn.example.test/logo.png"');
    expect(html).toContain("Georgia");
    expect(html).toContain("Don Fenticas &amp; Co");
  });

  it("rejects bad colours, fonts and logo urls", () => {
    const brand = brandFromRow({
      logo_url: "javascript:alert(1)",
      logo_width: 9999,
      font: "comic",
      header_bg: "red",
      header_text: null,
      accent: "#12",
      footer_text: "  ",
    });
    expect(brand).toEqual(EMPTY_BRAND);
  });

  it("picks readable button text", () => {
    expect(textOn("#FDCC4B")).toBe("#26300D");
    expect(textOn("#26300D")).toBe("#FFFFFF");
  });
});

describe("blocks", () => {
  it("keeps only the editor's tags and safe links", () => {
    expect(cleanBlockHtml('<p onclick="x">Hi <script>bad</script><a href="javascript:x">l</a></p>')).toBe(
      "<p>Hi bad<a>l</a></p>"
    );
    expect(cleanBlockHtml('<a href="https://ok.test" class="x">ok</a>')).toBe('<a href="https://ok.test">ok</a>');
  });

  it("always keeps the design's booking blocks, once each", () => {
    const blocks = sanitizeBlocks(
      [
        { id: "a", type: "system", key: "slotCard" },
        { id: "b", type: "system", key: "slotCard" },
        { id: "c", type: "system", key: "details" },
        { id: "d", type: "nonsense" },
      ],
      "band"
    )!;
    const keys = blocks.filter((b) => b.type === "system").map((b) => (b as { key: string }).key);
    expect(keys).toEqual(["slotCard", "teamNote"]);
  });

  it("starts from the same copy the standard layout draws", () => {
    const scenario = findScenario("band.offered")!;
    const blocks = defaultBlocks(scenario.key, "band", scenario.defaults);
    const html = bandLayout({
      slots: { ...scenario.defaults, design: { brand: EMPTY_BRAND, blocks } },
      cardHtml: "<div>CARD</div>",
      noteHtml: "<div>NOTE</div>",
    });
    expect(html).toContain("CARD");
    expect(html.indexOf("CARD")).toBeLessThan(html.indexOf("NOTE"));
    expect(html).toContain(scenario.defaults.heading);
  });

  it("fills merge fields escaped and drops unsafe links", () => {
    const blocks: EmailBlock[] = [
      { id: "1", type: "text", html: "<p>Hi {{customerName}}</p>" },
      { id: "2", type: "button", label: "Go", url: "javascript:alert(1)" },
      { id: "3", type: "image", url: "https://img.test/a.png", alt: "Logo", width: 50, align: "center", href: "" },
    ];
    const filled = fillBlocks(blocks, { customerName: "<b>Jo</b>" }, new Set());
    const html = renderBlocks(filled, "plain", "#FDCC4B", {});
    expect(html).toContain("Hi &lt;b&gt;Jo&lt;/b&gt;");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('src="https://img.test/a.png"');
  });

  it("puts the plain design's panel and button where the blocks say", () => {
    const html = plainLayout({
      slots: {
        ...BOOKING.defaults,
        design: {
          brand: EMPTY_BRAND,
          blocks: [
            { id: "1", type: "system", key: "button" },
            { id: "2", type: "text", html: "<p>After</p>" },
          ],
        },
      },
      ctaUrl: "https://example.test/x",
    });
    expect(html.indexOf("example.test/x")).toBeLessThan(html.indexOf("After"));
  });
});

describe("booking block styles and labels", () => {
  it("keeps the original card and note look by default", () => {
    expect(bandCard("Proposed Slot", "Sat", "Fee: £1")).toContain("border:2px solid #D8D5C8");
    expect(bandNote("Hi")).toContain("border-left:4px solid #34451F");
    expect(bandNote("Hi")).toContain("Note from our team");
  });

  it("applies the brand's card styles", () => {
    const brand = brandFromRow({
      logo_url: null,
      logo_width: null,
      font: null,
      header_bg: null,
      header_text: null,
      accent: null,
      footer_text: null,
      card_label_color: "#aa0000",
      card_label_case: "plain",
      card_value_size: "large",
      card_bg: "#fffaf0",
      card_border: "#123456",
      note_bar: "#654321",
    });
    const card = bandCard("Proposed Slot", "Sat", undefined, brand);
    expect(card).toContain("color:#AA0000");
    expect(card).not.toContain("text-transform:uppercase");
    expect(card).toContain("font-size:24px");
    expect(card).toContain("border:2px solid #123456");
    expect(bandNote("Hi", brand)).toContain("border-left:4px solid #654321");
  });

  it("uses the template's card and note labels", () => {
    const scenario = findScenario("band.offered")!;
    const slots = { ...scenario.defaults, cardTitle: "Your gig", noteTitle: "From Tam" };
    const email = buildBandEmail({ slots, kind: "offered", date: null, startTime: null, endTime: null, notes: "x" });
    const html = bandEmailHtml({ kind: "offered", slots, email, groupName: "Hens", noteHtml: "x" });
    expect(html).toContain("Your gig");
    expect(html).toContain("From Tam");
    expect(html).not.toContain("Proposed Slot");
  });
});

describe("template attachments", () => {
  it("keeps only files in the template's own folder, up to five", () => {
    const files = sanitizeAttachments(
      [
        { name: "Stage plot.pdf", path: "templates/band.booked/a1-stage.pdf", size: 1000, contentType: "application/pdf" },
        { name: "Other", path: "band-123/email/secret.pdf", size: 10, contentType: "application/pdf" },
        { name: "Sneaky", path: "templates/band.booked/../x.pdf", size: 10, contentType: "application/pdf" },
        ...Array.from({ length: 6 }, (_, i) => ({ name: `f${i}`, path: `templates/band.booked/${i}.pdf`, size: 1 })),
      ],
      "band.booked"
    );
    expect(files[0]).toEqual({
      name: "Stage plot.pdf",
      path: "templates/band.booked/a1-stage.pdf",
      size: 1000,
      contentType: "application/pdf",
    });
    expect(files.some((f) => f.path.startsWith("band-123"))).toBe(false);
    expect(files.some((f) => f.path.includes(".."))).toBe(false);
    expect(files).toHaveLength(5);
  });

  it("treats anything that is not a list as no attachments", () => {
    expect(sanitizeAttachments(null, "band.booked")).toEqual([]);
    expect(sanitizeAttachments("x", "band.booked")).toEqual([]);
  });
});
