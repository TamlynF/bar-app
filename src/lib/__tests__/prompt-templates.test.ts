import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROMPTS,
  PROMPT_KINDS,
  PROMPT_TOKENS,
  promptKindFor,
  promptOverride,
  promptTokensUsed,
  renderPrompt,
  resolvePrompt,
  unknownPromptTokens,
} from "@/lib/quiz/prompt-templates";

describe("promptKindFor", () => {
  it("picks question when nothing is flagged", () => {
    expect(promptKindFor({ isPicture: false, includeSpotify: false, isHigherLower: false })).toBe("question");
  });

  it("splits Spotify rounds on the Higher or Lower flag", () => {
    expect(promptKindFor({ isPicture: false, includeSpotify: true, isHigherLower: false })).toBe("song");
    expect(promptKindFor({ isPicture: false, includeSpotify: true, isHigherLower: true })).toBe("higher_lower");
  });

  it("ignores Higher or Lower without Spotify", () => {
    expect(promptKindFor({ isPicture: false, includeSpotify: false, isHigherLower: true })).toBe("question");
  });

  it("lets picture win over every other flag", () => {
    expect(promptKindFor({ isPicture: true, includeSpotify: true, isHigherLower: true })).toBe("picture");
  });
});

describe("renderPrompt", () => {
  it("substitutes tokens, blanks null values and keeps unknown ones verbatim", () => {
    const { text, unknownTokens } = renderPrompt("A {{count}} B {{ gone }} C {{nope}}", {
      count: 10,
      gone: null,
    });
    expect(text).toBe("A 10 B  C {{nope}}");
    expect(unknownTokens).toEqual(["nope"]);
  });

  it("lists each token once", () => {
    expect(promptTokensUsed("{{a}} {{b}} {{ a }}")).toEqual(["a", "b"]);
  });
});

describe("unknownPromptTokens", () => {
  it("flags tokens the round type does not supply", () => {
    expect(unknownPromptTokens("question", "{{quiz_category_name}} {{chain_year}}")).toEqual(["chain_year"]);
  });
});

describe("built-in prompts", () => {
  it.each(PROMPT_KINDS)("%s uses only its declared tokens", (kind) => {
    expect(unknownPromptTokens(kind, DEFAULT_PROMPTS[kind])).toEqual([]);
  });

  it.each(PROMPT_KINDS)("%s declares no token it never uses", (kind) => {
    const used = new Set(promptTokensUsed(DEFAULT_PROMPTS[kind]));
    for (const { token } of PROMPT_TOKENS[kind]) expect(used.has(token)).toBe(true);
  });
});

describe("promptOverride", () => {
  it("stores nothing for blank wording", () => {
    expect(promptOverride("question", "")).toBeNull();
    expect(promptOverride("question", "  \n ")).toBeNull();
    expect(promptOverride("question", null)).toBeNull();
  });

  it("stores nothing for the built-in wording however the textarea wraps it", () => {
    const crlf = DEFAULT_PROMPTS.song.replace(/\n/g, "\r\n") + "\r\n";
    expect(promptOverride("song", crlf)).toBeNull();
  });

  it("stores changed wording with line endings normalised", () => {
    expect(promptOverride("question", "Ask {{count}} things.\r\nBe kind.\n")).toBe(
      "Ask {{count}} things.\nBe kind."
    );
  });
});

describe("resolvePrompt", () => {
  it("falls back to the built-in prompt when nothing is stored", () => {
    expect(resolvePrompt("picture", null)).toEqual({
      template: DEFAULT_PROMPTS.picture,
      isCustomised: false,
    });
    expect(resolvePrompt("picture", "   ").isCustomised).toBe(false);
  });

  it("uses stored wording when there is some", () => {
    expect(resolvePrompt("picture", "Draw {{count}} things.")).toEqual({
      template: "Draw {{count}} things.",
      isCustomised: true,
    });
  });
});
