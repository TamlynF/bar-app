import { test, expect } from "@playwright/test";
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
  if (eventId) await admin.from("events").delete().eq("id", eventId);
  if (subtypeId) await admin.from("event_subtypes").delete().eq("id", subtypeId);
  if (typeId) await admin.from("event_types").delete().eq("id", typeId);
});

test.describe("public grouped booking — shared config source", () => {
  test("per_type scope renders the category's shared booking config", async ({ page }) => {
    await page.goto(`/book/group/type/${typeId}`);

    await expect(page.getByRole("heading", { name: /book your spot/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm booking/i })).toBeVisible();

    await expect(page.getByText("PER TYPE SHARED TAGLINE")).toBeVisible();
    await expect(page.getByText("Type Crew Name", { exact: true })).toBeVisible();
    await expect(page.getByText("Subtype Crew Name", { exact: true })).toHaveCount(0);
  });

  test("per_subtype scope renders the sub-type's shared booking config", async ({ page }) => {
    await page.goto(`/book/group/subtype/${subtypeId}`);

    await expect(page.getByRole("heading", { name: /book your spot/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm booking/i })).toBeVisible();

    await expect(page.getByText("PER SUBTYPE SHARED TAGLINE")).toBeVisible();
    await expect(page.getByText("Subtype Crew Name", { exact: true })).toBeVisible();
    await expect(page.getByText("Type Crew Name", { exact: true })).toHaveCount(0);
  });
});
