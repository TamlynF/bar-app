import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const EVENT_CFG = { fields: { group_name: { visible: false } } };

let typeId: number;
let subtypeId: number;
const eventIds: number[] = [];

async function createEvent(title: string, price: number): Promise<number> {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const { data, error } = await admin
    .from("events")
    .insert({
      date: d.toISOString().split("T")[0],
      start_time: "20:00+00",
      end_time: "22:00+00",
      title,
      event_types_id: typeId,
      event_subtypes_id: subtypeId,
      is_active: true,
      is_bookable: true,
      seating_required: false,
      payment_amount: price,
      booking_config: EVENT_CFG,
    })
    .select("id")
    .single();
  if (error) throw error;
  eventIds.push(data.id);
  return data.id;
}

test.beforeEach(async ({}, testInfo) => {
  const uniq = `${Date.now()}-${testInfo.workerIndex}-${Math.floor(Math.random() * 1e6)}`;

  const { data: type, error: tErr } = await admin
    .from("event_types")
    .insert({ name: `E2E Event ${uniq}`, booking_grouping: "per_event", is_bookable: false })
    .select("id")
    .single();
  if (tErr) throw tErr;
  typeId = type.id;

  const { data: subtype, error: sErr } = await admin
    .from("event_subtypes")
    .insert({ event_types_id: typeId, name: `E2E Event Sub ${uniq}`, is_bookable: true, seating_required: false })
    .select("id")
    .single();
  if (sErr) throw sErr;
  subtypeId = subtype.id;
});

test.afterEach(async () => {
  for (const id of eventIds.splice(0)) {
    const { data: bookings } = await admin.from("bookings").select("id").eq("event_id", id);
    const ids = (bookings ?? []).map((b) => b.id);
    if (ids.length) {
      await admin.from("booking_table_mappings").delete().in("booking_id", ids);
      await admin.from("bookings").delete().in("id", ids);
    }
    await admin.from("events").delete().eq("id", id);
  }
  if (subtypeId) await admin.from("event_subtypes").delete().eq("id", subtypeId);
  if (typeId) await admin.from("event_types").delete().eq("id", typeId);
});

async function fillDetails(page: Page, name: string, email: string) {
  const nameBox = page.getByPlaceholder("e.g. Jane Smith");
  const emailBox = page.getByPlaceholder("e.g. jane@email.com");
  await expect(nameBox).toBeVisible();

  await expect(async () => {
    await nameBox.fill(name);
    await emailBox.fill(email);
    await expect(nameBox).toHaveValue(name);
    await expect(emailBox).toHaveValue(email);
  }).toPass({ timeout: 10_000 });
}

test.describe("public event booking", () => {
  test("books a free event and shows the confirmation", async ({ page }, testInfo) => {
    const eventId = await createEvent("E2E Free Event", 0);
    const stamp = `${testInfo.project.name}-${Date.now()}`;

    await page.goto(`/book/event/${eventId}`);
    await expect(page.getByRole("heading", { name: /book your spot/i })).toBeVisible();
    await fillDetails(page, "Playwright Punter", `pw-${stamp}@example.com`);

    const book = page.getByRole("button", { name: /book now/i });
    await expect(book).toBeEnabled();
    await book.click();

    await expect(page.getByRole("heading", { name: /you're booked/i })).toBeVisible({ timeout: 15_000 });

    const { data: rows } = await admin
      .from("bookings")
      .select("status, payment_status, group_size")
      .eq("event_id", eventId);
    expect(rows).toEqual([{ status: "confirmed", payment_status: "paid", group_size: 1 }]);
  });

  /* Stops at the payment step: the booking is held as pending and the
     customer is handed to Square (or Square's in-page form), but no card is
     ever charged. */
  test("starts payment for a paid event without charging anything", async ({ page }, testInfo) => {
    const eventId = await createEvent("E2E Paid Event", 5);
    const stamp = `${testInfo.project.name}-${Date.now()}`;

    await page.goto(`/book/event/${eventId}`);
    await fillDetails(page, "Playwright Payer", `pw-pay-${stamp}@example.com`);

    const pay = page.getByRole("button", { name: /pay £5\.00/i });
    await expect(pay).toBeEnabled();
    await pay.click();

    const handedToSquare = page.waitForURL(/square\.(link|site)|squareupsandbox\.com/i, { timeout: 30_000 });
    const inPageSheet = page.getByText("Secure payment").waitFor({ timeout: 30_000 });
    await Promise.any([handedToSquare, inPageSheet]);

    const { data: rows } = await admin
      .from("bookings")
      .select("status, payment_status, square_order_id")
      .eq("event_id", eventId);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ status: "pending", payment_status: "unpaid" });
    expect(rows![0].square_order_id).toBeTruthy();
  });
});
