export const MAX_MONEY_AMOUNT = 100000;

/* What a pounds-and-pence field accepts while typing: digits and one decimal
   point, at most two decimal places. Anything else - a minus sign, letters, a
   second point, a pasted "£" - is dropped. */
export function cleanMoneyInput(raw: string): string {
  const kept = raw.replace(/[^\d.]/g, "");
  const point = kept.indexOf(".");
  if (point === -1) return kept.replace(/^0+(?=\d)/, "");
  const pounds = kept.slice(0, point).replace(/^0+(?=\d)/, "");
  const pence = kept.slice(point + 1).replace(/\./g, "").slice(0, 2);
  return `${pounds || "0"}.${pence}`;
}

export function parseMoney(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY_AMOUNT) return null;
  return Math.round(amount * 100) / 100;
}

/* The tidy form shown once the field loses focus: "12" becomes "12.00". */
export function formatMoneyInput(value: string): string {
  const amount = parseMoney(value);
  return amount == null ? "" : amount.toFixed(2);
}
