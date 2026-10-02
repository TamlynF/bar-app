export const DEFAULT_CONTACT_EMAIL = "admin@bookingsdonfenticas.co.uk";

export const EMAIL_FROM =
  process.env.EMAIL_FROM || `Don Fenticas <${DEFAULT_CONTACT_EMAIL}>`;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || DEFAULT_CONTACT_EMAIL;

/* Subdomain whose MX points at Resend inbound. Band emails get a reply-to on it
   so replies land in the app; left unset, replies go to the sender address. */
export const EMAIL_REPLY_DOMAIN = (process.env.EMAIL_REPLY_DOMAIN || "").trim().toLowerCase();
