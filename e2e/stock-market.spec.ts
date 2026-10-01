import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "path";

test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Fixture = {
  categoryId: number;
  itemId: number;
  priceId: number;
  eventId: number;
  squareItemId: number;
  squarePriceId: number;
  variationId: string;
  pitcherVariationId: string;
  rumItemId: number;
  rumSinglePriceId: number;
  rumVariationId: string;
  modifierListId: string;
  names: Names;
};
type Names = {
  category: string;
  drink: string;
  event: string;
  gin: string;
  squareItem: string;
  pitcher: string;
  rum: string;
};

async function must<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await query;
  if (error || data == null) throw new Error(error?.message ?? "no row returned");
  return data;
}

/* A spirit served with a mixer (£5.00 + the event's £1.25 mixer) on its own
   market event, so each viewport works on rows no other spec touches. */
async function createFixture(suffix: string): Promise<Fixture> {
  const names = {
    category: `E2E Spirits ${suffix}`,
    drink: `E2E Vodka ${suffix}`,
    event: `E2E Market ${suffix}`,
    gin: `E2E Gin ${suffix}`,
    squareItem: `E2E Square Gin ${suffix}`,
    pitcher: `E2E Square Cider ${suffix}`,
    rum: `E2E Rum ${suffix}`,
  };
  const key = suffix.replace(/[^A-Za-z0-9]/g, "");
  const category = await must(
    admin.from("menu_categories").insert({ name: names.category, display_order: 900 }).select("id").single()
  );
  const item = await must(
    admin.from("menu_items").insert({ category_id: category.id, name: names.drink, price: "5.00" }).select("id").single()
  );
  const price = await must(
    admin
      .from("menu_item_prices")
      .insert({ menu_item_id: item.id, serve: "single", amount: 5, with_mixer: true })
      .select("id")
      .single()
  );
  const event = await must(
    admin
      .from("stock_market_events")
      .insert({ name: names.event, open_time: "19:00", close_time: "23:30", mixer_price: 1.25 })
      .select("id")
      .single()
  );
  await must(
    admin
      .from("stock_market_event_items")
      .insert({ event_id: event.id, menu_item_id: item.id, menu_item_price_id: price.id })
      .select("event_id")
  );
  const squareItem = await must(
    admin.from("menu_items").insert({ category_id: category.id, name: names.gin, price: "4.00" }).select("id").single()
  );
  const squarePrice = await must(
    admin
      .from("menu_item_prices")
      .insert({ menu_item_id: squareItem.id, serve: "single", amount: 4 })
      .select("id")
      .single()
  );
  const modifierListId = `E2E-ML-${key}`;
  const variationId = `E2E-VAR-${key}`;
  await must(
    admin
      .from("square_catalog_modifier_lists")
      .insert({
        modifier_list_id: modifierListId,
        name: `E2E Mixer ${key}`,
        modifiers: [
          { id: `${modifierListId}-0`, name: "No mixer", price: 0 },
          { id: `${modifierListId}-1`, name: "Tonic", price: 1.5 },
          { id: `${modifierListId}-2`, name: "Lemonade", price: 1.5 },
        ],
        synced_at: "2100-01-01T00:00:00Z",
      })
      .select("modifier_list_id")
  );
  /* Dated in the future so a catalog refresh from the sandbox, which retires
     rows it did not just copy, leaves it in place. */
  await must(
    admin
      .from("square_catalog_variations")
      .insert({
        variation_id: variationId,
        item_id: `E2E-ITEM-${key}`,
        item_name: names.squareItem,
        variation_name: "Single",
        price: 4,
        reporting_category_name: "E2E Reporting",
        modifier_list_ids: [modifierListId],
        modifier_list_names: [`E2E Mixer ${key}`],
        synced_at: "2100-01-01T00:00:00Z",
      })
      .select("variation_id")
  );
  const rumVariationId = `E2E-RUM-${key}`;
  const rumItem = await must(
    admin
      .from("menu_items")
      .insert({ category_id: category.id, name: names.rum, price: "£4.20 single / £7.00 double", display_order: 2 })
      .select("id")
      .single()
  );
  const rumPrices = await must(
    admin
      .from("menu_item_prices")
      .insert([
        { menu_item_id: rumItem.id, serve: "single", amount: 4.2, display_order: 1, square_variation_id: rumVariationId },
        { menu_item_id: rumItem.id, serve: "double", amount: 7, display_order: 2 },
      ])
      .select("id, serve")
  );
  const pitcherVariationId = `E2E-PITCHER-${key}`;
  await must(
    admin
      .from("square_catalog_variations")
      .insert({
        variation_id: pitcherVariationId,
        item_id: `E2E-PITCHER-ITEM-${key}`,
        item_name: names.pitcher,
        variation_name: "Pitcher",
        price: 15,
        synced_at: "2100-01-01T00:00:00Z",
      })
      .select("variation_id")
  );
  return {
    categoryId: category.id,
    itemId: item.id,
    priceId: price.id,
    eventId: event.id,
    squareItemId: squareItem.id,
    squarePriceId: squarePrice.id,
    variationId,
    pitcherVariationId,
    rumItemId: rumItem.id,
    rumSinglePriceId: rumPrices.find((row) => row.serve === "single")!.id,
    rumVariationId,
    modifierListId,
    names,
  };
}

async function removeFixture(fixture: Fixture | undefined) {
  if (!fixture) return;
  await admin.from("market_sessions").update({ stock_market_event_id: null }).eq("stock_market_event_id", fixture.eventId);
  await admin.from("stock_market_events").delete().eq("id", fixture.eventId);
  await admin.from("square_catalog_variations").delete().in("variation_id", [fixture.variationId, fixture.pitcherVariationId]);
  await admin.from("menu_items").delete().in("name", [fixture.names.pitcher, fixture.names.rum]);
  await admin.from("square_catalog_modifier_lists").delete().eq("modifier_list_id", fixture.modifierListId);
  await admin.from("menu_item_prices").delete().in("id", [fixture.priceId, fixture.squarePriceId]);
  await admin.from("menu_items").delete().eq("id", fixture.squareItemId);
  await admin.from("menu_items").delete().eq("id", fixture.itemId);
  await admin.from("menu_categories").delete().eq("id", fixture.categoryId);
}

function visible(page: Page, text: string) {
  return page.getByText(new RegExp(`^${text}( · .*)?$`)).filter({ visible: true });
}

/* Typing before React has hydrated the page is lost, which the slower phone
   emulation hits; the page is interactive once the network goes quiet. */
async function openSettled(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test.describe("stock market", () => {
  let fixture: Fixture | undefined;

  test.beforeAll(async ({}, testInfo) => {
    fixture = await createFixture(`${testInfo.project.name} ${Date.now()}${Math.floor(Math.random() * 1000)}`);
  });

  test.afterAll(async () => {
    await removeFixture(fixture);
  });

  test("event page shows the drink with its mixer price and saves a normal-units override", async ({ page }) => {
    const { names, eventId } = fixture!;
    await openSettled(page, `/settings/market/${eventId}`);

    await expect(visible(page, names.drink)).toBeVisible();
    await expect(page.getByText("£6.25").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Normal sales per night", { exact: true })).toHaveCount(0);

    const override = page.getByRole("spinbutton", { name: `Override normal units per night for ${names.drink} single` });
    await override.fill("12");
    await override.press("Enter");
    await expect(page.getByText("Override saved.")).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("stock_market_event_items")
          .select("normal_units_per_night")
          .eq("event_id", eventId)
          .eq("menu_item_price_id", fixture!.priceId)
          .single();
        return data ? Number(data.normal_units_per_night) : null;
      })
      .toBe(12);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("spinbutton", { name: `Override normal units per night for ${names.drink} single` })
    ).toHaveValue("12");
  });

  test("Square links lists the drink and its category opens and closes", async ({ page }) => {
    const { names } = fixture!;
    await openSettled(page, "/settings/market/square-links?view=menu");

    await expect(visible(page, names.drink)).toBeVisible();
    await page.getByRole("button", { name: "More Square actions" }).filter({ visible: true }).click();
    await expect(page.getByRole("menuitem", { name: "Sync sales from Square" })).toBeVisible();
    await page.keyboard.press("Escape");

    const category = page.getByRole("button", { name: new RegExp(names.category) }).filter({ visible: true });
    await expect(category).toHaveAttribute("aria-expanded", "true");
    await category.click();
    await expect(category).toHaveAttribute("aria-expanded", "false");
    await expect(visible(page, names.drink)).toHaveCount(0);
    await category.click();
    await expect(visible(page, names.drink)).toBeVisible();
  });

  test("Square items links a variation to a serve and follows its menu category", async ({ page }) => {
    const { names, variationId, modifierListId, squarePriceId, categoryId } = fixture!;
    await openSettled(page, "/settings/market/square-links");
    await expect(page.getByRole("link", { name: "Square items" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("textbox", { name: "Search Square items" }).fill(names.squareItem);
    await expect(visible(page, names.squareItem)).toBeVisible();
    await expect(
      page.getByText(`E2E Mixer ${modifierListId.replace("E2E-ML-", "")} +£1.50`).filter({ visible: true })
    ).toBeVisible();

    const serveSelect = page
      .getByRole("combobox", { name: `Menu serve for ${names.squareItem} Single` })
      .filter({ visible: true });
    await serveSelect.selectOption(String(squarePriceId));
    await expect(page.getByText("Link saved.")).toBeVisible({ timeout: 15_000 });

    const catalogRow = async () => {
      const { data } = await admin
        .from("square_catalog_variations")
        .select("menu_category_id, menu_category_manual")
        .eq("variation_id", variationId)
        .single();
      return data ? { category: data.menu_category_id == null ? null : Number(data.menu_category_id), manual: data.menu_category_manual } : null;
    };
    const linkedVariation = async () => {
      const { data } = await admin.from("menu_item_prices").select("square_variation_id").eq("id", squarePriceId).single();
      return data?.square_variation_id ?? null;
    };
    await expect.poll(linkedVariation).toBe(variationId);
    await expect.poll(catalogRow).toEqual({ category: categoryId, manual: false });

    const categorySelect = page
      .getByRole("combobox", { name: `Menu category for ${names.squareItem} Single` })
      .filter({ visible: true });
    await expect(categorySelect).toHaveValue("auto");
    await expect(categorySelect.locator("option[value=auto]")).toHaveText(`${names.category} (from link)`, {
      timeout: 15_000,
    });

    await categorySelect.selectOption(String(categoryId));
    await expect(page.getByText("Category saved.")).toBeVisible({ timeout: 15_000 });
    await expect.poll(catalogRow).toEqual({ category: categoryId, manual: true });

    await serveSelect.selectOption("");
    await expect(page.getByText("Link removed.")).toBeVisible({ timeout: 15_000 });
    await expect.poll(linkedVariation).toBeNull();
    await expect.poll(catalogRow).toEqual({ category: categoryId, manual: true });
  });

  test("Square items creates a hidden menu serve for an item the menu lacks", async ({ page }) => {
    const { names, pitcherVariationId, categoryId } = fixture!;
    await openSettled(page, "/settings/market/square-links");
    await page.getByRole("textbox", { name: "Search Square items" }).fill(names.pitcher);
    await expect(visible(page, names.pitcher)).toBeVisible();

    await page
      .getByRole("button", { name: `Create hidden menu serve for ${names.pitcher} Pitcher` })
      .filter({ visible: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Create hidden menu serve" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("pitcher", { exact: true })).toBeVisible();
    await dialog.getByRole("combobox", { name: "Menu category" }).selectOption(String(categoryId));
    await expect(dialog.getByText(new RegExp(`Creates "${names.pitcher}" with a pitcher serve`))).toBeVisible();
    await dialog.getByRole("button", { name: "Create and link" }).click();
    await expect(page.getByText(`${names.pitcher} added to the menu, hidden, and linked.`)).toBeVisible({ timeout: 15_000 });

    const created = async () => {
      const { data } = await admin
        .from("menu_items")
        .select("category_id, show_on_menu, menu_item_prices(serve, amount, show_on_menu, square_variation_id)")
        .eq("name", names.pitcher)
        .maybeSingle();
      return data;
    };
    await expect.poll(created).toMatchObject({
      category_id: categoryId,
      show_on_menu: false,
      menu_item_prices: [{ serve: "pitcher", amount: 15, show_on_menu: false, square_variation_id: pitcherVariationId }],
    });

    const menu = await page.context().newPage();
    await openSettled(menu, "/menu");
    await expect(menu.getByText(names.drink).first()).toBeVisible();
    await expect(menu.getByText(names.pitcher)).toHaveCount(0);
    await menu.close();
  });

  test("editing a serve's price in the menu keeps its Square link", async ({ page }) => {
    const { names, rumSinglePriceId, rumVariationId } = fixture!;
    await openSettled(page, "/settings/menu");

    await page.getByText(names.rum, { exact: true }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Edit" }).filter({ visible: true }).click();
    await page.getByRole("button", { name: /single/ }).filter({ visible: true }).click();
    await page.getByRole("spinbutton", { name: "Amount for serve 1" }).fill("4.50");
    await page.getByRole("button", { name: "Save" }).filter({ visible: true }).click();
    await expect(page.getByRole("spinbutton", { name: "Amount for serve 1" })).toHaveCount(0);
    await page.getByRole("button", { name: "Save" }).filter({ visible: true }).click();
    await page.getByRole("button", { name: /update order/i }).click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("menu_item_prices")
          .select("amount, square_variation_id")
          .eq("id", rumSinglePriceId)
          .maybeSingle();
        return data ? { amount: Number(data.amount), link: data.square_variation_id } : null;
      }, { timeout: 15_000 })
      .toEqual({ amount: 4.5, link: rumVariationId });
  });

  test("opening warns about unsynced sales, opens the market and closes it again", async ({ page }) => {
    test.skip(
      test.info().project.name === "mobile",
      "Only one market can be live at a time, so the open-and-close run happens once, on desktop."
    );
    test.setTimeout(90_000);
    const { names, eventId } = fixture!;

    await admin
      .from("market_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("status", "live");
    await admin
      .from("square_sync_state")
      .update({ last_synced_at: null, last_run_at: null, last_status: null, last_error: null })
      .eq("id", 1);

    await openSettled(page, `/settings/market/${eventId}`);
    await page.getByRole("button", { name: "Open market" }).filter({ visible: true }).click();

    const warning = page.getByRole("dialog", { name: "Sales history may be out of date" });
    await expect(warning).toBeVisible();
    await expect(warning.getByText(/never been synced/)).toBeVisible();
    await warning.getByLabel(/Open without syncing/).check();
    await warning.getByRole("button", { name: "Open market" }).click();

    await expect(page.getByText(`${names.event} open - 1 drinks trading.`)).toBeVisible({ timeout: 45_000 });

    const { data: session } = await admin
      .from("market_sessions")
      .select("id, status")
      .eq("stock_market_event_id", eventId)
      .eq("status", "live")
      .maybeSingle();
    expect(session?.status).toBe("live");
    const { data: instrument } = await admin
      .from("market_instruments")
      .select("mixer_price")
      .eq("session_id", session!.id)
      .eq("menu_item_price_id", fixture!.priceId)
      .single();
    expect(Number(instrument?.mixer_price)).toBe(1.25);

    await page.goto("/market");
    await expect(page.getByText(names.drink).first()).toBeVisible({ timeout: 20_000 });

    await page.goto("/settings/market");
    await page.getByRole("button", { name: "Close market" }).filter({ visible: true }).first().click();
    await page.getByRole("dialog", { name: "Close the market?" }).getByRole("button", { name: "Close market" }).click();
    await expect(page.getByText("Market closed - till prices restored.")).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(async () => {
        const { data } = await admin.from("market_sessions").select("status").eq("id", session!.id).single();
        return data?.status;
      })
      .toBe("ended");
  });
});
