// Menu prices often list several serves - "£4.75 pint / £2.75 half pint" - and
// the first amount is always the headline one. A £ wins over a bare number so
// strengths and sizes in the text ("0% £3.50", "500ml £6") don't get read as
// the price.
export function parseGbp(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/£\s*(\d+(?:\.\d+)?)/) ?? cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function formatGbp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `£${value.toFixed(2)}`;
}
