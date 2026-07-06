import { describe, it, expect } from "vitest";
import {
  buildAdminBookingGroups,
  isRequestEnquiryGroup,
  partitionBookingGroups,
  type AdminBookingGroupEvent,
} from "@/lib/admin-booking-groups";

function ev(
  id: number,
  typeName: string,
  grouping: string,
  subName: string | null,
  behavior: string | null,
): AdminBookingGroupEvent {
  return {
    id,
    title: `${typeName} ${id}`,
    date: "2026-07-10",
    event_types: { name: typeName, color: null, booking_grouping: grouping },
    event_subtypes: subName ? { name: subName, color: null, behavior } : null,
  };
}

describe("buildAdminBookingGroups behaviour + grouping", () => {
  it("captures the sub-type behaviour and resolved grouping on each entry", () => {
    const groups = buildAdminBookingGroups([
      ev(1, "Music", "per_type", "Band", "music_act"),
      ev(2, "Comedy", "per_subtype", "Standup", "standard"),
      ev(3, "Special", "per_event", "One-off", "standard"),
    ]);
    const byLabelBehavior = groups.map((g) => ({ grouping: g.grouping, behavior: g.behavior }));
    expect(byLabelBehavior).toEqual(
      expect.arrayContaining([
        { grouping: "per_type", behavior: "music_act" },
        { grouping: "per_subtype", behavior: "standard" },
        { grouping: "per_event", behavior: "standard" },
      ]),
    );
  });
});

describe("isRequestEnquiryGroup", () => {
  it("flags per_type music_act and private groups", () => {
    const [music] = buildAdminBookingGroups([ev(1, "Music", "per_type", "Band", "music_act")]);
    const [priv] = buildAdminBookingGroups([ev(2, "Private", "per_type", "Hire", "private")]);
    expect(isRequestEnquiryGroup(music)).toBe(true);
    expect(isRequestEnquiryGroup(priv)).toBe(true);
  });

  it("does not flag per_type groups with other behaviours", () => {
    const [quiz] = buildAdminBookingGroups([ev(1, "Games", "per_type", "Quiz", "quiz")]);
    expect(isRequestEnquiryGroup(quiz)).toBe(false);
  });

  it("does not flag music_act / private that are not per_type", () => {
    const [subMusic] = buildAdminBookingGroups([ev(1, "Music", "per_subtype", "Band", "music_act")]);
    expect(isRequestEnquiryGroup(subMusic)).toBe(false);
  });
});

describe("partitionBookingGroups", () => {
  it("splits per_type music_act/private into requests and everything else into guest", () => {
    const groups = buildAdminBookingGroups([
      ev(1, "Music", "per_type", "Band", "music_act"),
      ev(2, "Private", "per_type", "Hire", "private"),
      ev(3, "Games", "per_type", "Quiz", "quiz"),
      ev(4, "Special", "per_event", "One-off", "standard"),
    ]);
    const { guest, requests } = partitionBookingGroups(groups);
    expect(requests.map((g) => g.behavior).sort()).toEqual(["music_act", "private"]);
    expect(guest).toHaveLength(2);
    expect(guest.every((g) => !isRequestEnquiryGroup(g))).toBe(true);
  });
});
