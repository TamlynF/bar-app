export function parseGbp(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = parseFloat(match[0]);
  return Number.isFinite(value) ? value : null;
}

export function formatGbp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `£${value.toFixed(2)}`;
}
