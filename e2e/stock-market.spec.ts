import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "path";

test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Fixture = { categoryId: number; itemId: number; priceId: number; eventId: number; names: Names };
type Names = { category: string; drink: string; event: string };

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
  };
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
  return { categoryId: category.id, itemId: item.id, priceId: price.id, eventId: event.id, names };
}

async function removeFixture(fixture: Fixture | undefined) {
  if (!fixture) return;
  await admin.from("market_sessions").update({ stock_market_event_id: null }).eq("stock_market_event_id", fixture.eventId);
  await admin.from("stock_market_events").delete().eq("id", fixture.eventId);
  await admin.from("menu_item_prices").delete().eq("id", fixture.priceId);
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
    await openSettled(page, "/settings/market/square-links");

    await expect(visible(page, names.drink)).toBeVisible();
    await expect(page.getByRole("button", { name: /Sync sales from Square/ }).filter({ visible: true })).toHaveCount(
      test.info().project.name === "mobile" ? 0 : 1
    );

    const category = page.getByRole("button", { name: new RegExp(names.category) }).filter({ visible: true });
    await expect(category).toHaveAttribute("aria-expanded", "true");
    await category.click();
    await expect(category).toHaveAttribute("aria-expanded", "false");
    await expect(visible(page, names.drink)).toHaveCount(0);
    await category.click();
    await expect(visible(page, names.drink)).toBeVisible();
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
