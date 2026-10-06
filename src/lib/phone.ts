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
