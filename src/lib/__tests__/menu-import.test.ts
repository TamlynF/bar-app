import { describe, it, expect } from "vitest";
import {
  cleanParsedMenu,
  diffMenu,
  normaliseName,
  summarise,
  defaultSelection,
  type CurrentCategory,
} from "../menu-import";

function category(
  id: number,
  name: string,
  items: { id: number; name: string; price: string; serves: { serve: string; amount: number }[]; is_active?: boolean }[],
): CurrentCategory {
  return {
    id,
    name,
    note: null,
    is_active: true,
    menu_items: items.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      is_active: i.is_active ?? true,
      menu_item_prices: i.serves,
    })),
  };
}

const DRAUGHT = category(1, "Draught", [
  {
    id: 10,
    name: "Guinness",
    price: "£4.95 pint / £2.95 half pint",
    serves: [
      { serve: "pint", amount: 4.95 },
      { serve: "half pint", amount: 2.95 },
    ],
  },
]);

describe("normaliseName", () => {
  it("treats punctuation and spacing differences as the same name", () => {
    expect(normaliseName("Pipers  Sweet-Chilli")).toBe(normaliseName("pipers sweet chilli"));
  });

  it("spells out an ampersand so both writings match", () => {
    expect(normaliseName("Cheddar & Onion")).toBe(normaliseName("Cheddar and Onion"));
  });
});

describe("cleanParsedMenu", () => {
  it("drops items with no usable serve", () => {
    const cleaned = cleanParsedMenu({
      categories: [
        { name: "Draught", items: [{ name: "Mystery", price_text: "ask", serves: [] }] },
      ],
    });
    expect(cleaned.categories[0].items).toEqual([]);
  });

  it("resolves serve aliases and drops non-positive amounts", () => {
    const cleaned = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [
            {
              name: "Guinness",
              price_text: "",
              serves: [
                { serve: "Half", amount: 2.95 },
                { serve: "pint", amount: 4.95 },
                { serve: "bottle", amount: 0 },
              ],
            },
          ],
        },
      ],
    });
    expect(cleaned.categories[0].items[0].serves).toEqual([
      { serve: "half pint", amount: 2.95 },
      { serve: "pint", amount: 4.95 },
    ]);
  });

  it("fills missing display text from the serves", () => {
    const cleaned = cleanParsedMenu({
      categories: [
        {
          name: "Crisps",
          items: [{ name: "Pipers", price_text: "", serves: [{ serve: "each", amount: 1.45 }] }],
        },
      ],
    });
    expect(cleaned.categories[0].items[0].price_text).toContain("1.45");
  });

  it("folds a heading that appears twice into one category", () => {
    const cleaned = cleanParsedMenu({
      categories: [
        { name: "Draught", items: [{ name: "A", price_text: "", serves: [{ serve: "pint", amount: 4 }] }] },
        { name: "DRAUGHT", items: [{ name: "B", price_text: "", serves: [{ serve: "pint", amount: 5 }] }] },
      ],
    });
    expect(cleaned.categories).toHaveLength(1);
    expect(cleaned.categories[0].items.map((i) => i.name)).toEqual(["A", "B"]);
  });

  it("survives junk without throwing", () => {
    expect(cleanParsedMenu(null).categories).toEqual([]);
    expect(cleanParsedMenu({ categories: "nope" }).categories).toEqual([]);
  });
});

describe("diffMenu", () => {
  it("reports an identical menu as unchanged", () => {
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [
            {
              name: "Guinness",
              price_text: "£4.95 pint / £2.95 half pint",
              serves: [
                { serve: "pint", amount: 4.95 },
                { serve: "half pint", amount: 2.95 },
              ],
            },
          ],
        },
      ],
    });
    const changes = diffMenu([DRAUGHT], parsed);
    expect(summarise(changes)).toMatchObject({ unchanged: 1, "price-change": 0, absent: 0 });
  });

  it("flags a changed amount as a price change carrying both sides", () => {
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [
            {
              name: "Guinness",
              price_text: "£5.25 pint / £2.95 half pint",
              serves: [
                { serve: "pint", amount: 5.25 },
                { serve: "half pint", amount: 2.95 },
              ],
            },
          ],
        },
      ],
    });
    const change = diffMenu([DRAUGHT], parsed).find((c) => c.kind === "price-change");
    expect(change?.itemId).toBe(10);
    expect(change?.before).toContain("4.95");
    expect(change?.after).toContain("5.25");
  });

  it("matches an existing item through a differently written name", () => {
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "DRAUGHT",
          items: [
            {
              name: "guinness",
              price_text: "£4.95 pint / £2.95 half pint",
              serves: [
                { serve: "pint", amount: 4.95 },
                { serve: "half pint", amount: 2.95 },
              ],
            },
          ],
        },
      ],
    });
    const changes = diffMenu([DRAUGHT], parsed);
    expect(changes.filter((c) => c.kind === "new-item")).toHaveLength(0);
    expect(changes.filter((c) => c.kind === "new-category")).toHaveLength(0);
  });

  it("proposes a new category and its items", () => {
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "Nuts",
          items: [{ name: "Nobby's", price_text: "", serves: [{ serve: "each", amount: 1.45 }] }],
        },
      ],
    });
    const changes = diffMenu([DRAUGHT], parsed);
    expect(summarise(changes)).toMatchObject({ "new-category": 1, "new-item": 1 });
    expect(changes.find((c) => c.kind === "new-item")?.categoryId).toBeNull();
  });

  it("marks an item missing from a covered category as absent, never deleted", () => {
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [{ name: "Something Else", price_text: "", serves: [{ serve: "pint", amount: 4 }] }],
        },
      ],
    });
    const changes = diffMenu([DRAUGHT], parsed);
    const absent = changes.find((c) => c.kind === "absent");
    expect(absent?.itemId).toBe(10);
    expect(changes.some((c) => c.kind.includes("delete"))).toBe(false);
  });

  it("leaves categories the upload never mentioned alone", () => {
    const crisps = category(2, "Crisps", [
      { id: 20, name: "Pipers", price: "£1.45", serves: [{ serve: "each", amount: 1.45 }] },
    ]);
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [
            {
              name: "Guinness",
              price_text: "£4.95 pint / £2.95 half pint",
              serves: [
                { serve: "pint", amount: 4.95 },
                { serve: "half pint", amount: 2.95 },
              ],
            },
          ],
        },
      ],
    });
    const changes = diffMenu([DRAUGHT, crisps], parsed);
    expect(changes.some((c) => c.itemId === 20)).toBe(false);
  });

  it("does not report an already inactive item as absent", () => {
    const withInactive = category(1, "Draught", [
      { id: 10, name: "Guinness", price: "£4.95", serves: [{ serve: "pint", amount: 4.95 }], is_active: false },
    ]);
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [{ name: "Other", price_text: "", serves: [{ serve: "pint", amount: 4 }] }],
        },
      ],
    });
    expect(diffMenu([withInactive], parsed).some((c) => c.kind === "absent")).toBe(false);
  });

  it("produces stable keys across repeated diffs of the same parse", () => {
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [
            {
              name: "Guinness",
              price_text: "£5.25 pint",
              serves: [{ serve: "pint", amount: 5.25 }],
            },
          ],
        },
      ],
    });
    const first = diffMenu([DRAUGHT], parsed).map((c) => c.key);
    const second = diffMenu([DRAUGHT], parsed).map((c) => c.key);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });
});

describe("defaultSelection", () => {
  it("pre-ticks additions and price changes but never a deactivation", () => {
    const parsed = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [{ name: "New Lager", price_text: "", serves: [{ serve: "pint", amount: 5 }] }],
        },
      ],
    });
    const changes = diffMenu([DRAUGHT], parsed);
    const picked = defaultSelection(changes);
    const absentKey = changes.find((c) => c.kind === "absent")?.key;

    expect(absentKey).toBeDefined();
    expect(picked).not.toContain(absentKey);
    expect(picked.some((k) => k.startsWith("new-item:"))).toBe(true);
  });
});
