import { SERVES } from "@/lib/menu-price";

export const MENU_EXTRACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    categories: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          note: { type: "STRING" },
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                price_text: { type: "STRING" },
                serves: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      serve: { type: "STRING", enum: [...SERVES] },
                      amount: { type: "NUMBER" },
                    },
                    required: ["serve", "amount"],
                  },
                },
              },
              required: ["name", "price_text", "serves"],
            },
          },
        },
        required: ["name", "items"],
      },
    },
  },
  required: ["categories"],
};

export const DRINKS_EXTRACT_PROMPT = `You are reading a pub DRINKS menu.

Transcribe only drinks: draught and bottled beer, cider, wine, spirits, cocktails, soft drinks, tea and coffee.
Do not include food, mains, starters, sides, desserts, kids meals, breakfast, Sunday roasts or allergen food lists.
Rules:
- Copy names and prices exactly as printed. Never invent an item or a price.
- If a price cannot be read with confidence, omit that item entirely.
- "serves" is the measure each price is for. Use only these values: ${SERVES.join(", ")}.
- A line like "£4.95 / £2.95 half" is two serves: pint 4.95 and half pint 2.95.
- An item sold one way only uses "each" unless the menu names the measure.
- "price_text" is the printed price line as a customer reads it.
- Ignore headers, footers, addresses, opening hours and marketing copy.`;

export const MENU_EXTRACT_PROMPT = `You are reading a pub drinks and snacks menu.

Transcribe every category heading and every item under it. Rules:
- Copy names and prices exactly as printed. Never invent an item or a price.
- If a price cannot be read with confidence, omit that item entirely.
- "serves" is the measure each price is for. Use only these values: ${SERVES.join(", ")}.
- A line like "£4.95 / £2.95 half" is two serves: pint 4.95 and half pint 2.95.
- An item sold one way only uses "each" unless the menu names the measure.
- "price_text" is the printed price line as a customer reads it.
- "note" is any small print under the category heading, such as a mixer surcharge.
- Ignore headers, footers, addresses, opening hours and marketing copy.`;
