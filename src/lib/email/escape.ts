/* Emails are assembled as HTML strings, so anything that came from a person -
   a customer's name, a team name, an enquiry message, a note typed by staff -
   has to be escaped before it is interpolated. A stray apostrophe in a group
   name would otherwise break the markup, and a pasted <script> would travel to
   whoever opens the mail.

   Template copy itself is *not* escaped. An admin writing the copy is trusted to
   use <strong>, and the booking emails already rely on that. The untrusted half
   is the merge values dropped into it. */

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/* Attribute values need the same treatment plus certainty about quotes, since a
   value that closes its own attribute can add another one. */
export function escapeAttr(value: string): string {
  return escapeHtml(value);
}

const SAFE_URL_SCHEMES = ["http:", "https:", "mailto:"];

/* Every link in these emails is built from NEXT_PUBLIC_SITE_URL or a Square
   checkout URL, so a scheme outside this list means something is wrong upstream.
   Dropping it to "#" keeps a malformed link from becoming a live javascript:
   href in someone's mail client. */
export function safeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "#";

  try {
    const parsed = new URL(trimmed);
    return SAFE_URL_SCHEMES.includes(parsed.protocol) ? escapeAttr(trimmed) : "#";
  } catch {
    return trimmed.startsWith("/") ? escapeAttr(trimmed) : "#";
  }
}
