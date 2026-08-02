import { describe, it, expect } from "vitest";
import {
  describeBookingChanges,
  buildBookingChangedEmail,
  buildAdminNewBookingEmail,
  buildAdminBookingChangedEmail,
  type BookingSnapshot,
} from "@/lib/booking-emails";

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

describe("customer change email", () => {
  it("shows the before and after of each change and links to the manage page", () => {
    const changes = describeBookingChanges(base, { ...base, groupSize: 6 });
    const { subject, html } = buildBookingChangedEmail({
      booking: base,
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
      booking: base,
      changes,
      manageUrl: "https://example.test/manage-booking/42",
      changedByAdmin: true,
    });
    expect(byAdmin.html).toMatch(/we've updated your booking/i);

    const byCustomer = buildBookingChangedEmail({
      booking: base,
      changes,
      manageUrl: "https://example.test/manage-booking/42",
    });
    expect(byCustomer.html).not.toMatch(/we've updated your booking/i);
  });
});

describe("admin emails", () => {
  it("puts the event, date and party size in the new-booking subject", () => {
    const { subject } = buildAdminNewBookingEmail({
      booking: base,
      adminUrl: "https://example.test/event-bookings",
    });
    expect(subject).toBe("New booking - Boxing Day Bash, Sat, 26 Dec 2026 (4 People)");
  });

  it("includes the customer's contact details for follow-up", () => {
    const { html } = buildAdminNewBookingEmail({
      booking: base,
      adminUrl: "https://example.test/event-bookings",
    });
    expect(html).toContain("jane@example.com");
    expect(html).toContain("#42");
  });

  it("references the booking id in the change subject", () => {
    const changes = describeBookingChanges(base, { ...base, groupSize: 6 });
    const { subject } = buildAdminBookingChangedEmail({
      booking: base,
      changes,
      adminUrl: "https://example.test/event-bookings",
    });
    expect(subject).toContain("#42");
    expect(subject).toMatch(/booking changed/i);
  });
});
