import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "path";

test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const SEEDED_QUIZ_EVENT_ID = 1;

async function openNewEventForm(page: Page) {
  await page.goto("/event-setups/events");
  await page.getByRole("button", { name: "Add event" }).first().click();
  const sheet = page.getByRole("dialog", { name: "New event" });
  await expect(sheet.getByRole("combobox", { name: "Event Type" })).toBeVisible();
  return sheet;
}

async function chooseGamesQuiz(page: Page) {
  const sheet = page.getByRole("dialog", { name: "New event" });
  await sheet.getByRole("combobox", { name: "Event Type" }).selectOption({ label: "Games" });
  await sheet.getByRole("combobox", { name: "Sub-Type" }).selectOption({ label: "Quiz" });
}

async function pickDate(page: Page, isoDate: string) {
  const sheet = page.getByRole("dialog", { name: "New event" });
  await sheet.getByRole("button", { name: "Pick a date" }).click();
  const dayKey = await page.evaluate((d) => new Date(d + "T00:00:00").toLocaleDateString(), isoDate);
  const day = page.locator(`[data-day="${dayKey}"]`).first();
  for (let i = 0; i < 24 && !(await day.isVisible()); i++) {
    await page.getByRole("button", { name: /next month/i }).click();
  }
  await day.click();
}

test.describe("event create validation", () => {
  test("blocks save when required date / time fields are missing", async ({ page }) => {
    const sheet = await openNewEventForm(page);
    await chooseGamesQuiz(page);
    await expect(sheet.locator('input[name="title"]')).toHaveValue("Quiz Night");

    await expect(sheet.getByText("Pick a date.")).toBeVisible();
    await expect(sheet.getByText("Set a start and end time.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("blocks save when end time is not after start time", async ({ page }) => {
    const sheet = await openNewEventForm(page);
    await chooseGamesQuiz(page);

    await sheet.getByRole("textbox", { name: "Start time" }).fill("21:00");
    await sheet.getByRole("textbox", { name: "End time" }).fill("20:00");

    await expect(sheet.getByText(/End time must be after the start time/i)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("blocks save when the time window clashes with an active event on the same date", async ({ page }) => {
    const { data: seeded, error } = await admin
      .from("events")
      .select("date")
      .eq("id", SEEDED_QUIZ_EVENT_ID)
      .single();
    if (error) throw error;

    const sheet = await openNewEventForm(page);
    await chooseGamesQuiz(page);

    await pickDate(page, seeded.date);
    await sheet.getByRole("textbox", { name: "Start time" }).fill("21:00");
    await sheet.getByRole("textbox", { name: "End time" }).fill("23:00");

    await expect(sheet.getByText(/Clashes with Quiz Night \(20:00 - 22:00\)/i)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

test.describe("public booking settings section", () => {
  test("booking fields appear only when Public Booking is on", async ({ page }) => {
    const sheet = await openNewEventForm(page);
    await chooseGamesQuiz(page);

    await sheet.getByRole("button", { name: /More settings/ }).click();
    await expect(sheet.getByText("Public booking settings")).toBeVisible();

    const publicToggle = sheet.getByRole("switch", { name: "Public booking" });
    await expect(publicToggle).toHaveAttribute("aria-checked", "false");
    await expect(sheet.locator('input[name="booking_page_url"]')).toHaveCount(0);
    await expect(sheet.getByRole("switch", { name: "Fully booked" })).toHaveCount(0);
    await expect(sheet.getByText("Booking URL", { exact: true })).toHaveCount(0);

    await publicToggle.click();
    await expect(publicToggle).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByRole("switch", { name: "Fully booked" })).toHaveCount(1);
    await expect(sheet.locator('input[name="booking_page_url"]')).toHaveCount(1);
    await expect(sheet.getByText("Booking URL", { exact: true })).toBeVisible();
  });
});
