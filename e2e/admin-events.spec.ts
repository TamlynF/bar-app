import { test, expect } from "@playwright/test";
import path from "path";

// Authenticated admin flows — reuse the session captured in global-setup.
test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

test.describe("event create form (subtype prefill + conditional fields)", () => {
  test("selecting a subtype prefills defaults and shows/hides the right fields", async ({ page }) => {
    await page.goto("/event-setups/events");
    await page.getByRole("button", { name: /new event/i }).click();

    const typeSelect = page.locator('select[name="event_types_id"]');
    const subSelect = page.locator('select[name="event_subtypes_id"]');
    const title = page.locator('input[name="title"]');

    await expect(typeSelect).toBeVisible();

    // Games → Quiz: title prefills to the subtype's default; quiz needs no host,
    // and isn't karaoke, so neither field renders.
    await typeSelect.selectOption({ label: "Games" });
    await subSelect.selectOption({ label: "Quiz" });
    await expect(title).toHaveValue("Quiz Night");
    await expect(page.locator('select[name="host_employee_id"]')).toHaveCount(0);
    await expect(page.locator('input[name="karaoke_request_url"]')).toHaveCount(0);

    // Music → Gig: host_required, so the host field appears.
    await typeSelect.selectOption({ label: "Music" });
    await subSelect.selectOption({ label: "Gig" });
    await expect(page.locator('select[name="host_employee_id"]')).toHaveCount(1);

    // Music → Karaoke: the Singa/karaoke URL field appears.
    await subSelect.selectOption({ label: "Karaoke" });
    await expect(page.locator('input[name="karaoke_request_url"]')).toHaveCount(1);
  });
});
