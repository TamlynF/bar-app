import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// Authenticated admin flows — reuse the session captured in global-setup.
test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

// Service-role client against LOCAL Supabase (dotenv-loaded in playwright.config).
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Covers commit 59cf155 "relocate booking configuration to appropriate levels":
// the category (event_types) now owns a shared booking page/config + bookable flag
// ONLY when grouped `per_type`, and a sub-type owns one ONLY when its category is
// grouped `per_subtype`. The category editor surfaces these controls conditionally.

const ROUTE = "/event-setups/event-types";

test.describe("event category editor — booking config gated by grouping", () => {
  test("category Bookable + booking config appear only for Per Category grouping", async ({ page }) => {
    await page.goto(ROUTE);

    // Top "New" button opens the New Category bottom sheet (same on both viewports).
    await page.getByRole("button", { name: "New" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("New Category")).toBeVisible();

    // Default grouping is Per Individual Event (per_event): no category-level
    // bookable toggle, no booking-card branding, no booking-config editor.
    await expect(sheet.getByTitle("Toggle Bookable")).toHaveCount(0);
    await expect(sheet.getByText("Booking Card")).toHaveCount(0);
    await expect(sheet.getByText("Form Fields")).toHaveCount(0);

    // Per Sub-Category (per_subtype) still doesn't give the *category* a config —
    // that lives on the sub-types.
    await sheet.getByRole("button", { name: "Per Sub-Category" }).click();
    await expect(sheet.getByTitle("Toggle Bookable")).toHaveCount(0);
    await expect(sheet.getByText("Form Fields")).toHaveCount(0);

    // Per Category (per_type): the category owns one shared booking page, so the
    // Bookable toggle and the booking-card branding appear.
    await sheet.getByRole("button", { name: "Per Category" }).click();
    await expect(sheet.getByTitle("Toggle Bookable")).toBeVisible();
    await expect(sheet.getByText("Booking Card")).toBeVisible();
    // Config editor only shows once it's actually bookable.
    await expect(sheet.getByText("Form Fields")).toHaveCount(0);

    // Flip Bookable on → the shared booking-config editor appears.
    await sheet.getByTitle("Toggle Bookable").click();
    await expect(sheet.getByText("Form Fields")).toBeVisible();

    // Switching back to per_event clears the flag and hides everything again.
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

  // The "Add Sub-Type" affordance lives inline on ≥sm and in a dropdown on mobile.
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

    // per_subtype category → the sub-type owns the booking page, so Bookable shows.
    await openNewSubtypeSheet(page, testInfo.project.name, `E2E PerSubtype ${uniq}`);
    let sheet = page.getByRole("dialog");
    await expect(sheet.getByText("New Sub-Type")).toBeVisible();
    await expect(sheet.getByTitle("Toggle Bookable")).toBeVisible();
    // Sanity: the always-present sub-type defaults are still there.
    await expect(sheet.getByTitle("Toggle Host Required")).toBeVisible();
    await sheet.getByRole("button", { name: /^cancel$/i }).click();
    await expect(sheet).toBeHidden();

    // per_event category → no sub-type-level booking page, so Bookable is hidden.
    await openNewSubtypeSheet(page, testInfo.project.name, `E2E PerEvent ${uniq}`);
    sheet = page.getByRole("dialog");
    await expect(sheet.getByText("New Sub-Type")).toBeVisible();
    await expect(sheet.getByTitle("Toggle Bookable")).toHaveCount(0);
    await expect(sheet.getByTitle("Toggle Host Required")).toBeVisible();
  });
});
