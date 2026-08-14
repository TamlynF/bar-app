export const DEFAULT_CONTACT_EMAIL = "admin@bookingsdonfenticas.co.uk";

export const EMAIL_FROM =
  process.env.EMAIL_FROM || `Don Fenticas <${DEFAULT_CONTACT_EMAIL}>`;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || DEFAULT_CONTACT_EMAIL;
