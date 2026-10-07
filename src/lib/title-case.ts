/* "single + mixer" → "Single + Mixer": first letter of each word up, the
   rest down, punctuation left alone. */
export function titleCase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
