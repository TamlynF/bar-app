// src/lib/quiz/anagram.ts
//
// A picture round of anagrams needs every card to be a real anagram, and the
// text model is unreliable at that once the answer gets long - it drops or
// invents letters. So when the host's picture instructions ask for anagrams,
// the model only picks the answers and the scramble is built here.

const ANAGRAM_NOTES = /an[ao]gram/i;

export function wantsAnagram(imageNotes: string | null | undefined): boolean {
  return !!imageNotes && ANAGRAM_NOTES.test(imageNotes);
}

export function anagramLetters(answer: string): string[] {
  return answer.toUpperCase().match(/\p{L}/gu) ?? [];
}

export function isAnagramOf(scramble: string, answer: string): boolean {
  const a = anagramLetters(scramble).sort().join("");
  const b = anagramLetters(answer).sort().join("");
  return a.length > 0 && a === b;
}

export function wordCount(answer: string): number {
  return answer.trim().split(/\s+/).filter(Boolean).length;
}

/* One continuous run of shuffled capitals, never equal to the answer's own
   letter order. Two letters or fewer cannot hide anything, so they come back
   reversed rather than looping for a different order that may not exist. */
export function scrambleAnswer(answer: string, random: () => number = Math.random): string {
  const letters = anagramLetters(answer);
  const plain = letters.join("");
  if (letters.length <= 2) return [...letters].reverse().join("");

  for (let attempt = 0; attempt < 20; attempt++) {
    const shuffled = [...letters];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const candidate = shuffled.join("");
    if (candidate !== plain) return candidate;
  }
  return [...letters].reverse().join("");
}

export function anagramBrief(answer: string, scramble: string): string {
  const words = wordCount(answer);
  return `Plain black capital letters on a white background reading exactly ${scramble}, with (${words} word${words === 1 ? "" : "s"}) beneath, and nothing else.`;
}
