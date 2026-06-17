import { describe, it, expect } from "vitest";
import { normalizeBookingConfig, DEFAULT_BOOKING_CONFIG } from "@/lib/booking-config";

describe("normalizeBookingConfig", () => {
  it("returns the full defaults for an empty/null config", () => {
    expect(normalizeBookingConfig({})).toEqual(DEFAULT_BOOKING_CONFIG);
    expect(normalizeBookingConfig(null)).toEqual(DEFAULT_BOOKING_CONFIG);
    expect(normalizeBookingConfig(undefined)).toEqual(DEFAULT_BOOKING_CONFIG);
  });

  it("forces name and email to always visible + required, but keeps custom labels", () => {
    const cfg = normalizeBookingConfig({
      fields: {
        name: { visible: false, required: false, label: "Full Name" },
        email: { visible: false, required: false, label: "Your Email" },
      },
    });
    expect(cfg.fields.name).toEqual({ visible: true, required: true, label: "Full Name" });
    expect(cfg.fields.email).toEqual({ visible: true, required: true, label: "Your Email" });
  });

  it("reads the new nested shape, including group_size min/max", () => {
    const cfg = normalizeBookingConfig({
      tag_line: "Join us",
      fields: {
        phone: { visible: false, label: "Mobile", required: false },
        group_size: { visible: true, label: "Party Size", required: true, min: 2, max: 12 },
      },
    });
    expect(cfg.tag_line).toBe("Join us");
    expect(cfg.fields.phone).toEqual({ visible: false, label: "Mobile", required: false });
    expect(cfg.fields.group_size).toEqual({ visible: true, label: "Party Size", required: true, min: 2, max: 12 });
  });

  it("maps the legacy flat shape for back-compat", () => {
    const cfg = normalizeBookingConfig({
      collect_phone: false,
      collect_group_size: true,
      collect_group_name: true,
      collect_special_requests: false,
      group_name_label: "Team Name",
      min_group_size: 4,
      max_group_size: 6,
      custom_tagline: "Eight rounds",
    });
    expect(cfg.fields.phone.visible).toBe(false);
    expect(cfg.fields.group_name.visible).toBe(true);
    expect(cfg.fields.group_name.label).toBe("Team Name");
    expect(cfg.fields.special_requests.visible).toBe(false);
    expect(cfg.fields.group_size.min).toBe(4);
    expect(cfg.fields.group_size.max).toBe(6);
    expect(cfg.tag_line).toBe("Eight rounds");
  });

  it("prefers new nested keys over legacy ones", () => {
    const cfg = normalizeBookingConfig({
      custom_tagline: "old",
      tag_line: "new",
      collect_phone: true,
      fields: { phone: { visible: false, label: "Phone Number", required: false } },
    });
    expect(cfg.tag_line).toBe("new");
    expect(cfg.fields.phone.visible).toBe(false);
  });
});
