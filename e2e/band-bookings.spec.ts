import { test, expect } from "@playwright/test";
import path from "path";

// Authenticated admin flow — reuse the session captured in global-setup.
test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

test.describe("band booking — selected date/time editing", () => {
  test("preferred date defaults start to 10pm and end to start + 2h", async ({ page }) => {
    await page.goto("/event-bookings/music-bookings");

    // Open the seeded pending application (supabase/seed.sql).
    await page.getByRole("button", { name: /The Test Band/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The selected date + performance time fields render even before a date is chosen.
    await expect(dialog.getByText("Selected Date", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /pick a date/i })).toBeVisible();
    const start = dialog.getByLabel("Performance start time");
    const end = dialog.getByLabel("Performance end time");
    await expect(start).toHaveValue("");

    // Preferred dates are shown; clicking one selects it and applies the defaults.
    await expect(dialog.getByText("Preferred Dates", { exact: true })).toBeVisible();
    const chip = dialog.getByRole("button", { name: /,\s\d{1,2}\s\w{3}$/ }).first();
    await chip.click();

    await expect(start).toHaveValue("22:00");
    await expect(end).toHaveValue("00:00");

    // Changing the start re-derives the end as start + 2h.
    await start.fill("20:30");
    await expect(end).toHaveValue("22:30");
  });
});
