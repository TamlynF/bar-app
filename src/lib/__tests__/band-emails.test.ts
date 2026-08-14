import { describe, it, expect } from "vitest";
import {
  bandMergeValues,
  bandScenarioKey,
  bandSlotCardLabel,
  buildBandEmail,
  type BandEmailKind,
} from "@/lib/band-emails";
import { findScenario } from "@/lib/email/scenarios";
import { renderSlots } from "@/lib/email/render";

const base = {
  name: "Jane",
  groupName: "The Wanderers",
  date: "2026-09-12",
  startTime: "20:00",
  endTime: "22:30",
};

/* Built from the shipped template, so these also guard the default copy. */
const build = (kind: BandEmailKind, over: Record<string, unknown> = {}) => {
  const p = { ...base, ...over } as typeof base & {
    paymentAmount?: number | null;
    notes?: string | null;
  };
  const scenario = findScenario(bandScenarioKey(kind))!;
  const { slots } = renderSlots(
    scenario.defaults,
    bandMergeValues({ name: p.name, groupName: p.groupName })
  );
  return buildBandEmail({
    slots,
    kind,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    paymentAmount: p.paymentAmount,
    notes: p.notes,
  });
};

describe("reschedule email", () => {
  it("asks the band to re-confirm and shows the new slot", () => {
    const e = build("rescheduled");
    expect(e.subject).toBe("Please confirm your updated performance slot - Don Fenticas");
    expect(e.heading).toBe("Slot Updated");
    expect(e.greeting).toBe("Hey Jane,");
    expect(e.dateLabel).toBe("Saturday, 12 September 2026");
    expect(e.timeLabel).toBe("8:00 PM – 10:30 PM");
    expect(e.body.join(" ")).toMatch(/on hold until we hear back/i);
  });

  it("names the act in brackets when it has a name", () => {
    expect(build("rescheduled").body[0]).toContain("(The Wanderers)");
  });

  it("leaves no empty brackets when the act has no name", () => {
    const e = build("rescheduled", { groupName: null });
    expect(e.body[0]).not.toContain("()");
    expect(e.body[0]).toMatch(/at Don Fenticas\./);
  });

  it("drops the slot card when there is no date", () => {
    const e = build("rescheduled", { date: null, startTime: null, endTime: null });
    expect(e.dateLabel).toBe("");
    expect(e.timeLabel).toBe("");
  });
});

describe("offer email", () => {
  it("names the act in the subject", () => {
    expect(build("offered").subject).toBe("We'd love to book you, The Wanderers - Don Fenticas");
  });

  it("puts the date and time into one slot label", () => {
    expect(build("offered").slotLabel).toBe("Saturday, 12 September 2026, 8:00 PM – 10:30 PM");
  });

  it("says the slot is to be arranged when no date is set", () => {
    const e = build("offered", { date: null, startTime: null, endTime: null });
    expect(e.slotLabel).toBe("to be arranged");
  });

  it("shows a fee only when one is given", () => {
    expect(build("offered", { paymentAmount: 100 }).feeLabel).toBe("Fee: £100");
    expect(build("offered", { paymentAmount: null }).feeLabel).toBe("");
  });

  it("trims the note and drops it when blank", () => {
    expect(build("offered", { notes: "  Load in from the rear door.  " }).noteLabel).toBe(
      "Load in from the rear door."
    );
    expect(build("offered", { notes: "   " }).noteLabel).toBe("");
  });

  it("falls back to \"you\" in the body when the act has no name", () => {
    expect(build("offered", { groupName: null }).body[0]).toContain("have you play");
  });
});

describe("outcome emails", () => {
  it("confirms with the performance date", () => {
    const e = build("booked");
    expect(e.subject).toBe("Your Performance at Don Fenticas is Confirmed!");
    expect(e.heading).toBe("You're Confirmed!");
    expect(e.dateLabel).toBe("Saturday, 12 September 2026");
  });

  it("declines without dangling a date the act is not getting", () => {
    const e = build("declined");
    expect(e.subject).toBe("Update on Your Application - Don Fenticas");
    expect(e.heading).toBe("Application Update");
    expect(e.dateLabel).toBe("");
    expect(e.timeLabel).toBe("");
  });

  it("carries a note on either outcome", () => {
    expect(build("booked", { notes: "Bring your own PA." }).noteLabel).toBe("Bring your own PA.");
    expect(build("declined", { notes: "Try us again in spring." }).noteLabel).toBe(
      "Try us again in spring."
    );
  });

  it("splits the closing paragraph out so it can sit below the date card", () => {
    expect(build("booked").outro.join(" ")).toMatch(/in touch closer to the date/i);
  });
});

describe("bandSlotCardLabel", () => {
  it("labels each card for what it is", () => {
    expect(bandSlotCardLabel("offered")).toBe("Proposed Slot");
    expect(bandSlotCardLabel("rescheduled")).toBe("New Performance Slot");
    expect(bandSlotCardLabel("booked")).toBe("Performance Date");
  });
});
