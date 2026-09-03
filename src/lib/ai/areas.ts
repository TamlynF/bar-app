/* Every part of the app that calls an AI model, and what it needs from one.
   The settings page offers a provider and a model per area; the stored row is
   reconciled against this list, so adding an AI feature is one entry here.

   A picture round is two areas because it is two calls: a text model chooses
   the subjects and describes them, then an image model draws each card. */

import { QUIZ_IMAGE_MODEL, QUIZ_TEXT_MODEL } from "@/lib/quiz/question-origin";
import type { AiCapability, AiKind, AiProviderId } from "./providers/types";

export type AiAreaKey =
  | "quiz_questions"
  | "quiz_songs"
  | "quiz_pictures"
  | "quiz_images"
  | "marketing_trends"
  | "market_prices"
  | "menu_import";

export type AiArea = {
  key: AiAreaKey;
  label: string;
  description: string;
  kind: AiKind;
  needs: AiCapability[];
  defaultProvider: AiProviderId;
  defaultModel: string;
};

export const AI_AREAS: readonly AiArea[] = [
  {
    key: "quiz_questions",
    label: "Quiz questions",
    description: "Writes the questions and answers for an ordinary quiz round.",
    kind: "text",
    needs: ["text", "json"],
    defaultProvider: "gemini",
    defaultModel: QUIZ_TEXT_MODEL,
  },
  {
    key: "quiz_songs",
    label: "Quiz music rounds",
    description: "Suggests the songs for name-that-tune and Higher or Lower rounds.",
    kind: "text",
    needs: ["text", "json"],
    defaultProvider: "gemini",
    defaultModel: QUIZ_TEXT_MODEL,
  },
  {
    key: "quiz_pictures",
    label: "Picture round: choosing subjects (text)",
    description: "Lists what each picture card should show and describes the subject for the artist.",
    kind: "text",
    needs: ["text", "json"],
    defaultProvider: "gemini",
    defaultModel: QUIZ_TEXT_MODEL,
  },
  {
    key: "quiz_images",
    label: "Picture round: drawing the pictures (image)",
    description: "Draws each picture card from its description.",
    kind: "image",
    needs: ["image"],
    defaultProvider: "gemini",
    defaultModel: QUIZ_IMAGE_MODEL,
  },
  {
    key: "marketing_trends",
    label: "Marketing trends",
    description: "Researches advertising, pricing and event ideas for the area using web search.",
    kind: "text",
    needs: ["text", "search"],
    defaultProvider: "gemini",
    defaultModel: QUIZ_TEXT_MODEL,
  },
  {
    key: "market_prices",
    label: "Price benchmarks",
    description: "Finds what nearby venues charge for comparable drinks using web search.",
    kind: "text",
    needs: ["text", "search"],
    defaultProvider: "gemini",
    defaultModel: QUIZ_TEXT_MODEL,
  },
  {
    key: "menu_import",
    label: "Menu import",
    description: "Reads a menu PDF or photo and turns it into categories and priced items.",
    kind: "text",
    needs: ["text", "file", "json"],
    defaultProvider: "gemini",
    defaultModel: QUIZ_TEXT_MODEL,
  },
];

export const AI_AREA_KEYS: readonly AiAreaKey[] = AI_AREAS.map((area) => area.key);

export function isAiAreaKey(value: unknown): value is AiAreaKey {
  return typeof value === "string" && (AI_AREA_KEYS as readonly string[]).includes(value);
}

export function aiArea(key: AiAreaKey): AiArea {
  const found = AI_AREAS.find((area) => area.key === key);
  if (!found) throw new Error(`Unknown AI area: ${key}`);
  return found;
}
