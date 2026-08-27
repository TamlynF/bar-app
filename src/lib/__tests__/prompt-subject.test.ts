import { describe, it, expect } from "vitest";
import { promptSubject } from "@/lib/quiz/prompt-subject";

describe("promptSubject", () => {
  it("asks for general knowledge on a High Stakes round", () => {
    expect(promptSubject("High Stakes")).toBe("General Knowledge");
  });

  it("matches however the round happens to be spelled", () => {
    expect(promptSubject("high-stakes")).toBe("General Knowledge");
    expect(promptSubject("HIGH STAKES")).toBe("General Knowledge");
    expect(promptSubject("High Stakes Round")).toBe("General Knowledge");
    expect(promptSubject("Round 7: HighStakes")).toBe("General Knowledge");
  });

  it("leaves a round named after its subject alone", () => {
    expect(promptSubject("Movies")).toBe("Movies");
    expect(promptSubject("General Knowledge")).toBe("General Knowledge");
    expect(promptSubject("Sport & Leisure")).toBe("Sport & Leisure");
    expect(promptSubject("")).toBe("");
  });
});
