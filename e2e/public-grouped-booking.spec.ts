import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Service-role client against LOCAL Supabase (dotenv-loaded in playwright.config).
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Covers commit 59cf155 "relocate booking configuration to appropriate levels":
// the grouped booking page (/book/group/[scope]/[id]) and its form now read ONE
// shared booking_config from the owning event_type (per_type) or event_subtype
// (per_subtype) — no longer from each event's own booking_config. We prove that by
// giving the type and the sub-type distinct shared configs (custom tagline + a
// custom-labelled Group Name field) and asserting each scope renders its own.

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

  // Category grouped per_type, owning the whole category's booking page/config.
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

  // Sub-type with its OWN shared config (used by the subtype scope).
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

  // One upcoming, bookable event that belongs to both the type and the sub-type,
  // so it surfaces under both the type and subtype scopes. Its own booking_config
  // is deliberately left empty — the shared config must come from above.
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

    // The form rendered (event matched the type scope).
    await expect(page.getByRole("heading", { name: /book your spot/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm booking/i })).toBeVisible();

    // Tagline + Group Name label come from the TYPE's shared config…
    // (exact match — "Subtype Crew Name" contains "type crew name" under
    //  getByText's default case-insensitive substring matching).
    await expect(page.getByText("PER TYPE SHARED TAGLINE")).toBeVisible();
    await expect(page.getByText("Type Crew Name", { exact: true })).toBeVisible();
    // …and NOT from the sub-type's config.
    await expect(page.getByText("Subtype Crew Name", { exact: true })).toHaveCount(0);
  });

  test("per_subtype scope renders the sub-type's shared booking config", async ({ page }) => {
    await page.goto(`/book/group/subtype/${subtypeId}`);

    await expect(page.getByRole("heading", { name: /book your spot/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm booking/i })).toBeVisible();

    // Tagline + Group Name label come from the SUB-TYPE's shared config…
    await expect(page.getByText("PER SUBTYPE SHARED TAGLINE")).toBeVisible();
    await expect(page.getByText("Subtype Crew Name", { exact: true })).toBeVisible();
    // …and NOT from the type's config.
    await expect(page.getByText("Type Crew Name", { exact: true })).toHaveCount(0);
  });
});
