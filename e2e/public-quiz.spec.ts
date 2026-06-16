import { test, expect } from "@playwright/test";

// Public, unauthenticated. Runs on both the mobile and desktop projects.
test.describe("public quiz booking page", () => {
  test("renders the booking form for a seeded upcoming quiz", async ({ page }) => {
    await page.goto("/book/quiz");
    await expect(page).toHaveURL(/\/book\/quiz/);

    // The booking form renders (not an empty/closed state).
    await expect(page.getByRole("heading", { name: /book your table/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm booking/i })).toBeVisible();

    // The seeded upcoming quiz event flowed through to the date picker.
    await expect(page.getByRole("combobox", { name: /select date/i })).toBeVisible();
  });
});
