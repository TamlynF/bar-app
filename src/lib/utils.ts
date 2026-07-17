import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert an arbitrary label into a camelCase identifier: split on any
 * non-alphanumeric run, lowercase the first word, capitalize the rest.
 * e.g. "Singer / Solo Artist" → "singerSoloArtist", "DJ" → "dj".
 */
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
