import { describe, it, expect } from "vitest";
import {
  bookingMergeValues,
  describeBookingChanges,
  buildBookingChangedEmail,
  buildAdminNewBookingEmail,
  buildAdminBookingChangedEmail,
  type BookingSnapshot,
} from "@/lib/booking-emails";
import { findScenario } from "@/lib/email/scenarios";
import { renderSlots } from "@/lib/email/render";

const base: BookingSnapshot = {
  bookingId: 42,
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  eventTitle: "Boxing Day Bash",
  eventDate: "2026-12-26",
  groupName: "The Quizzards",
  groupNameLabel: "Team Name",
  groupSize: 4,
  status: "confirmed",
  specialRequests: null,
  totalAmount: null,
  paidAmount: null,
};

/* Resolved from the shipped template, so these also guard the default copy. */
const slotsFor = (key: string, booking: BookingSnapshot = base) =>
  renderSlots(findScenario(key)!.defaults, bookingMergeValues(booking)).slots;

describe("describeBookingChanges", () => {
  it("reports nothing when nothing the customer sees changed", () => {
    expect(describeBookingChanges(base, { ...base })).toEqual([]);
  });

  it("reports a party size change with readable values", () => {
    const changes = describeBookingChanges(base, { ...base, groupSize: 6 });
    expect(changes).toEqual([{ label: "Party Size", from: "4 People", to: "6 People" }]);
  });

  it("uses the configured group name label", () => {
    const changes = describeBookingChanges(base, { ...base, groupName: "New Name" });
    expect(changes[0].label).toBe("Team Name");
    expect(changes[0]).toMatchObject({ from: "The Quizzards", to: "New Name" });
  });

  it("treats null, empty and whitespace-only as the same value", () => {
    const from: BookingSnapshot = { ...base, specialRequests: null };
    expect(describeBookingChanges(from, { ...from, specialRequests: "" })).toEqual([]);
    expect(describeBookingChanges(from, { ...from, specialRequests: "   " })).toEqual([]);
  });

  it("reports a special request being added and removed", () => {
    const added = describeBookingChanges(base, { ...base, specialRequests: "Window table" });
    expect(added).toEqual([{ label: "Special Requests", from: "-", to: "Window table" }]);

    const withReq = { ...base, specialRequests: "Window table" };
    const removed = describeBookingChanges(withReq, { ...withReq, specialRequests: null });
    expect(removed).toEqual([{ label: "Special Requests", from: "Window table", to: "-" }]);
  });

  it("ignores a status change that is only a difference in casing", () => {
    expect(describeBookingChanges(base, { ...base, status: "CONFIRMED" })).toEqual([]);
    expect(describeBookingChanges(base, { ...base, status: "waitlisted" })).toHaveLength(1);
  });

  it("reports a date move using formatted dates", () => {
    const changes = describeBookingChanges(base, { ...base, eventDate: "2026-12-27" });
    expect(changes).toEqual([{ label: "Date", from: "Sat, 26 Dec 2026", to: "Sun, 27 Dec 2026" }]);
  });

  it("collects several changes at once", () => {
    const changes = describeBookingChanges(base, {
      ...base,
      groupSize: 2,
      status: "waitlisted",
      specialRequests: "Birthday",
    });
    expect(changes.map((c) => c.label)).toEqual(["Party Size", "Special Requests", "Status"]);
  });
});

describe("bookingMergeValues", () => {
  it("formats the values a template can refer to", () => {
    expect(bookingMergeValues(base)).toMatchObject({
      customerName: "Jane Doe",
      eventTitle: "Boxing Day Bash",
      eventDate: "Sat, 26 Dec 2026",
      groupName: "The Quizzards",
      groupSize: "4 People",
      groupSizeLower: "4 people",
      bookingId: "42",
    });
  });

  it("gives an unnamed group an empty string rather than the word null", () => {
    expect(bookingMergeValues({ ...base, groupName: null }).groupName).toBe("");
  });
});

describe("customer change email", () => {
  it("shows the before and after of each change and links to the manage page", () => {
    const changes = describeBookingChanges(base, { ...base, groupSize: 6 });
    const { subject, html } = buildBookingChangedEmail({
      slots: slotsFor("booking.changed.by_customer"),
      changes,
      manageUrl: "https://example.test/manage-booking/42",
    });

    expect(subject).toBe("Booking updated: Boxing Day Bash @ Don Fenticas");
    expect(html).toContain("4 People");
    expect(html).toContain("6 People");
    expect(html).toContain('href="https://example.test/manage-booking/42"');
  });

  it("uses venue-initiated wording when an admin made the change", () => {
    const changes = describeBookingChanges(base, { ...base, groupSize: 6 });
    const byAdmin = buildBookingChangedEmail({
      slots: slotsFor("booking.changed.by_admin"),
      changes,
      manageUrl: "https://example.test/manage-booking/42",
    });
    expect(byAdmin.html).toMatch(/we've updated your booking/i);

    const byCustomer = buildBookingChangedEmail({
      slots: slotsFor("booking.changed.by_customer"),
      changes,
      manageUrl: "https://example.test/manage-booking/42",
    });
    expect(byCustomer.html).not.toMatch(/we've updated your booking/i);
  });
});

describe("admin emails", () => {
  it("puts the event, date and party size in the new-booking subject", () => {
    const { subject } = buildAdminNewBookingEmail({
      slots: slotsFor("admin.booking.new"),
      booking: base,
      adminUrl: "https://example.test/event-bookings",
    });
    expect(subject).toBe("New booking - Boxing Day Bash, Sat, 26 Dec 2026 (4 People)");
  });

  it("includes the customer's contact details for follow-up", () => {
    const { html } = buildAdminNewBookingEmail({
      slots: slotsFor("admin.booking.new"),
      booking: base,
      adminUrl: "https://example.test/event-bookings",
    });
    expect(html).toContain("jane@example.com");
    expect(html).toContain("#42");
  });

  it("references the booking id in the change subject", () => {
    const changes = describeBookingChanges(base, { ...base, groupSize: 6 });
    const { subject } = buildAdminBookingChangedEmail({
      slots: slotsFor("admin.booking.changed"),
      booking: base,
      changes,
      adminUrl: "https://example.test/event-bookings",
    });
    expect(subject).toContain("#42");
    expect(subject).toMatch(/booking changed/i);
  });

  it("escapes a customer name that contains markup", () => {
    const nasty = { ...base, customerName: "<script>alert(1)</script>" };
    const { html } = buildAdminNewBookingEmail({
      slots: slotsFor("admin.booking.new", nasty),
      booking: nasty,
      adminUrl: "https://example.test/event-bookings",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
