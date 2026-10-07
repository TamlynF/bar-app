import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const TYPE_CFG = {
  tag_line: "PER TYPE SHARED TAGLINE",
  fields: { group_name: { visible: true, label: "Type Crew Name", required: false } },
};
const SUB_CFG = {
  tag_line: "PER SUBTYPE SHARED TAGLINE",
  fields: { group_name: { visible: true, label: "Subtype Crew Name", required: false } },
};

let typeId: number;
let subtypeId: number;
let eventId: number;

test.beforeEach(async ({}, testInfo) => {
  const uniq = `${Date.now()}-${testInfo.workerIndex}-${Math.floor(Math.random() * 1e6)}`;

  const { data: type, error: tErr } = await admin
    .from("event_types")
    .insert({
      name: `E2E Group ${uniq}`,
      booking_grouping: "per_type",
      is_bookable: true,
      booking_config: TYPE_CFG,
    })
    .select("id")
    .single();
  if (tErr) throw tErr;
  typeId = type.id;

  const { data: subtype, error: sErr } = await admin
    .from("event_subtypes")
    .insert({
      event_types_id: typeId,
      name: `E2E Sub ${uniq}`,
      is_bookable: true,
      seating_required: false,
      booking_config: SUB_CFG,
    })
    .select("id")
    .single();
  if (sErr) throw sErr;
  subtypeId = subtype.id;

  const d = new Date();
  d.setDate(d.getDate() + 30);
  const date = d.toISOString().split("T")[0];

  const { data: event, error: eErr } = await admin
    .from("events")
    .insert({
      date,
      start_time: "20:00+00",
      end_time: "22:00+00",
      title: "E2E Grouped Event",
      event_types_id: typeId,
      event_subtypes_id: subtypeId,
      is_active: true,
      is_bookable: true,
      seating_required: false,
      payment_amount: 0,
      booking_config: {},
    })
    .select("id")
    .single();
  if (eErr) throw eErr;
  eventId = event.id;
});

test.afterEach(async () => {
  if (eventId) {
    const { data: bookings } = await admin.from("bookings").select("id").eq("event_id", eventId);
    const ids = (bookings ?? []).map((b) => b.id);
    if (ids.length) {
      await admin.from("booking_table_mappings").delete().in("booking_id", ids);
      await admin.from("bookings").delete().in("id", ids);
    }
    await admin.from("events").delete().eq("id", eventId);
  }
  if (subtypeId) await admin.from("event_subtypes").delete().eq("id", subtypeId);
  if (typeId) await admin.from("event_types").delete().eq("id", typeId);
});

test.describe("public grouped booking - shared config source", () => {
  test("per_type scope renders the category's shared booking config", async ({ page }) => {
    await page.goto(`/book/group/type/${typeId}`);

    await expect(page.getByRole("heading", { name: /book your spot/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /book now/i })).toBeVisible();

    await expect(page.getByText("PER TYPE SHARED TAGLINE")).toBeVisible();
    await expect(page.getByText("Type Crew Name", { exact: true })).toBeVisible();
    await expect(page.getByText("Subtype Crew Name", { exact: true })).toHaveCount(0);
  });

  test("per_subtype scope renders the sub-type's shared booking config", async ({ page }) => {
    await page.goto(`/book/group/subtype/${subtypeId}`);

    await expect(page.getByRole("heading", { name: /book your spot/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /book now/i })).toBeVisible();

    await expect(page.getByText("PER SUBTYPE SHARED TAGLINE")).toBeVisible();
    await expect(page.getByText("Subtype Crew Name", { exact: true })).toBeVisible();
    await expect(page.getByText("Type Crew Name", { exact: true })).toHaveCount(0);
  });
});

async function fillBooking(page: Page, details: { name: string; email: string; team: string }) {
  const name = page.getByPlaceholder("e.g. Jane Smith");
  const email = page.getByPlaceholder("e.g. jane@email.com");
  const team = page.getByPlaceholder("e.g. The Thirsty Trivia Titans");
  await expect(name).toBeVisible();

  await expect(async () => {
    await name.fill(details.name);
    await email.fill(details.email);
    await team.fill(details.team);
    await expect(name).toHaveValue(details.name);
    await expect(email).toHaveValue(details.email);
    await expect(team).toHaveValue(details.team);
  }).toPass({ timeout: 10_000 });
}

test.describe("public grouped booking - full free booking", () => {
  test("books a place on the chosen date and shows the confirmation", async ({ page }, testInfo) => {
    const stamp = `${testInfo.project.name}-${Date.now()}`;
    await page.goto(`/book/group/subtype/${subtypeId}?id=${eventId}`);

    await fillBooking(page, { name: "Playwright Punter", email: `pw-${stamp}@example.com`, team: `PW ${stamp}` });

    const book = page.getByRole("button", { name: /book now/i });
    await expect(book).toBeEnabled();
    await book.click();

    await expect(page.getByRole("heading", { name: /you're booked/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /book another spot/i })).toBeVisible();

    const { data: rows } = await admin.from("bookings").select("status, group_name").eq("event_id", eventId);
    expect(rows).toEqual([{ status: "confirmed", group_name: `PW ${stamp}` }]);
  });

  test("blocks a team name that is already booked for that date", async ({ page }, testInfo) => {
    const stamp = `${testInfo.project.name}-${Date.now()}`;
    const team = `PW Taken ${stamp}`;
    const { data: contact, error: cErr } = await admin
      .from("contacts")
      .insert({ full_name: "First Team", email: `pw-first-${stamp}@example.com` })
      .select("id")
      .single();
    if (cErr) throw cErr;
    const { error: bErr } = await admin.from("bookings").insert({
      event_id: eventId,
      contact_id: contact.id,
      group_name: team,
      group_size: 2,
      status: "confirmed",
      payment_status: "paid",
      paid_amount: 0,
      total_amount: 0,
    });
    if (bErr) throw bErr;

    await page.goto(`/book/group/subtype/${subtypeId}?id=${eventId}`);
    await fillBooking(page, { name: "Second Team", email: `pw-second-${stamp}@example.com`, team: team.toLowerCase() });

    await expect(page.getByText(/subtype crew name is already taken/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /book now/i })).toBeDisabled();
  });
});
