/* UK mobile numbers only - the market texts a crowd standing in a Welsh bar,
   and a single country keeps the validation honest and the bill predictable.
   Returns E.164 (+447xxxxxxxxx) or null. */
export function normaliseUkMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let national: string | null = null;
  if (digits.startsWith("+44")) national = digits.slice(3);
  else if (digits.startsWith("0044")) national = digits.slice(4);
  else if (digits.startsWith("44") && digits.length === 12) national = digits.slice(2);
  else if (digits.startsWith("07")) national = digits.slice(1);
  if (national == null || !/^7\d{9}$/.test(national)) return null;
  return `+44${national}`;
}

/* "07700 900123" style for showing the guest which phone is subscribed. */
export function formatUkMobile(e164: string): string {
  const match = /^\+44(7\d{3})(\d{6})$/.exec(e164);
  return match ? `0${match[1]} ${match[2]}` : e164;
}
