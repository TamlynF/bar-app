import { describe, expect, it } from "vitest";
import { buildPictureSheetHtml } from "../quiz/picture-sheet-html";

const cells = Array.from({ length: 9 }, (_, i) => ({
  no: i + 1,
  imageUrl: i === 8 ? null : `https://example.test/pic-${i + 1}.jpg`,
}));

describe("buildPictureSheetHtml", () => {
  it("lays out nine cells and nine answer lines", () => {
    const html = buildPictureSheetHtml({ title: "Picture - Picture sheet", question: "Name the band", cells });
    expect(html.match(/class="cell"/g)).toHaveLength(9);
    expect(html.match(/class="answer"/g)).toHaveLength(9);
    expect(html.match(/<img /g)).toHaveLength(8);
    expect(html).toContain("Q9</span>");
  });

  it("escapes the question and title", () => {
    const html = buildPictureSheetHtml({
      title: `Round <8> & "Pictures"`,
      question: `Who's <b>this</b>?`,
      cells: [],
    });
    expect(html).toContain("<title>Round &lt;8&gt; &amp; &quot;Pictures&quot;</title>");
    expect(html).toContain("Who's &lt;b&gt;this&lt;/b&gt;?");
    expect(html).not.toContain("<b>this</b>");
  });
});
