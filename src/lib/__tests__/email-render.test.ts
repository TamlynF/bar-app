import { describe, it, expect } from "vitest";
import {
  renderSlots,
  toParagraphs,
  tokensUsed,
  EMPTY_SLOTS,
  type TemplateSlots,
} from "@/lib/email/render";

const slots = (over: Partial<TemplateSlots>): TemplateSlots => ({ ...EMPTY_SLOTS, ...over });

describe("renderSlots", () => {
  it("substitutes a merge token", () => {
    const { slots: out } = renderSlots(slots({ greeting: "Hey {{customerName}}!" }), {
      customerName: "Jane",
    });
    expect(out.greeting).toBe("Hey Jane!");
  });

  it("tolerates whitespace inside the braces", () => {
    const { slots: out } = renderSlots(slots({ greeting: "Hey {{  customerName  }}!" }), {
      customerName: "Jane",
    });
    expect(out.greeting).toBe("Hey Jane!");
  });

  it("escapes merge values in html slots", () => {
    const { slots: out } = renderSlots(slots({ intro: "Team {{groupName}} is in." }), {
      groupName: `<script>alert("x")</script>`,
    });
    expect(out.intro).toBe("Team &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; is in.");
  });

  it("leaves the subject unescaped so inboxes show real punctuation", () => {
    const { slots: out } = renderSlots(slots({ subject: "Booking for {{groupName}}" }), {
      groupName: "Smith & Sons",
    });
    expect(out.subject).toBe("Booking for Smith & Sons");
  });

  it("does not escape the template's own markup", () => {
    const { slots: out } = renderSlots(
      slots({ intro: "Your spot for <strong>{{eventTitle}}</strong> is secured." }),
      { eventTitle: "Quiz Night" },
    );
    expect(out.intro).toBe("Your spot for <strong>Quiz Night</strong> is secured.");
  });

  it("leaves an unknown token verbatim and reports it", () => {
    const { slots: out, unknownTokens } = renderSlots(
      slots({ intro: "Hello {{custmerName}}" }),
      { customerName: "Jane" },
    );
    expect(out.intro).toBe("Hello {{custmerName}}");
    expect(unknownTokens).toEqual(["custmerName"]);
  });

  it("renders a supplied-but-null value as empty rather than leaving the token", () => {
    const { slots: out, unknownTokens } = renderSlots(slots({ intro: "Team {{groupName}}." }), {
      groupName: null,
    });
    expect(out.intro).toBe("Team .");
    expect(unknownTokens).toEqual([]);
  });

  it("substitutes every occurrence of a repeated token", () => {
    const { slots: out } = renderSlots(
      slots({ intro: "{{eventTitle}} - see you at {{eventTitle}}." }),
      { eventTitle: "Quiz Night" },
    );
    expect(out.intro).toBe("Quiz Night - see you at Quiz Night.");
  });

  it("returns every slot, including the ones left blank", () => {
    const { slots: out } = renderSlots(slots({ subject: "Hi" }), {});
    expect(out.footnote).toBe("");
    expect(out.outro).toBe("");
  });
});

describe("toParagraphs", () => {
  it("splits on blank lines", () => {
    expect(toParagraphs("One.\n\nTwo.")).toEqual(["One.", "Two."]);
  });

  it("keeps a single newline inside one paragraph", () => {
    expect(toParagraphs("One,\nstill one.")).toEqual(["One,\nstill one."]);
  });

  it("drops empty runs", () => {
    expect(toParagraphs("One.\n\n\n\nTwo.\n\n")).toEqual(["One.", "Two."]);
  });

  it("returns nothing for blank copy", () => {
    expect(toParagraphs("   ")).toEqual([]);
  });
});

describe("tokensUsed", () => {
  it("collects tokens across every slot without repeats", () => {
    expect(
      tokensUsed(
        slots({
          subject: "{{eventTitle}}",
          intro: "{{customerName}} booked {{eventTitle}}",
        }),
      ).sort(),
    ).toEqual(["customerName", "eventTitle"]);
  });
});
