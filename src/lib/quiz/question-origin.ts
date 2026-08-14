/* Where a saved question came from. The three save actions are shared by the
   generator and by hand-written entries, so the caller says which it is rather
   than the action guessing from the shape of the data.

   "Manual" describes who wrote the question and answer, not where the picture
   came from - typing an answer and asking for an image is still a hand-written
   question. */

export const QUESTION_CREATION_METHODS = ["manual", "ai"] as const;

export type QuestionCreationMethod = (typeof QUESTION_CREATION_METHODS)[number];

export type QuestionOrigin = {
  method: QuestionCreationMethod;
  /** The model that wrote it. Null for anything a person typed. */
  model: string | null;
};

/* The models the quiz generator calls. Kept here rather than in the actions
   file because a "use server" module can only export async functions, and the
   client needs the name to record it alongside what it saves. */
export const QUIZ_TEXT_MODEL = "gemini-2.5-flash";
export const QUIZ_IMAGE_MODEL = "gemini-2.5-flash-image";

export const MANUAL_ORIGIN: QuestionOrigin = { method: "manual", model: null };

export const AI_ORIGIN: QuestionOrigin = { method: "ai", model: QUIZ_TEXT_MODEL };

export function aiOrigin(model: string): QuestionOrigin {
  return { method: "ai", model };
}

export function isQuestionCreationMethod(value: unknown): value is QuestionCreationMethod {
  return typeof value === "string" && (QUESTION_CREATION_METHODS as readonly string[]).includes(value);
}

/* The two columns as the archive stores them, so every insert writes the pair
   the same way and a bad method never reaches the check constraint. */
export function originColumns(origin: QuestionOrigin): {
  creation_method: QuestionCreationMethod;
  ai_model: string | null;
} {
  const method = isQuestionCreationMethod(origin.method) ? origin.method : "manual";
  return {
    creation_method: method,
    ai_model: method === "ai" ? (origin.model?.trim() || null) : null,
  };
}
