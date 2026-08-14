import { describe, it, expect } from "vitest";
import {
  originColumns,
  aiOrigin,
  isQuestionCreationMethod,
  MANUAL_ORIGIN,
  AI_ORIGIN,
  QUIZ_TEXT_MODEL,
} from "@/lib/quiz/question-origin";

describe("originColumns", () => {
  it("records the model behind a generated question", () => {
    expect(originColumns(AI_ORIGIN)).toEqual({
      creation_method: "ai",
      ai_model: QUIZ_TEXT_MODEL,
    });
    expect(originColumns(aiOrigin("gemini-2.5-flash-image"))).toEqual({
      creation_method: "ai",
      ai_model: "gemini-2.5-flash-image",
    });
  });

  it("leaves the model empty for a hand-written question", () => {
    expect(originColumns(MANUAL_ORIGIN)).toEqual({
      creation_method: "manual",
      ai_model: null,
    });
  });

  it("never keeps a model against a manual question", () => {
    expect(originColumns({ method: "manual", model: QUIZ_TEXT_MODEL })).toEqual({
      creation_method: "manual",
      ai_model: null,
    });
  });

  it("treats a blank model as no model", () => {
    expect(originColumns({ method: "ai", model: "   " }).ai_model).toBeNull();
  });

  it("falls back to manual rather than writing a method the check rejects", () => {
    expect(
      originColumns({ method: "robot" as never, model: "x" }).creation_method
    ).toBe("manual");
  });
});

describe("isQuestionCreationMethod", () => {
  it("accepts only the two recorded methods", () => {
    expect(isQuestionCreationMethod("manual")).toBe(true);
    expect(isQuestionCreationMethod("ai")).toBe(true);
    expect(isQuestionCreationMethod("copy")).toBe(false);
    expect(isQuestionCreationMethod(null)).toBe(false);
    expect(isQuestionCreationMethod(undefined)).toBe(false);
  });
});
