import { test, expect } from "@playwright/test";
import path from "path";

// Authenticated admin flows — reuse the session captured in global-setup.
test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

/** Local YYYY-MM-DD for today + `days`, matching the seed's `CURRENT_DATE + N` rows. */
function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function openNewEventForm(page: import("@playwright/test").Page) {
  await page.goto("/event-setups/events");
  // The add button is icon-only on mobile (name from title) but shows "New" text on
  // desktop, so target the stable title attribute rather than the accessible name.
  await page.getByTitle("New Event").click();
  await expect(page.locator('select[name="event_types_id"]')).toBeVisible();
}

test.describe("event create validation", () => {
  test("blocks save when required date / time fields are missing", async ({ page }) => {
    await openNewEventForm(page);
    // Pick a type/subtype (title prefills) but leave date + times blank.
    await page.locator('select[name="event_types_id"]').selectOption({ label: "Games" });
    await page.locator('select[name="event_subtypes_id"]').selectOption({ label: "Quiz" });
    await expect(page.locator('input[name="title"]')).toHaveValue("Quiz Night");

    await page.getByRole("button", { name: /save/i }).click();
    await expect(
      page.getByText(/Fill in event type, sub-type, title, date, start time and end time/i)
    ).toBeVisible();
  });

  test("blocks save when end time is not after start time", async ({ page }) => {
    await openNewEventForm(page);
    await page.locator('select[name="event_types_id"]').selectOption({ label: "Games" });
    await page.locator('select[name="event_subtypes_id"]').selectOption({ label: "Quiz" });

    // Far-future date so it can't clash with seeded events.
    await page.locator('input[name="date"]').fill("2030-01-01");
    await page.locator('input[name="start_time"]').fill("21:00");
    await page.locator('input[name="end_time"]').fill("20:00");

    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/End time must be after the start time/i)).toBeVisible();
  });

  test("blocks save when the time window clashes with an active event on the same date", async ({ page }) => {
    await openNewEventForm(page);
    await page.locator('select[name="event_types_id"]').selectOption({ label: "Games" });
    await page.locator('select[name="event_subtypes_id"]').selectOption({ label: "Quiz" });

    // Seed event 1: "Quiz Night" on CURRENT_DATE + 7, 20:00–22:00, active.
    await page.locator('input[name="date"]').fill(isoDateInDays(7));
    await page.locator('input[name="start_time"]').fill("21:00"); // overlaps 20:00–22:00
    await page.locator('input[name="end_time"]').fill("23:00");

    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/Clashes with an active event/i)).toBeVisible();
    await expect(page.getByText(/Quiz Night \(20:00 - 22:00\)/i)).toBeVisible();
  });

});

test.describe("public booking settings section", () => {
  test("booking fields appear only when Public Booking is on", async ({ page }) => {
    await openNewEventForm(page);
    await page.locator('select[name="event_types_id"]').selectOption({ label: "Games" });
    await page.locator('select[name="event_subtypes_id"]').selectOption({ label: "Quiz" });

    await expect(page.getByText("Public Booking Settings")).toBeVisible();

    // Seeded types are all per_event, so a new event starts not-bookable.
    const publicToggle = page.getByRole("switch", { name: "Public booking" });
    await expect(publicToggle).toHaveAttribute("aria-checked", "false");
    await expect(page.locator('input[name="booking_page_url"]')).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Fully booked" })).toHaveCount(0);
    await expect(page.getByText("Booking Page", { exact: true })).toHaveCount(0);

    // Turning it on reveals the Fully Booked toggle, Booking URL, and config editor.
    await publicToggle.click();
    await expect(publicToggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch", { name: "Fully booked" })).toHaveCount(1);
    await expect(page.locator('input[name="booking_page_url"]')).toHaveCount(1);
    await expect(page.getByText("Booking Page", { exact: true })).toBeVisible();
  });
});
