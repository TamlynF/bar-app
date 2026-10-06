/* Phone numbers typed into the public forms. Kept loose on purpose - UK and
   international formats both pass - but it has to look like a number. */

export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15;

/* Drops anything that can't be part of a phone number as it's typed. */
export function cleanPhoneInput(value: string): string {
  return value.replace(/[^\d+\s()\-.]/g, "").replace(/(?!^)\+/g, "");
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\+?[\d\s()\-.]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "").length;
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}

export const PHONE_ERROR = "Please enter a valid phone number.";

/* International (E.164) form for services like Square that reject local
   numbers. UK local numbers ("07700 900123") gain +44; "00" becomes "+".
   Anything that still doesn't look like a full number returns undefined so
   the caller can leave the field out. */
export function toE164(value: string | null | undefined, defaultCountryCode = "+44"): string | undefined {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) {
    const country = defaultCountryCode.replace(/[^\d]/g, "");
    digits = `+${country}${digits.replace(/^0+/, "")}`;
  }
  const body = digits.slice(1).replace(/\D/g, "");
  if (body.length < 8 || body.length > 15) return undefined;
  return `+${body}`;
}
