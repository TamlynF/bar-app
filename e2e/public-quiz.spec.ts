import { test, expect } from "@playwright/test";

test.describe("public quiz booking page", () => {
  test("renders the booking form for a seeded upcoming quiz", async ({ page }) => {
    await page.goto("/book/quiz");
    await expect(page).toHaveURL(/\/book\/quiz/);

    await expect(page.getByRole("heading", { name: /book your table/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm booking/i })).toBeVisible();

    await expect(page.getByRole("combobox", { name: /select date/i })).toBeVisible();
  });
});
