import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "path";

test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const GIG_EVENT_ID = 3;
const ROUTE = "/event-bookings/general/music/gig";

let contactId: number;
let bookingId: number;

test.beforeEach(async ({}, testInfo) => {
  const uniq = `${Date.now()}-${testInfo.workerIndex}-${Math.floor(Math.random() * 1e6)}`;
  const { data: contact, error: cErr } = await admin
    .from("contacts")
    .insert({ full_name: "E2E General Tester", email: `e2e-general-${uniq}@example.com`, phone_no: "111222" })
    .select("id")
    .single();
  if (cErr) throw cErr;
  contactId = contact.id;

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .insert({
      event_id: GIG_EVENT_ID,
      contact_id: contactId,
      group_name: "E2E Original Group",
      group_size: 2,
      status: "pending",
      special_requests: "Window seat please",
    })
    .select("id")
    .single();
  if (bErr) throw bErr;
  bookingId = booking.id;
});

test.afterEach(async () => {
  if (bookingId) {
    await admin.from("booking_table_mappings").delete().eq("booking_id", bookingId);
    await admin.from("bookings").delete().eq("id", bookingId);
  }
  if (contactId) await admin.from("contacts").delete().eq("id", contactId);
});

test.describe("general bookings - sheet edit & delete", () => {
  test("edit updates the booking and persists", async ({ page }) => {
    await page.goto(ROUTE);

    await page.getByText("E2E Original Group", { exact: false }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(`Ref: ${bookingId}`)).toBeVisible();

    await dialog.getByRole("button", { name: /^Edit$/i }).click();
    await expect(dialog.getByText("Modify Record")).toBeVisible();

    await dialog.getByLabel("Group Name").fill("E2E Edited Group");
    await dialog.getByTitle("Status").selectOption("confirmed");

    await dialog.getByRole("button", { name: /^Save$/i }).click();

    await expect(page.getByText("Booking updated successfully")).toBeVisible();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("E2E Edited Group", { exact: false }).first()).toBeVisible();

    await expect.poll(async () => {
      const { data } = await admin.from("bookings").select("group_name, status").eq("id", bookingId).single();
      return data;
    }).toMatchObject({ group_name: "E2E Edited Group", status: "confirmed" });
  });

  test("delete removes the booking", async ({ page }) => {
    await page.goto(ROUTE);

    await page.getByText("E2E Original Group", { exact: false }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /^Delete$/i }).click();

    await expect(page.getByText(/Permanently delete this booking/i)).toBeVisible();
    await page.locator("button.bg-red-600", { hasText: "Delete" }).click();

    await expect(page.getByText("Booking deleted permanently")).toBeVisible();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("E2E Original Group")).toHaveCount(0);

    await expect.poll(async () => {
      const { data } = await admin.from("bookings").select("id").eq("id", bookingId);
      return data?.length ?? 0;
    }).toBe(0);

    bookingId = 0;
  });
});
