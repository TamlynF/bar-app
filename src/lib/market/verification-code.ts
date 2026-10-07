import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const VERIFICATION_MAX_ATTEMPTS = 5;

export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/* Only the hash is stored, bound to the address, so a leaked row can't be
   used to confirm someone else's sign-up. */
export function hashVerificationCode(address: string, code: string): string {
  return createHash("sha256").update(`${address.toLowerCase()}\n${code}`).digest("hex");
}

export function verificationCodeMatches(address: string, code: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const expected = Buffer.from(hashVerificationCode(address, code));
  const given = Buffer.from(storedHash);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}
