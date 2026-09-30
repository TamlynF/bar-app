import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "path";

test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const ROUTE = "/event-setups/event-types";
const BOOKABLE_SWITCH = "Can customers book it online?";
const HOST_SWITCH = "Does someone have to run it?";

test.describe("event category editor - booking config gated by grouping", () => {
  test("category Bookable + booking config appear only for one page per category", async ({ page }) => {
    await page.goto(ROUTE);

    await page.getByRole("button", { name: "Add category" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Category details" });
    await expect(sheet.getByText("New category")).toBeVisible();

    const bookable = sheet.getByRole("switch", { name: BOOKABLE_SWITCH });
    await expect(bookable).toHaveCount(0);
    await expect(sheet.getByText("Booking card", { exact: true })).toHaveCount(0);
    await expect(sheet.getByText("Form fields", { exact: true })).toHaveCount(0);

    await sheet.getByRole("button", { name: /^One page per sub-category/ }).click();
    await expect(bookable).toHaveCount(0);

    await sheet.getByRole("button", { name: /^One page for the whole category/ }).click();
    await expect(bookable).toBeVisible();
    await expect(sheet.getByText("Booking card", { exact: true })).toHaveCount(0);
    await expect(sheet.getByText("Form fields", { exact: true })).toHaveCount(0);

    await bookable.click();
    await expect(sheet.getByText("Booking card", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Form fields", { exact: true })).toBeVisible();

    await sheet.getByRole("button", { name: /^Each date books separately/ }).click();
    await expect(bookable).toHaveCount(0);
    await expect(sheet.getByText("Booking card", { exact: true })).toHaveCount(0);
    await expect(sheet.getByText("Form fields", { exact: true })).toHaveCount(0);
  });
});

test.describe("sub-category editor - Bookable gated by category grouping", () => {
  let perSubtypeId: number;
  let perEventId: number;
  let uniq: string;

  test.beforeEach(async ({}, testInfo) => {
    uniq = `${Date.now()}-${testInfo.workerIndex}-${Math.floor(Math.random() * 1e6)}`;

    const { data: subGrouped, error: e1 } = await admin
      .from("event_types")
      .insert({ name: `E2e Persubtype ${uniq}`, booking_grouping: "per_subtype" })
      .select("id")
      .single();
    if (e1) throw e1;
    perSubtypeId = subGrouped.id;

    const { data: eventGrouped, error: e2 } = await admin
      .from("event_types")
      .insert({ name: `E2e Perevent ${uniq}`, booking_grouping: "per_event" })
      .select("id")
      .single();
    if (e2) throw e2;
    perEventId = eventGrouped.id;
  });

  test.afterEach(async () => {
    if (perSubtypeId) await admin.from("event_types").delete().eq("id", perSubtypeId);
    if (perEventId) await admin.from("event_types").delete().eq("id", perEventId);
  });

  async function openNeedsStep(page: Page, categoryName: string) {
    await page.goto(ROUTE);
    await page.getByRole("button", { name: new RegExp(`^${categoryName} \\d+ sub-categor`) }).click();
    await page.getByRole("button", { name: /^Add (a )?sub-category( to .+)?$/ }).first().click();

    const sheet = page.getByRole("dialog", { name: `In ${categoryName}` });
    await expect(sheet.getByText("New sub-category")).toBeVisible();
    await sheet.getByPlaceholder("e.g. Quiz", { exact: true }).fill("E2e Night");
    await sheet.getByPlaceholder("e.g. Quiz Night", { exact: true }).fill("E2e Night");
    await sheet.getByRole("button", { name: "Next" }).click();
    await sheet.getByRole("button", { name: "Next" }).click();
    await expect(sheet.getByRole("heading", { name: "What it needs" })).toBeVisible();
    return sheet;
  }

  test("sub-category Bookable toggle shows for per_subtype category, hidden for per_event", async ({ page }) => {
    let sheet = await openNeedsStep(page, `E2e Persubtype ${uniq}`);
    await expect(sheet.getByRole("switch", { name: BOOKABLE_SWITCH })).toBeVisible();
    await expect(sheet.getByRole("switch", { name: HOST_SWITCH })).toBeVisible();

    sheet = await openNeedsStep(page, `E2e Perevent ${uniq}`);
    await expect(sheet.getByRole("switch", { name: BOOKABLE_SWITCH })).toHaveCount(0);
    await expect(sheet.getByRole("switch", { name: HOST_SWITCH })).toBeVisible();
  });
});
