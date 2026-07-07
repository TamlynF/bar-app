/**
 * Parse a free-text GBP price into a number.
 *
 * Menu items (`menu_items.price`) and AI-sourced competitor prices are stored
 * as free text like "£4.50", "4.5", "£5 (+£1.45 mixer)". This extracts the
 * first monetary figure — the base price — ignoring surcharges in parentheses.
 * Returns null when no numeric value is present.
 */
export function parseGbp(text: string | null | undefined): number | null {
  if (!text) return null;
  // First number with optional decimals; commas as thousands separators tolerated.
  const match = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = parseFloat(match[0]);
  return Number.isFinite(value) ? value : null;
}

/** Format a number as a GBP string, e.g. 4.5 → "£4.50". */
export function formatGbp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `£${value.toFixed(2)}`;
}
