import { describe, it, expect } from "vitest";
import {
  EMAIL_SCENARIOS,
  EMAIL_SCENARIO_GROUPS,
  findScenario,
  sampleValues,
} from "@/lib/email/scenarios";
import { mergeOverride, type EmailTemplateRow } from "@/lib/email/merge";
import { renderSlots, SLOT_KEYS, tokensUsed } from "@/lib/email/render";

const row = (over: Partial<EmailTemplateRow>): EmailTemplateRow => ({
  id: 1,
  scenario_key: "booking.quiz.confirmed",
  subject: null,
  heading: null,
  eyebrow: null,
  greeting: null,
  intro: null,
  outro: null,
  cta_label: null,
  footnote: null,
  is_active: true,
  created_at: null,
  updated_at: null,
  created_by: null,
  updated_by: null,
  ...over,
});

const quiz = () => findScenario("booking.quiz.confirmed")!;

describe("mergeOverride", () => {
  it("falls back to the built-in copy when nothing is overridden", () => {
    const resolved = mergeOverride(quiz(), null);
    expect(resolved.slots).toEqual(quiz().defaults);
    expect(resolved.isCustomised).toBe(false);
    expect(resolved.isActive).toBe(true);
  });

  it("overrides only the slots that have a stored value", () => {
    const resolved = mergeOverride(quiz(), row({ subject: "Table booked!" }));

    expect(resolved.slots.subject).toBe("Table booked!");
    expect(resolved.slots.intro).toBe(quiz().defaults.intro);
    expect(resolved.isCustomised).toBe(true);
  });

  it("treats an empty string as a real override, so a footnote can be cleared", () => {
    const withFootnote = findScenario("booking.cancelled.by_customer")!;
    expect(withFootnote.defaults.footnote).not.toBe("");

    const resolved = mergeOverride(withFootnote, row({ footnote: "" }));
    expect(resolved.slots.footnote).toBe("");
    expect(resolved.isCustomised).toBe(true);
  });

  it("maps cta_label onto the ctaLabel slot", () => {
    const resolved = mergeOverride(quiz(), row({ cta_label: "See your table" }));
    expect(resolved.slots.ctaLabel).toBe("See your table");
  });

  it("carries is_active through so a scenario can be switched off", () => {
    expect(mergeOverride(quiz(), row({ is_active: false })).isActive).toBe(false);
  });

  it("keeps the row for the audit display", () => {
    const stored = row({ subject: "x" });
    expect(mergeOverride(quiz(), stored).row).toBe(stored);
  });
});

describe("the scenario registry", () => {
  it("has unique keys", () => {
    const keys = EMAIL_SCENARIOS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("puts every scenario in a known group", () => {
    for (const scenario of EMAIL_SCENARIOS) {
      expect(EMAIL_SCENARIO_GROUPS).toContain(scenario.group);
    }
  });

  it("only uses merge tokens it declares", () => {
    for (const scenario of EMAIL_SCENARIOS) {
      const declared = new Set(scenario.mergeFields.map((f) => f.token));
      for (const token of tokensUsed(scenario.defaults)) {
        expect(
          declared.has(token),
          `${scenario.key} uses {{${token}}} but does not declare it`,
        ).toBe(true);
      }
    }
  });

  it("exposes every slot it ships copy for, so nothing is uneditable", () => {
    for (const scenario of EMAIL_SCENARIOS) {
      for (const key of SLOT_KEYS) {
        if (!scenario.defaults[key]) continue;
        expect(
          scenario.slots,
          `${scenario.key} ships default ${key} copy but hides that slot`,
        ).toContain(key);
      }
    }
  });

  it("gives every scenario a subject", () => {
    for (const scenario of EMAIL_SCENARIOS) {
      expect(scenario.defaults.subject, `${scenario.key} has no subject`).not.toBe("");
    }
  });

  it("renders every default cleanly against its own sample data", () => {
    for (const scenario of EMAIL_SCENARIOS) {
      const { slots, unknownTokens } = renderSlots(scenario.defaults, sampleValues(scenario));
      expect(unknownTokens, `${scenario.key} left tokens unresolved`).toEqual([]);
      expect(slots.subject).not.toContain("{{");
    }
  });
});
