import { describe, it, expect } from "vitest";
import { buildPricesPrompt, describeMenu } from "../prompts";
import type { MenuItemLite } from "../types";

const item = (id: number, name: string, category: string): MenuItemLite => ({
  id,
  name,
  price: "£4.00",
  category,
});

describe("describeMenu", () => {
  it("groups the items under the section they sit on", () => {
    expect(
      describeMenu([
        item(1, "DF Session Lager", "Draught"),
        item(2, "Guinness", "Draught"),
        item(3, "Pinot Grigio", "White Wine"),
      ]),
    ).toBe("- Draught: DF Session Lager, Guinness\n- White Wine: Pinot Grigio");
  });

  it("keeps every item, however long the menu runs", () => {
    const menu = Array.from({ length: 94 }, (_, i) => item(i, `Item ${i}`, `Cat ${i % 21}`));
    const described = describeMenu(menu);
    menu.forEach((m) => expect(described).toContain(m.name));
  });

  it("names a section for items filed under nothing", () => {
    expect(describeMenu([{ id: 1, name: "Mystery", price: "£1", category: null }])).toBe(
      "- Other: Mystery",
    );
  });

  it("is empty for an empty menu", () => {
    expect(describeMenu([])).toBe("");
  });
});

describe("buildPricesPrompt", () => {
  it("carries the whole menu, including the sections that used to fall past the cut-off", () => {
    const menu = [
      ...Array.from({ length: 40 }, (_, i) => item(i, `Filler ${i}`, "Cocktails")),
      item(90, "Sauvignon Blanc", "White Wine"),
      item(91, "Diet Coke", "Soft Drinks"),
      item(92, "Nobby's Nuts Salted", "Nuts"),
    ];
    const prompt = buildPricesPrompt("Hinckley", "5 miles", menu);

    expect(prompt).toContain("Sauvignon Blanc");
    expect(prompt).toContain("Diet Coke");
    expect(prompt).toContain("Nobby's Nuts Salted");
    expect(prompt).toContain("White Wine");
  });

  it("mentions the area and the radius", () => {
    const prompt = buildPricesPrompt("Hinckley LE10", "5 miles", []);
    expect(prompt).toContain("Hinckley LE10");
    expect(prompt).toContain("within roughly 5 miles");
  });

  it("falls back to generic targets when there is no menu", () => {
    const prompt = buildPricesPrompt("Hinckley", null, []);
    expect(prompt).toContain("Target common bar drinks, snacks and food.");
    expect(prompt).not.toContain("within roughly");
  });
});
