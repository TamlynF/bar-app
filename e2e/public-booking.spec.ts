import { test, expect } from "@playwright/test";

test.describe("public quiz booking - happy path", () => {
  test("books a table and shows the confirmation screen", async ({ page }, testInfo) => {
    await page.goto("/book/quiz");

    await page.getByRole("combobox", { name: /select date/i }).selectOption("5");

    const stamp = `${testInfo.project.name}-${Date.now()}`;
    const team = `PW ${stamp}`;

    const name = page.locator("#name");
    const teamName = page.locator("#teamName");
    const email = page.locator("#email");
    await expect(name).toBeVisible();

    await expect(async () => {
      await name.fill("Playwright Punter");
      await teamName.fill(team);
      await email.fill(`pw-${stamp}@example.com`);
      await expect(name).toHaveValue("Playwright Punter");
      await expect(teamName).toHaveValue(team);
      await expect(email).toHaveValue(`pw-${stamp}@example.com`);
    }).toPass({ timeout: 10_000 });

    const confirm = page.getByRole("button", { name: /confirm booking/i });
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByRole("button", { name: /book another table/i })).toBeVisible({ timeout: 15_000 });
  });
});
