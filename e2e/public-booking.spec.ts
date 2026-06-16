import { test, expect } from "@playwright/test";

// Completes a FREE quiz booking end-to-end against the local DB.
// No auth, no payment, no real email. Runs on both mobile and desktop.
test.describe("public quiz booking — happy path", () => {
  test("books a table and shows the confirmation screen", async ({ page }, testInfo) => {
    await page.goto("/book/quiz");

    // Book against the seeded event reserved for this test (id 5) rather than the
    // earliest quiz the render test (public-quiz.spec.ts) relies on, so filling
    // tables here can never trip that test's "fully booked" state.
    await page.getByRole("combobox", { name: /select date/i }).selectOption("5");

    // Unique per project + run so parallel mobile/desktop runs (and reruns)
    // don't collide on the per-date team-name uniqueness check.
    const stamp = `${testInfo.project.name}-${Date.now()}`;
    const team = `PW ${stamp}`;

    const name = page.locator("#name");
    const teamName = page.locator("#teamName");
    const email = page.locator("#email");
    await expect(name).toBeVisible();

    // Fill-and-verify with retry: guards against keystrokes landing before React
    // hydrates the controlled inputs (which would silently reset the value).
    await expect(async () => {
      await name.fill("Playwright Punter");
      await teamName.fill(team);
      await email.fill(`pw-${stamp}@example.com`);
      await expect(name).toHaveValue("Playwright Punter");
      await expect(teamName).toHaveValue(team);
      await expect(email).toHaveValue(`pw-${stamp}@example.com`);
    }).toPass({ timeout: 10_000 });

    // Wait out the team-name availability debounce, then submit.
    const confirm = page.getByRole("button", { name: /confirm booking/i });
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // Success screen appears for both "confirmed" and "waitlisted" outcomes —
    // both mean the booking was saved. "Book Another Table" is unique to that
    // screen, so it's a robust, rerun-safe success signal.
    await expect(page.getByRole("button", { name: /book another table/i })).toBeVisible({ timeout: 15_000 });
  });
});
