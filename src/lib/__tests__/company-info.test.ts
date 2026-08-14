import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_CONTACT_EMAIL } from "@/lib/email";

const h = vi.hoisted(() => ({ row: null as Record<string, unknown> | null }));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T,>(fn: T) => fn };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: h.row }) }),
    }),
  })),
}));

let getContactEmail: () => Promise<string>;

beforeEach(async () => {
  vi.resetModules();
  ({ getContactEmail } = await import("@/lib/company-info"));
});

describe("getContactEmail", () => {
  it("prefers the address on the company record", async () => {
    h.row = { email: "hello@donfenticas.co.uk" };
    expect(await getContactEmail()).toBe("hello@donfenticas.co.uk");
  });

  it("trims a padded address", async () => {
    h.row = { email: "  hello@donfenticas.co.uk  " };
    expect(await getContactEmail()).toBe("hello@donfenticas.co.uk");
  });

  it("falls back when the field is blank, null or the row is missing", async () => {
    for (const row of [{ email: "" }, { email: "   " }, { email: null }, null]) {
      h.row = row;
      expect(await getContactEmail()).toBe(DEFAULT_CONTACT_EMAIL);
    }
  });
});
