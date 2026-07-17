import { describe, it, expect } from "vitest";
import { buildRescheduleEmail, buildOfferEmail, buildOutcomeEmail } from "@/lib/band-emails";

describe("buildRescheduleEmail", () => {
  it("greets the booker and includes the group name in the body", () => {
    const e = buildRescheduleEmail({
      name: "Jane",
      groupName: "The Test Band",
      date: "2026-07-01",
      startTime: "22:00",
      endTime: "00:00",
    });
    expect(e.greeting).toContain("Jane");
    expect(e.body.join(" ")).toContain("The Test Band");
    expect(e.subject.toLowerCase()).toContain("confirm");
  });

  it("formats the new date and 12h time window", () => {
    const e = buildRescheduleEmail({
      name: "Jane",
      groupName: null,
      date: "2026-07-01",
      startTime: "22:00:00",
      endTime: "00:00:00",
    });
    expect(e.dateLabel).toMatch(/2026/);
    expect(e.dateLabel).toContain("July");
    expect(e.timeLabel).toBe("10:00 PM – 12:00 AM");
  });

  it("leaves date/time labels empty when not set", () => {
    const e = buildRescheduleEmail({ name: "Jane", groupName: null, date: null, startTime: null, endTime: null });
    expect(e.dateLabel).toBe("");
    expect(e.timeLabel).toBe("");
  });
});

describe("buildOfferEmail", () => {
  const base = {
    name: "Jane",
    groupName: "The Test Band",
    date: "2026-07-01",
    startTime: "22:00",
    endTime: "00:00",
  };

  it("names the act in the subject and body, and greets the booker", () => {
    const e = buildOfferEmail({ ...base, paymentAmount: 100 });
    expect(e.subject).toContain("The Test Band");
    expect(e.greeting).toContain("Jane");
    expect(e.body.join(" ")).toContain("The Test Band");
  });

  it("builds a slot label from the date and 12h time window", () => {
    const e = buildOfferEmail({ ...base, paymentAmount: 100 });
    expect(e.slotLabel).toBe("Wednesday, 1 July 2026, 10:00 PM – 12:00 AM");
    expect(e.feeLabel).toBe("Fee: £100");
  });

  it("says the slot is to be arranged when there is no date", () => {
    const e = buildOfferEmail({ ...base, date: null, startTime: null, endTime: null, paymentAmount: null });
    expect(e.slotLabel).toBe("to be arranged");
    expect(e.dateLabel).toBe("");
  });

  it("omits the fee and note labels when there is no fee or note", () => {
    const e = buildOfferEmail({ ...base, paymentAmount: null });
    expect(e.feeLabel).toBe("");
    expect(e.noteLabel).toBe("");
  });

  it("carries a note to the applicant through, trimmed", () => {
    const e = buildOfferEmail({ ...base, paymentAmount: 0, notes: "  Load in from the rear door.  " });
    expect(e.noteLabel).toBe("Load in from the rear door.");
    // £0 is a real fee decision, not a missing one.
    expect(e.feeLabel).toBe("Fee: £0");
  });

  it("falls back to 'you' when the act has no group name", () => {
    const e = buildOfferEmail({ ...base, groupName: null, paymentAmount: 50 });
    expect(e.subject).toBe("We'd love to book you — Don Fenticas");
    expect(e.body.join(" ")).toContain("have you play");
  });
});

describe("buildOutcomeEmail", () => {
  const base = {
    name: "Jane",
    groupName: "The Test Band",
    date: "2026-07-01",
    startTime: "22:00",
    endTime: "00:00",
  };

  it("confirms with the slot and an upbeat subject", () => {
    const e = buildOutcomeEmail({ ...base, outcome: "confirmed" });
    expect(e.subject).toContain("Confirmed");
    expect(e.heading).toBe("You're Confirmed!");
    expect(e.greeting).toContain("Jane");
    expect(e.dateLabel).toContain("July");
    expect(e.timeLabel).toBe("10:00 PM – 12:00 AM");
  });

  it("drops the slot when declining, even if a date was pencilled in", () => {
    const e = buildOutcomeEmail({ ...base, outcome: "cancelled" });
    expect(e.heading).toBe("Application Update");
    expect(e.dateLabel).toBe("");
    expect(e.timeLabel).toBe("");
    expect(e.body.join(" ")).toContain("unable to proceed");
  });

  it("carries a note through on either outcome", () => {
    const yes = buildOutcomeEmail({ ...base, outcome: "confirmed", notes: "Bring your own PA." });
    const no = buildOutcomeEmail({ ...base, outcome: "cancelled", notes: "Try us again in spring." });
    expect(yes.noteLabel).toBe("Bring your own PA.");
    expect(no.noteLabel).toBe("Try us again in spring.");
  });
});
