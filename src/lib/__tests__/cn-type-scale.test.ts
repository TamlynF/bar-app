import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

const label = "text-btn";
const heading = "text-h3";
const small = "text-xs";

describe("cn with the public type scale", () => {
  it("keeps a text colour beside a type-scale size token", () => {
    expect(cn(label, "text-on-gold")).toBe("text-btn text-on-gold");
    expect(cn("text-gold", label, small)).toBe("text-gold text-xs");
  });

  it("still resolves two sizes to the last one", () => {
    expect(cn(label, heading)).toBe("text-h3");
  });
});
