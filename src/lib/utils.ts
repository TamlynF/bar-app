import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/* The public type-scale tokens (text-h2, text-btn, ...) are font sizes, not
   colours. Without this, tailwind-merge guesses and drops a colour such as
   text-on-gold when it sits next to text-btn. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["h2", "h3", "body", "btn", "nav", "meta", "eyebrow", "pill"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toCamelCase(input: string): string {
  const words = input
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
  return words
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("")
}
