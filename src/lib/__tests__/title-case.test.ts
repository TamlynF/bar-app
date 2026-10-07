import { describe, expect, it } from "vitest";
import { titleCase } from "../title-case";

describe("titleCase", () => {
  it("capitalises each word and lowers the rest", () => {
    expect(titleCase("single + mixer")).toBe("Single + Mixer");
    expect(titleCase("DOUBLE + MIXER")).toBe("Double + Mixer");
    expect(titleCase("  125ml glass ")).toBe("125ml Glass");
  });
});
