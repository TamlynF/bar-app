import { describe, it, expect } from "vitest";
import {
  wantsAnagram,
  anagramLetters,
  isAnagramOf,
  wordCount,
  scrambleAnswer,
  anagramBrief,
} from "@/lib/quiz/anagram";

describe("wantsAnagram", () => {
  it("matches the word however the host spells it", () => {
    expect(wantsAnagram("only show the text of the anagram")).toBe(true);
    expect(wantsAnagram("only show the text of the anogram")).toBe(true);
    expect(wantsAnagram("Anagrams please")).toBe(true);
  });

  it("ignores other instructions and empty notes", () => {
    expect(wantsAnagram("photos of the band on stage")).toBe(false);
    expect(wantsAnagram("")).toBe(false);
    expect(wantsAnagram(null)).toBe(false);
    expect(wantsAnagram(undefined)).toBe(false);
  });
});

describe("anagramLetters", () => {
  it("keeps letters only, upper-cased, including accented ones", () => {
    expect(anagramLetters("Beyoncé")).toEqual(["B", "E", "Y", "O", "N", "C", "É"]);
    expect(anagramLetters("Red Hot Chili Peppers").join("")).toBe("REDHOTCHILIPEPPERS");
    expect(anagramLetters("AC/DC").join("")).toBe("ACDC");
    expect(anagramLetters("Blink-182").join("")).toBe("BLINK");
  });
});

describe("isAnagramOf", () => {
  it("accepts a true rearrangement regardless of spacing and case", () => {
    expect(isAnagramOf("KIND FLOPY", "Pink Floyd")).toBe(true);
    expect(isAnagramOf("bleatteshe", "The Beatles")).toBe(true);
  });

  it("rejects missing, extra or swapped letters", () => {
    expect(isAnagramOf("PERSHILCHIPOTEDR", "Red Hot Chili Peppers")).toBe(false);
    expect(isAnagramOf("FAD PONK", "Daft Punk")).toBe(false);
    expect(isAnagramOf("", "Queen")).toBe(false);
  });
});

describe("wordCount", () => {
  it("counts words in the answer, not the scramble", () => {
    expect(wordCount("Queen")).toBe(1);
    expect(wordCount("Red Hot Chili Peppers")).toBe(4);
    expect(wordCount("  Arctic   Monkeys ")).toBe(2);
  });
});

describe("scrambleAnswer", () => {
  it("uses every letter exactly once with no spaces", () => {
    for (const answer of ["Queen", "Red Hot Chili Peppers", "Beyoncé", "The Beatles"]) {
      const scramble = scrambleAnswer(answer);
      expect(scramble).toMatch(/^\p{Lu}+$/u);
      expect(isAnagramOf(scramble, answer)).toBe(true);
    }
  });

  it("never hands back the answer's own letter order", () => {
    for (let i = 0; i < 50; i++) {
      expect(scrambleAnswer("Coldplay")).not.toBe("COLDPLAY");
    }
  });

  it("reverses very short answers", () => {
    expect(scrambleAnswer("U2")).toBe("U");
    expect(scrambleAnswer("Ab")).toBe("BA");
  });

  it("is reproducible with a seeded random source", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const first = scrambleAnswer("Nirvana", random);
    seed = 7;
    const second = scrambleAnswer("Nirvana", random);
    expect(first).toBe(second);
    expect(isAnagramOf(first, "Nirvana")).toBe(true);
  });

  it("falls back to reversing when the shuffle keeps returning the original", () => {
    expect(scrambleAnswer("AAB", () => 0.999)).toBe("BAA");
  });
});

describe("anagramBrief", () => {
  it("writes the brief with the answer's word count", () => {
    expect(anagramBrief("Queen", "NEUQE")).toBe(
      "Plain black capital letters on a white background reading exactly NEUQE, with (1 word) beneath, and nothing else."
    );
    expect(anagramBrief("Pink Floyd", "KINDFLOPY")).toContain("(2 words)");
  });
});
