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
let groupName: string;

test.beforeEach(async ({}, testInfo) => {
  const uniq = `${Date.now()}-${testInfo.workerIndex}-${Math.floor(Math.random() * 1e6)}`;
  groupName = `E2E Original Group ${uniq}`;
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
      group_name: groupName,
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

test.describe("general bookings - inline edit & delete", () => {
  test("edit updates the booking and persists", async ({ page }) => {
    const editedName = groupName.replace("Original", "Edited");
    await page.goto(ROUTE);

    await page.getByRole("button", { name: `Show details for ${groupName}` }).click();
    await expect(page.getByText(`#${bookingId}`, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /^Edit( booking)?$/ }).click();
    await expect(page.getByText(`Editing booking #${bookingId}`)).toBeVisible();

    await page.getByLabel("Team name").fill(editedName);
    await page.getByRole("button", { name: "Confirmed", exact: true }).click();

    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Booking updated successfully")).toBeVisible();
    await expect(page.getByText(`Editing booking #${bookingId}`)).toBeHidden();
    await expect(page.getByRole("button", { name: `Hide details for ${editedName}` })).toBeVisible();

    await expect.poll(async () => {
      const { data } = await admin.from("bookings").select("group_name, status").eq("id", bookingId).single();
      return data;
    }).toMatchObject({ group_name: editedName, status: "confirmed" });
  });

  test("delete removes the booking", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Delete is only offered from the desktop row actions");
    await page.goto(ROUTE);

    await page.getByRole("button", { name: `Show details for ${groupName}` }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog.getByText(/Permanently delete this booking/i)).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByText("Booking deleted permanently")).toBeVisible();
    await expect(page.getByText(groupName)).toHaveCount(0);

    await expect.poll(async () => {
      const { data } = await admin.from("bookings").select("id").eq("id", bookingId);
      return data?.length ?? 0;
    }).toBe(0);

    bookingId = 0;
  });
});
