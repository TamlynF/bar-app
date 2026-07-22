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

test.describe("event category editor — booking config gated by grouping", () => {
  test("category Bookable + booking config appear only for Per Category grouping", async ({ page }) => {
    await page.goto(ROUTE);

    await page.getByRole("button", { name: "New" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("New Category")).toBeVisible();

    await expect(sheet.getByTitle("Toggle Bookable")).toHaveCount(0);
    await expect(sheet.getByText("Booking Card")).toHaveCount(0);
    await expect(sheet.getByText("Form Fields")).toHaveCount(0);

    await sheet.getByRole("button", { name: "Per Sub-Category" }).click();
    await expect(sheet.getByTitle("Toggle Bookable")).toHaveCount(0);
    await expect(sheet.getByText("Form Fields")).toHaveCount(0);

    await sheet.getByRole("button", { name: "Per Category" }).click();
    await expect(sheet.getByTitle("Toggle Bookable")).toBeVisible();
    await expect(sheet.getByText("Booking Card")).toBeVisible();
    await expect(sheet.getByText("Form Fields")).toHaveCount(0);

    await sheet.getByTitle("Toggle Bookable").click();
    await expect(sheet.getByText("Form Fields")).toBeVisible();

    await sheet.getByRole("button", { name: "Per Individual Event" }).click();
    await expect(sheet.getByTitle("Toggle Bookable")).toHaveCount(0);
    await expect(sheet.getByText("Booking Card")).toHaveCount(0);
    await expect(sheet.getByText("Form Fields")).toHaveCount(0);
  });
});

test.describe("sub-type editor — Bookable gated by category grouping", () => {
  let perSubtypeId: number;
  let perEventId: number;
  let uniq: string;

  test.beforeEach(async ({}, testInfo) => {
    uniq = `${Date.now()}-${testInfo.workerIndex}-${Math.floor(Math.random() * 1e6)}`;

    const { data: subGrouped, error: e1 } = await admin
      .from("event_types")
      .insert({ name: `E2E PerSubtype ${uniq}`, booking_grouping: "per_subtype" })
      .select("id")
      .single();
    if (e1) throw e1;
    perSubtypeId = subGrouped.id;

    const { data: eventGrouped, error: e2 } = await admin
      .from("event_types")
      .insert({ name: `E2E PerEvent ${uniq}`, booking_grouping: "per_event" })
      .select("id")
      .single();
    if (e2) throw e2;
    perEventId = eventGrouped.id;
  });

  test.afterEach(async () => {
    if (perSubtypeId) await admin.from("event_types").delete().eq("id", perSubtypeId);
    if (perEventId) await admin.from("event_types").delete().eq("id", perEventId);
  });

  async function openNewSubtypeSheet(page: Page, projectName: string, categoryName: string) {
    const section = page.locator("section").filter({ hasText: categoryName }).first();
    await expect(section).toBeVisible();
    if (projectName === "mobile") {
      await section.locator('[aria-haspopup="menu"]').first().click();
      await page.getByRole("menuitem", { name: /add sub-type/i }).click();
    } else {
      await section.getByRole("button", { name: /^sub-type$/i }).click();
    }
  }

  test("sub-type Bookable toggle shows for per_subtype category, hidden for per_event", async ({ page }, testInfo) => {
    await page.goto(ROUTE);

    await openNewSubtypeSheet(page, testInfo.project.name, `E2E PerSubtype ${uniq}`);
    let sheet = page.getByRole("dialog");
    await expect(sheet.getByText("New Sub-Type")).toBeVisible();
    await expect(sheet.getByTitle("Toggle Bookable")).toBeVisible();
    await expect(sheet.getByTitle("Toggle Host Required")).toBeVisible();
    await sheet.getByRole("button", { name: /^cancel$/i }).click();
    await expect(sheet).toBeHidden();

    await openNewSubtypeSheet(page, testInfo.project.name, `E2E PerEvent ${uniq}`);
    sheet = page.getByRole("dialog");
    await expect(sheet.getByText("New Sub-Type")).toBeVisible();
    await expect(sheet.getByTitle("Toggle Bookable")).toHaveCount(0);
    await expect(sheet.getByTitle("Toggle Host Required")).toBeVisible();
  });
});
