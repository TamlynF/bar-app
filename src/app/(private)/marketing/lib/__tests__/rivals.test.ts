import { describe, it, expect } from "vitest";
import { cleanParsedMenu } from "@/lib/menu-import";
import {
  rivalMenuStatus,
  rivalStartUrls,
  rivalCaptureStarts,
  captureSourceForUrl,
  isDrinkingHangout,
  isOwnVenue,
  itemTypeFromCategory,
  menuTargetUrl,
  parseRadiusMeters,
  planDiscover,
  pricesForPinned,
  rowsFromParsedMenu,
  rivalsNeedingCapture,
  nextCaptureBatch,
  RIVAL_CAPTURE_BATCH,
  DEFAULT_RADIUS_METERS,
} from "../rivals";
import { fetchFailureMessage, isSafeHttpUrl, menuLinksFromHtml, stripTrackingParams } from "../capture-menu";
import { extraDrinkUrlsFromPage, parseAnchors, pickDrinkPages, pickDrinkPdfs } from "../discover-drinks";
import { liveMenuToDrinkText, parseLiveMenuHints } from "../live-menu";
import type { CompetitorPrice } from "../types";

describe("parseRadiusMeters", () => {
  it("defaults to one and a half miles", () => {
    expect(parseRadiusMeters(null)).toBe(DEFAULT_RADIUS_METERS);
    expect(parseRadiusMeters("")).toBe(DEFAULT_RADIUS_METERS);
  });

  it("reads miles and kilometres", () => {
    expect(parseRadiusMeters("5 miles")).toBe(8047);
    expect(parseRadiusMeters("2 km")).toBe(2000);
    expect(parseRadiusMeters("800 m")).toBe(800);
  });
});

describe("isOwnVenue", () => {
  const own = ["Don Fenticas", "Don Fenticas Bar"];

  it("skips the house", () => {
    expect(isOwnVenue("Don Fenticas", own)).toBe(true);
    expect(isOwnVenue("Don Fenticas Bar & Cafe", own)).toBe(true);
  });

  it("keeps a different pub", () => {
    expect(isOwnVenue("The Flintlock", own)).toBe(false);
    expect(isOwnVenue("The Anchor", own)).toBe(false);
  });
});

describe("planDiscover", () => {
  const hits = [
    { placeId: "a", name: "The Flintlock", website: "https://flintlock.example", address: "Hinckley" },
    { placeId: "b", name: "Don Fenticas", website: null, address: null },
    { placeId: "c", name: "The Anchor", website: null, address: "Castle St" },
  ];

  it("auto-pins new pubs and skips the house", () => {
    const plan = planDiscover(hits, [], ["Don Fenticas"]);
    expect(plan.skippedOwn).toEqual(["Don Fenticas"]);
    expect(plan.inserts.map((i) => i.name)).toEqual(["The Flintlock", "The Anchor"]);
    expect(plan.inserts.every((i) => i.is_pinned)).toBe(true);
    expect(plan.updates).toHaveLength(0);
    expect(plan.skippedIndustry).toEqual([]);
  });

  it("does not re-pin a venue staff already turned off", () => {
    const plan = planDiscover(hits, [
      { id: "1", place_id: "a", is_pinned: false, name: "The Flintlock" },
    ], ["Don Fenticas"]);
    expect(plan.inserts.map((i) => i.name)).toEqual(["The Anchor"]);
    expect(plan.updates).toEqual([
      { id: "1", name: "The Flintlock", website: "https://flintlock.example", address: "Hinckley" },
    ]);
  });

  it("skips coffee shops and daytime kitchens", () => {
    const plan = planDiscover(
      [
        ...hits,
        {
          placeId: "d",
          name: "Moko - Coffee House & Kitchen",
          website: "http://www.mokorestaurant.com/",
          address: "Hinckley",
          types: ["cafe", "bar"],
          latestCloseHour: 15,
        },
      ],
      [{ id: "9", place_id: "d", is_pinned: true, name: "Moko - Coffee House & Kitchen" }],
      ["Don Fenticas"],
    );
    expect(plan.skippedIndustry).toEqual(["Moko - Coffee House & Kitchen"]);
    expect(plan.unpins).toEqual([{ id: "9", name: "Moko - Coffee House & Kitchen" }]);
    expect(plan.inserts.map((i) => i.name)).not.toContain("Moko - Coffee House & Kitchen");
  });
});

describe("isDrinkingHangout", () => {
  it("keeps pubs, bars and evening lounges", () => {
    expect(isDrinkingHangout({ name: "The Flintlock", types: ["bar", "pub"] })).toBe(true);
    expect(isDrinkingHangout({ name: "Tarro Lounge", types: ["cafe", "bar"], latestCloseHour: 23 })).toBe(true);
  });

  it("drops coffee houses even if Google tagged them as a bar", () => {
    expect(
      isDrinkingHangout({
        name: "Moko - Coffee House & Kitchen",
        types: ["bar", "cafe"],
        latestCloseHour: 15,
      }),
    ).toBe(false);
  });
});

describe("pricesForPinned", () => {
  const price = (venue: string, competitor_id?: string): CompetitorPrice => ({
    id: venue,
    venue_name: venue,
    item_name: "Lager",
    item_type: "drink",
    price_text: "£4.50",
    price_amount: 4.5,
    area: "Hinckley",
    source_url: null,
    source_name: null,
    fetched_at: "2026-09-18",
    competitor_id: competitor_id ?? null,
  });

  it("falls back to every price when no rivals exist yet", () => {
    const rows = [price("The Flintlock")];
    expect(pricesForPinned(rows, [])).toEqual(rows);
  });

  it("drops unpinned venues", () => {
    const rows = [price("The Flintlock", "1"), price("The Gastro", "2")];
    const kept = pricesForPinned(rows, [
      { id: "1", name: "The Flintlock", is_pinned: true },
      { id: "2", name: "The Gastro", is_pinned: false },
    ]);
    expect(kept.map((p) => p.venue_name)).toEqual(["The Flintlock"]);
  });
});

describe("rowsFromParsedMenu", () => {
  it("emits one row per serve and never invents a price", () => {
    const menu = cleanParsedMenu({
      categories: [
        {
          name: "Draught",
          items: [
            {
              name: "Carling",
              price_text: "£4.20 pint / £2.40 half",
              serves: [
                { serve: "pint", amount: 4.2 },
                { serve: "half pint", amount: 2.4 },
              ],
            },
          ],
        },
        {
          name: "Snacks",
          items: [{ name: "Nuts", price_text: "£1.50", serves: [{ serve: "each", amount: 1.5 }] }],
        },
      ],
    });
    const rows = rowsFromParsedMenu(menu, {
      competitorId: "c1",
      venueName: "The Flintlock",
      area: "Hinckley",
      sourceUrl: "https://flintlock.example/menu",
      sourceName: "The Flintlock menu",
    });
    expect(rows.map((r) => r.item_name)).toEqual(["Carling (pint)", "Carling (half pint)", "Nuts"]);
    expect(rows[0].price_amount).toBe(4.2);
    expect(rows[2].item_type).toBe("snack");
    expect(
      rowsFromParsedMenu(menu, {
        competitorId: "c1",
        venueName: "The Flintlock",
        area: "Hinckley",
        sourceUrl: null,
        sourceName: "test",
      }, true).map((r) => r.item_name),
    ).toEqual(["Carling (pint)", "Carling (half pint)"]);
  });
});

describe("itemTypeFromCategory", () => {
  it("classifies snacks and food away from drinks", () => {
    expect(itemTypeFromCategory("Crisps")).toBe("snack");
    expect(itemTypeFromCategory("Burgers")).toBe("food");
    expect(itemTypeFromCategory("Mains")).toBe("food");
    expect(itemTypeFromCategory("Draught")).toBe("drink");
    expect(itemTypeFromCategory("Main drinks")).toBe("drink");
    expect(itemTypeFromCategory("Cocktails")).toBe("drink");
  });
});

describe("menu URL helpers", () => {
  it("prefers a staff menu URL over the Places website", () => {
    expect(menuTargetUrl("https://menu.example", "https://home.example")).toBe("https://menu.example");
    expect(menuTargetUrl(null, "https://home.example")).toBe("https://home.example");
    expect(menuTargetUrl(null, null)).toBeNull();
  });

  it("labels the capture source from which URL was used", () => {
    expect(captureSourceForUrl("https://menu.example", ["https://menu.example"], "https://home.example")).toBe("menu_url");
    expect(captureSourceForUrl("https://home.example", [], "https://home.example")).toBe("website");
  });

  it("strips tracking junk before using a Places website", () => {
    expect(
      rivalStartUrls({
        website: "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab?utm_source=g_places",
        menu_urls: [],
      }),
    ).toEqual(["https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab"]);
  });

  it("queues uncaptured rivals that have a website", () => {
    const waiting = [
      { id: "a", last_captured_at: null, website: "https://a.example", menu_urls: [] },
      { id: "b", last_captured_at: "2026-09-18T00:00:00Z", website: "https://b.example", menu_urls: [] },
      { id: "c", last_captured_at: null, website: null, menu_urls: [] },
    ];
    expect(rivalsNeedingCapture(waiting)).toEqual(["a"]);
    expect(nextCaptureBatch(waiting, 1).map((row) => row.id)).toEqual(["a"]);
    expect(RIVAL_CAPTURE_BATCH).toBeGreaterThan(0);
  });

  it("leaves rivals taken off the price-off out of the capture queue", () => {
    const waiting = [
      { id: "off", is_pinned: false, last_captured_at: null, website: "https://off.example", menu_urls: [] },
      { id: "on", is_pinned: true, last_captured_at: null, website: "https://on.example", menu_urls: [] },
    ];
    expect(rivalsNeedingCapture(waiting)).toEqual(["on"]);
    expect(nextCaptureBatch(waiting).map((row) => row.id)).toEqual(["on"]);
  });

  it("never starts a capture from a saved junk menu URL", () => {
    expect(
      rivalCaptureStarts({
        website: "https://thelounges.co.uk/tarro/",
        menu_urls: [
          "https://menus.tenkites.com/404.html",
          "https://www.instagram.com/accounts/login/?next=%2Fbar%2Fmenu",
          "https://sketchleygrangehotel.co.uk/wp-content/uploads/accessibility-guide.pdf",
          "https://thelounges.co.uk/tarro/menus",
        ],
      }),
    ).toEqual(["https://thelounges.co.uk/tarro/menus", "https://thelounges.co.uk/tarro/"]);
  });

  it("labels menu URLs versus a board photo", () => {
    expect(rivalMenuStatus({ menu_urls: [], last_capture_source: null }).label).toBe("No menu");
    expect(rivalMenuStatus({ menu_urls: ["https://a.example/menu"], last_capture_source: "website" }).label).toBe(
      "Menu URL",
    );
    expect(
      rivalMenuStatus({
        menu_urls: ["https://a.example/menu", "https://a.example/drinks.pdf"],
        last_capture_source: "menu_url",
      }).label,
    ).toBe("2 menu URLs");
    expect(rivalMenuStatus({ menu_urls: ["https://a.example/menu"], last_capture_source: "upload" }).label).toBe(
      "Board photo",
    );
  });
});

describe("isSafeHttpUrl", () => {
  it("allows public https and rejects local addresses", () => {
    expect(isSafeHttpUrl("https://theflintlock.co.uk/menu")).toBe(true);
    expect(isSafeHttpUrl("http://127.0.0.1/menu")).toBe(false);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("fetchFailureMessage", () => {
  it("turns a DNS miss into a staff-facing prompt", () => {
    const err = new Error("fetch failed");
    (err as Error & { cause: Error }).cause = new Error("getaddrinfo ENOTFOUND www.craftypubgroup.com");
    expect(fetchFailureMessage(err)).toMatch(/does not exist/i);
  });
});

describe("stripTrackingParams", () => {
  it("drops utm query junk from a Places website", () => {
    expect(
      stripTrackingParams("https://www.flintlockhinckley.co.uk/?utm_source=gbp&utm_medium=organic"),
    ).toBe("https://www.flintlockhinckley.co.uk/");
  });
});

describe("menuLinksFromHtml", () => {
  it("prefers a same-host drinks menu over an unrelated href", () => {
    const html = `
      <a href="/book">Book</a>
      <a href="/our-drinks">Drinks</a>
      <a href="https://other.example/menu">Elsewhere</a>
    `;
    expect(menuLinksFromHtml(html, "https://www.flintlockhinckley.co.uk/")).toEqual([
      "https://www.flintlockhinckley.co.uk/our-drinks",
      "https://other.example/menu",
    ]);
  });
});

describe("Hungry Horse-style drinks discovery", () => {
  it("keeps drinks menu and pdf, drops a food-only main menu", () => {
    const html = `
      <a href="/pubs/leicestershire/hansom-cab/menu">MENU</a>
      <a href="/pubs/leicestershire/hansom-cab/menu?type=main+menu">Main Menu</a>
      <a href="/pubs/leicestershire/hansom-cab/menu?type=drinks+menu">Drinks Menu</a>
      <a href="/menus/hansom-cab-drinks.pdf">Download</a>
    `;
    const page = "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab";
    const anchors = parseAnchors(html, page);
    expect(pickDrinkPages(anchors)).toEqual([
      "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menu?type=drinks+menu",
      "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menu",
    ]);
    expect(pickDrinkPdfs(anchors)).toEqual([
      "https://www.hungryhorse.co.uk/menus/hansom-cab-drinks.pdf",
    ]);
  });

  it("reads drinks downloads from embedded JSON and skips food and allergen files", () => {
    const html = `
      <script type="application/json">
        {"menus":{"value":[
          {"text":"Drinks Menu","href":"https:\\u002F\\u002Fgkbr-p-001.sitecorecontenthub.cloud\\u002Fapi\\u002Fpublic\\u002Fcontent\\u002Fdrinks"},
          {"text":"Main Menu","href":"https:\\u002F\\u002Fgkbr-p-001.sitecorecontenthub.cloud\\u002Fapi\\u002Fpublic\\u002Fcontent\\u002Ffood"},
          {"text":"Drink Allergens","href":"https:\\u002F\\u002Fgkbr-p-001.sitecorecontenthub.cloud\\u002Fapi\\u002Fpublic\\u002Fcontent\\u002Fallergens"}
        ]}}
      </script>
    `;
    const page = "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menu";
    const anchors = parseAnchors(html, page);
    expect(pickDrinkPdfs(anchors)).toEqual([
      "https://gkbr-p-001.sitecorecontenthub.cloud/api/public/content/drinks",
    ]);
    expect(extraDrinkUrlsFromPage(page)).toEqual([
      "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menu?type=drinks+menu",
      "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menu?type=drinks",
    ]);
  });

  it("guesses the venue drinks menu from a Hungry Horse homepage", () => {
    expect(
      extraDrinkUrlsFromPage("https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab?utm_source=g_places"),
    ).toEqual([
      "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menu?type=drinks+menu",
      "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menus",
      "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menu",
      "https://www.hungryhorse.co.uk/pubs/leicestershire/hansom-cab/menus?type=drinks+menu",
    ]);
  });

  it("keeps the venue menus path and ignores the chain-wide menus hub", () => {
    const html = `
      <a href="https://thelounges.co.uk/menus">Menus</a>
      <a href="/tarro/menus">View Menu</a>
      <div data-ten-kites="https://menus.tenkites.com/loungers/lounges09"></div>
    `;
    const start = "https://thelounges.co.uk/tarro/";
    const anchors = parseAnchors(html, start);
    expect(pickDrinkPages(anchors, 6, start)).toContain("https://thelounges.co.uk/tarro/menus");
    expect(pickDrinkPages(anchors, 6, start)).toContain("https://menus.tenkites.com/loungers/lounges09");
    expect(pickDrinkPages(anchors, 6, start)).not.toContain("https://thelounges.co.uk/menus");
    expect(extraDrinkUrlsFromPage(start)).toEqual([
      "https://thelounges.co.uk/tarro/menu?type=drinks+menu",
      "https://thelounges.co.uk/tarro/menus",
      "https://thelounges.co.uk/tarro/menu",
      "https://thelounges.co.uk/tarro/menus?type=drinks+menu",
    ]);
  });
});

describe("live drinks menu JSON", () => {
  it("reads Greene King-style apiUrl, venue and key from the page", () => {
    const html = `
      {"fields":{
        "venueId":{"value":"1842"},
        "apiUrl":{"value":"https:\\u002F\\u002Fprod-mobile-bff.greeneking.co.uk\\u002Fmenu-service\\u002Fapi\\u002Fenterprise\\u002Fv1\\u002Fmenu"},
        "subscriptionKey":{"value":"abc123subscriptionkey000000000001"}
      }}
    `;
    expect(parseLiveMenuHints(html)).toEqual({
      apiUrl: "https://prod-mobile-bff.greeneking.co.uk/menu-service/api/enterprise/v1/menu",
      venueId: "1842",
      key: "abc123subscriptionkey000000000001",
    });
  });

  it("flattens drink prices and skips a food branch", () => {
    const text = liveMenuToDrinkText({
      menus: [
        {
          name: "Drinks",
          items: [
            { name: "Carling", portions: [{ name: "pint", price: 4.2 }, { name: "half pint", price: 2.4 }] },
          ],
        },
        {
          name: "Burgers",
          items: [{ name: "Cheeseburger", price: 12.5 }],
        },
      ],
    });
    expect(text).toContain("Carling (pint) £4.20");
    expect(text).toContain("Carling (half pint) £2.40");
    expect(text).not.toContain("Cheeseburger");
  });
});
