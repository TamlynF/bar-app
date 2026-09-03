/* Base URLs come from three places, most specific first: an override on the
   area, a URL set against the provider, and the provider's built-in default.
   Only the scheme and host are checked here; whether a URL actually serves the
   provider's API shows up as an error on the settings page when the model list
   cannot be fetched. */

export type BaseUrlCheck = { url: string } | { error: string };

export function normaliseBaseUrl(input: string | null | undefined): BaseUrlCheck {
  const trimmed = (input ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return { error: "Enter the API base URL." };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: `"${trimmed}" is not a valid URL.` };
  }
  if (parsed.protocol !== "https:") return { error: "The API base URL must start with https://." };
  if (parsed.search || parsed.hash) return { error: "The API base URL should not carry a query string." };
  return { url: trimmed };
}

/* Blank means "no override"; anything else must be a usable URL. */
export function normaliseOptionalBaseUrl(input: string | null | undefined): { url: string | null } | { error: string } {
  if (!(input ?? "").trim()) return { url: null };
  return normaliseBaseUrl(input);
}

export function resolveBaseUrl(
  areaOverride: string | null | undefined,
  providerOverride: string | null | undefined,
  providerDefault: string
): string {
  return areaOverride?.trim() || providerOverride?.trim() || providerDefault;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
