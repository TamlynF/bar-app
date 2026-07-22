import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

test.describe("event create form (subtype prefill + conditional fields)", () => {
  test("selecting a subtype prefills defaults and shows/hides the right fields", async ({ page }) => {
    await page.goto("/event-setups/events");
    await page.getByTitle("New Event").click();

    const typeSelect = page.locator('select[name="event_types_id"]');
    const subSelect = page.locator('select[name="event_subtypes_id"]');
    const title = page.locator('input[name="title"]');

    await expect(typeSelect).toBeVisible();

    await typeSelect.selectOption({ label: "Games" });
    await subSelect.selectOption({ label: "Quiz" });
    await expect(title).toHaveValue("Quiz Night");
    await expect(page.locator('select[name="host_employee_id"]')).toHaveCount(0);
    await expect(page.locator('input[name="karaoke_request_url"]')).toHaveCount(0);

    await typeSelect.selectOption({ label: "Music" });
    await subSelect.selectOption({ label: "Gig" });
    await expect(page.locator('select[name="host_employee_id"]')).toHaveCount(1);

    await subSelect.selectOption({ label: "Karaoke" });
    await expect(page.locator('input[name="karaoke_request_url"]')).toHaveCount(1);
  });
});
